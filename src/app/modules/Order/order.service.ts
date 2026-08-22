import mongoose, { Types } from "mongoose";
import { orderModel } from "./order.model.ts";
import type { TOrderStatus, TPaymentMethod } from "./order.interface.ts";
import { UserServices } from "../User/user.service.ts";
import { AddressServices } from "../Address/address.service.ts";
import { productVariantModel } from "../ProductVariant/productVariant.model.ts";
import AppError from "../../error/AppError.ts";
import { productModel } from "../Product/product.model.ts";
import { orderItemModel } from "../OrderItem/orderItem.model.ts";
import { BkashService } from "../../utils/bkash.ts";
import QueryBuilder from "../../builder/QueryBuilder.ts";
import type { TRequester } from "../User/user.interface.ts";
import { couponModel } from "../Coupon/coupon.model.ts";

const orderSearchableFields = ["orderNumber"];

const DEFAULT_SHIPPING_COST = 60;
// TODO: replace with real shipping-rate logic (e.g. by district — inside
// vs outside Dhaka is a common split) once that business rule is defined.
// This is a placeholder flat rate.

const generateOrderNumber = async () => {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  let orderNumber = "";
  let isUnique = false;

  while (!isUnique) {
    const randomPart = Math.floor(1000 + Math.random() * 9000);
    orderNumber = `ORD-${datePart}-${randomPart}`;
    const existing = await orderModel.findOne({ orderNumber });
    if (!existing) isUnique = true;
  }

  return orderNumber;
};

type TGuestCheckoutPayload = {
  name: string;
  phoneNumber: string;
  address: {
    fullName: string;
    phoneNumber?: string;
    address: string;
    district: string;
    upazila: string;
    postalCode?: string;
  };
  items: { variant: string; quantity: number }[];
  paymentMethod: TPaymentMethod;
  couponCode?: string;
};

/**
 * Guest-first checkout: resolves (or creates) the User by phoneNumber and
 * the Address by (phoneNumber, district, upazila), then places the order.
 *
 * Everything that touches the database — order creation, order items,
 * and stock deduction — happens inside one transaction. The bKash payment
 * call happens AFTER commit, deliberately outside the transaction: you
 * can't hold a DB transaction open across a third-party network call, and
 * you can't roll back bKash from your own database. If bKash's API call
 * fails, the order still exists with paymentStatus "pending" and can be
 * retried via initiateBkashPaymentIntoDB.
 */
const guestCheckoutIntoDB = async (payload: TGuestCheckoutPayload) => {
  const user = await UserServices.findOrCreateGuestUserIntoDB({
    name: payload.name,
    phoneNumber: payload.phoneNumber,
  });

  const address = await AddressServices.findOrCreateAddressIntoDB(
    String(user._id),
    {
      fullName: payload.address.fullName,
      phoneNumber: payload.address.phoneNumber || payload.phoneNumber,
      address: payload.address.address,
      district: payload.address.district,
      upazila: payload.address.upazila,
      postalCode: payload.address.postalCode,
    }
  );

  const session = await mongoose.startSession();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let order: any;
  let orderItems: unknown[] = [];

  try {
    session.startTransaction();

    let subtotal = 0;
    const orderItemsData: {
      product: Types.ObjectId;
      variant: Types.ObjectId;
      productName: string;
      sku: string;
      size?: string;
      color?: string;
      price: number;
      quantity: number;
      total: number;
    }[] = [];

    for (const item of payload.items) {
      const variant = await productVariantModel
        .findById(item.variant)
        .session(session);

      if (!variant || !variant.isActive) {
        throw new AppError(404, "One of the selected items is unavailable");
      }

      const product = await productModel
        .findById(variant.product)
        .session(session);

      if (!product || !product.isActive) {
        throw new AppError(404, "One of the selected products is unavailable");
      }

      const deducted = await productVariantModel.findOneAndUpdate(
        { _id: variant._id, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } },
        { new: true, session }
      );

      if (!deducted) {
        throw new AppError(
          400,
          `Insufficient stock for ${product.name} (${variant.size}, ${variant.color.name})`
        );
      }

      const lineTotal = variant.price * item.quantity;
      subtotal += lineTotal;

      orderItemsData.push({
        product: product._id,
        variant: variant._id,
        productName: product.name,
        sku: variant.sku,
        size: variant.size,
        color: variant.color.name,
        price: variant.price,
        quantity: item.quantity,
        total: lineTotal,
      });
    }

    // ── Coupon validation ─────────────────────────────────────────
    let discount = 0;
    let couponId: Types.ObjectId | undefined = undefined;

    if (payload.couponCode) {
      const coupon = await couponModel
        .findOne({ code: payload.couponCode.trim().toUpperCase() })
        .session(session);

      if (!coupon) {
        throw new AppError(400, "Coupon code not found");
      }
      if (!coupon.isActive) {
        throw new AppError(400, "This coupon is no longer active");
      }

      const now = new Date();
      if (coupon.startDate > now) {
        throw new AppError(400, "This coupon is not active yet");
      }
      if (coupon.expiryDate < now) {
        throw new AppError(400, "This coupon has expired");
      }

      if (
        typeof coupon.usageLimit === "number" &&
        (coupon.usedCount ?? 0) >= coupon.usageLimit
      ) {
        throw new AppError(400, "This coupon has reached its usage limit");
      }

      if (coupon.minimumPurchase) {
        if (subtotal < coupon.minimumPurchase) {
          throw new AppError(
            400,
            `This coupon requires a minimum order of ${coupon.minimumPurchase}`
          );
        }
      }

      discount =
        coupon.type === "percentage"
          ? (subtotal * coupon.value) / 100
          : coupon.value;

      if (coupon.type === "percentage" && typeof coupon.maximumDiscount === "number") {
        discount = Math.min(discount, coupon.maximumDiscount);
      }

      // never let discount exceed subtotal
      discount = Math.min(discount, subtotal);
      couponId = coupon._id;

      // atomically bump usage so concurrent checkouts can't both slip in
      // under a usageLimit that's already reached
      if (typeof coupon.usageLimit === "number") {
        const bumped = await couponModel.findOneAndUpdate(
          { _id: coupon._id, usedCount: { $lt: coupon.usageLimit } },
          { $inc: { usedCount: 1 } },
          { new: true, session }
        );
        if (!bumped) {
          throw new AppError(400, "This coupon has just reached its usage limit");
        }
      } else {
        await couponModel.updateOne(
          { _id: coupon._id },
          { $inc: { usedCount: 1 } },
          { session }
        );
      }
    }

    const shippingCost = DEFAULT_SHIPPING_COST;
    const total = subtotal - discount + shippingCost;
    const orderNumber = await generateOrderNumber();

    const createdOrder = new orderModel({
      user: user._id,
      orderNumber,
      address: address._id,
      subtotal,
      discount,
      shippingCost,
      total,
      coupon: couponId,
      status: "pending",
      paymentMethod: payload.paymentMethod,
      paymentStatus: "pending",
    });

    await createdOrder.save({ session });

    order = createdOrder;

    orderItems = await orderItemModel.insertMany(
      orderItemsData.map((item) => ({ ...item, order: order._id })),
      { session }
    );

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  let bkashURL: string | undefined;
  if (payload.paymentMethod === "bkash") {
    try {
      const bkashPayment = await BkashService.createPayment({
        amount: order.total,
        orderNumber: order.orderNumber,
        payerReference: String(user._id),
      });

      order.bkashPaymentID = bkashPayment.paymentID;
      await order.save();
      bkashURL = bkashPayment.bkashURL;
    } catch {
      // Order still exists with paymentStatus "pending" — the client can
      // retry via POST /orders/:id/payment/bkash.
    }
  }

  return { order, items: orderItems, user: user, bkashURL };
};

const getMyOrdersFromDB = async (
  userId: string,
  query: Record<string, unknown>
) => {
  const orderQuery = new QueryBuilder(
    orderModel.find({ user: userId }).populate("address"),
    query
  )
    .search(orderSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await orderQuery.modelQuery;
  const meta = await orderQuery.countTotal();

  return { meta, result };
};

const getAllOrdersFromDB = async (query: Record<string, unknown>) => {
  const orderQuery = new QueryBuilder(
    orderModel.find().populate("user", "name phoneNumber").populate("address"),
    query
  )
    .search(orderSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await orderQuery.modelQuery;
  const meta = await orderQuery.countTotal();

  return { meta, result };
};

const getSingleOrderFromDB = async (orderId: string, requester: TRequester) => {
  const order = await orderModel
    .findById(orderId)
    .populate("address")
    .populate("user", "name phoneNumber");

  if (!order) {
    throw new AppError(404, "Order not found");
  }

  const orderUserId = String((order.user as any)?._id ?? order.user);
  const isOwner = orderUserId === requester.id;
  const isStaff = requester.role === "admin" || requester.role === "stuff";

  if (!isOwner && !isStaff) {
    throw new AppError(403, "You are not allowed to view this order");
  }

  const items = await orderItemModel.find({ order: order._id });

  return { ...order.toObject(), items };
};

/**
 * Public order lookup for guests who have no way to log in yet (their
 * account has a random, unusable password). Requires knowing BOTH the
 * exact orderNumber AND the phone number the account was created with —
 * that pair acts as a shared secret so a stranger can't browse someone
 * else's order just by guessing an order number.
 */

const trackOrderFromDB = async (orderNumber: string, phoneNumber: string) => {
  const order = await orderModel
    .findOne({ orderNumber })
    .populate("user", "phoneNumber")
    .populate("address");

  const orderUserPhone = (order?.user as any)?.phoneNumber;

  if (!order || orderUserPhone !== phoneNumber) {
    throw new AppError(
      404,
      "No order found for that order number and phone number"
    );
  }

  const items = await orderItemModel.find({ order: order._id });

  return { ...order.toObject(), items };
};

const STATUS_FLOW: Record<TOrderStatus, TOrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

/**
 * Restocks every item on the order, atomically, then marks it cancelled.
 */
const cancelOrderIntoDB = async (orderId: string) => {
  const order = await orderModel.findById(orderId);
  if (!order) {
    throw new AppError(404, "Order not found");
  }

  if (["shipped", "delivered", "cancelled"].includes(order.status)) {
    throw new AppError(
      400,
      `An order that is already "${order.status}" cannot be cancelled`
    );
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const items = await orderItemModel
      .find({ order: orderId })
      .session(session);

    for (const item of items) {
      await productVariantModel.findByIdAndUpdate(
        item.variant,
        { $inc: { stock: item.quantity } },
        { session }
      );
    }

    const result = await orderModel.findByIdAndUpdate(
      orderId,
      { status: "cancelled" },
      { new: true, session }
    );

    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const cancelMyOrderIntoDB = async (orderId: string, userId: string) => {
  const order = await orderModel.findById(orderId);
  if (!order) {
    throw new AppError(404, "Order not found");
  }
  if (String(order.user) !== userId) {
    throw new AppError(403, "This order does not belong to you");
  }
  // Customers can self-cancel early; once it's being packed/shipped,
  // they need to contact support instead.
  if (!["pending", "confirmed"].includes(order.status)) {
    throw new AppError(
      400,
      "This order can no longer be self-cancelled — please contact support"
    );
  }

  return cancelOrderIntoDB(orderId);
};

const updateOrderStatusIntoDB = async (
  orderId: string,
  nextStatus: TOrderStatus
) => {
  const order = await orderModel.findById(orderId);
  if (!order) {
    throw new AppError(404, "Order not found");
  }

  const allowedNext = STATUS_FLOW[order.status as TOrderStatus];
  if (!allowedNext.includes(nextStatus)) {
    throw new AppError(
      400,
      `Cannot move an order from "${order.status}" to "${nextStatus}"`
    );
  }

  if (nextStatus === "cancelled") {
    return cancelOrderIntoDB(orderId);
  }

  const result = await orderModel.findByIdAndUpdate(
    orderId,
    { status: nextStatus },
    { new: true }
  );

  return result;
};

/**
 * Retry hook for when the initial bKash createPayment call failed after
 * the order was already committed — or for a COD order the customer
 * decides to pay online after all.
 */
const initiateBkashPaymentIntoDB = async (orderId: string, userId: string) => {
  const order = await orderModel.findById(orderId);
  if (!order) {
    throw new AppError(404, "Order not found");
  }
  if (String(order.user) !== userId) {
    throw new AppError(403, "This order does not belong to you");
  }
  if (order.paymentStatus === "paid") {
    throw new AppError(400, "This order has already been paid");
  }
  if (order.status === "cancelled") {
    throw new AppError(400, "This order has been cancelled");
  }

  const bkashPayment = await BkashService.createPayment({
    amount: order.total,
    orderNumber: order.orderNumber,
    payerReference: userId,
  });

  order.bkashPaymentID = bkashPayment.paymentID;
  order.paymentMethod = "bkash";
  await order.save();

  return { bkashURL: bkashPayment.bkashURL };
};

/**
 * bKash redirects the customer's browser back here with ?paymentID&status.
 * "status" from bKash is just their redirect hint — executePayment is the
 * real source of truth and is what actually finalizes the transaction.
 */
const handleBkashCallbackIntoDB = async (paymentID: string, status: string) => {
  const order = await orderModel.findOne({ bkashPaymentID: paymentID });
  if (!order) {
    throw new AppError(404, "Order not found for this payment");
  }

  if (status !== "success") {
    order.paymentStatus = "failed";
    await order.save();
    return { order, redirectStatus: "failed" as const };
  }

  const result = await BkashService.executePayment(paymentID);

  if (result.transactionStatus === "Completed") {
    order.paymentStatus = "paid";
    order.bkashTrxID = result.trxID;
    if (order.status === "pending") {
      order.status = "confirmed";
    }
    await order.save();
    return { order, redirectStatus: "success" as const };
  }

  order.paymentStatus = "failed";
  await order.save();
  return { order, redirectStatus: "failed" as const };
};

export const OrderServices = {
  guestCheckoutIntoDB,
  trackOrderFromDB,
  getMyOrdersFromDB,
  getAllOrdersFromDB,
  getSingleOrderFromDB,
  cancelMyOrderIntoDB,
  updateOrderStatusIntoDB,
  initiateBkashPaymentIntoDB,
  handleBkashCallbackIntoDB,
};