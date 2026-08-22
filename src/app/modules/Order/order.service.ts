import mongoose from "mongoose";
import httpStatus from "http-status";
import type { TCreateOrderInput, TOrderStatus, TPaymentStatus } from "./order.interface.ts";
import { addressModel } from "../Address/address.model.ts";
import AppError from "../../error/AppError.ts";
import { productVariantModel } from "../ProductVariant/productVariant.model.ts";
import { productModel } from "../Product/product.model.ts";
import { couponModel } from "../Coupon/coupon.model.ts";
import { orderModel } from "./order.model.ts";
import { orderItemModel } from "../OrderItem/orderItem.model.ts";
import { userModel } from "../User/user.model.ts";
import { Bkash } from "../../utils/bkash.ts";
import QueryBuilder from "../../builder/QueryBuilder.ts";

const SHIPPING_COST = 60;
const DUMMY_PASSWORD = "123456";

const generateOrderNumber = () =>
  `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

// ── Resolve (or create) the user placing the order ───────────────
const resolveOrderUser = async (
  authUserId: string | undefined,
  payload: Pick<TCreateOrderInput, "fullName" | "phoneNumber" | "email">,
  session: mongoose.ClientSession
) => {
  if (authUserId) {
    const existing = await userModel.findById(authUserId).session(session);
    if (!existing) {
      throw new AppError(httpStatus.NOT_FOUND, "User not found");
    }
    return existing;
  }

  const existingByPhone = await userModel
    .findOne({ phone: payload.phoneNumber })
    .session(session);
  if (existingByPhone) {
    return existingByPhone;
  }

  const newUser = new userModel({
    name: payload.fullName,
    phoneNumber: payload.phoneNumber,
    email: payload.email,
    password: DUMMY_PASSWORD, // hashed by the User model's pre-save hook
    role: "customer",
  });
  await newUser.save({ session });

  return newUser;
};

// ── Create order ────────────────────────────────────────────────
const createOrderIntoDB = async (
  authUserId: string | undefined,
  payload: TCreateOrderInput
) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // 1. Resolve user
    const user = await resolveOrderUser(
      authUserId,
      { fullName: payload.fullName, phoneNumber: payload.phoneNumber, email: payload.email },
      session
    );

    // 2. Create the delivery address
    const newAddress = new addressModel({
      user: user._id,
      fullName: payload.fullName,
      phoneNumber: payload.phoneNumber,
      address: payload.address,
      district: payload.district,
      upazila: payload.upazila,
      postalCode: payload.postalCode,
      isDefault: false,
    });
    await newAddress.save({ session });

    // 3. Validate every item, compute price from DB (never trust client price)
    let subtotal = 0;
    const orderItemsData = [];

    for (const item of payload.items) {
      const variant = await productVariantModel
        .findById(item.variant)
        .session(session);
      if (!variant || variant.product.toString() !== item.product) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          `Invalid product/variant combination`
        );
      }
      if (variant.stock < item.quantity) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          `Insufficient stock for SKU ${variant.sku}`
        );
      }

      const product = await productModel.findById(item.product).session(session);
      if (!product) {
        throw new AppError(httpStatus.NOT_FOUND, "Product not found");
      }

      const lineTotal = variant.price * item.quantity;
      subtotal += lineTotal;

      orderItemsData.push({
        product: product._id,
        variant: variant._id,
        productName: product.name,
        sku: variant.sku,
        size: variant.size,
        color: variant.color,
        price: variant.price,
        quantity: item.quantity,
        total: lineTotal,
      });

      variant.stock -= item.quantity;
      await variant.save({ session });
    }

    // 4. Apply coupon (if any)
    let discount = 0;
    let couponId = undefined;
    if (payload.coupon) {
      const coupon = await couponModel
        .findOne({ _id: payload.coupon, isActive: true })
        .session(session);
      if (!coupon) {
        throw new AppError(httpStatus.BAD_REQUEST, "Invalid or expired coupon");
      }
      discount =
        coupon.type === "percentage"
          ? (subtotal * coupon.value) / 100
          : coupon.value;
      discount = Math.min(discount, subtotal);
      couponId = coupon._id;
    }

    const shippingCost = SHIPPING_COST;
    const total = subtotal - discount + shippingCost;

    // 5. Create order
    const orderNumber = generateOrderNumber();
    const newOrder = new orderModel({
      user: user._id,
      orderNumber,
      address: newAddress._id,
      subtotal,
      discount,
      shippingCost,
      total,
      coupon: couponId,
      paymentMethod: payload.paymentMethod,
      status: "pending",
      paymentStatus: "pending",
    });
    await newOrder.save({ session });

    // 6. Create order items — insertMany's overload is fine with arrays,
    // this one wasn't the source of your error, left as-is
    await orderItemModel.insertMany(
      orderItemsData.map((item) => ({ ...item, order: newOrder._id })),
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    // 7. If bKash, kick off payment creation (outside the DB transaction)
    if (payload.paymentMethod === "bkash") {
      const bkashPayment = await Bkash.createPayment({
        amount: total,
        orderNumber,
        payerReference: payload.phoneNumber,
      });

      newOrder.bkash = {
        paymentID: bkashPayment.paymentID,
        paymentCreateTime: bkashPayment.paymentCreateTime,
        amount: total,
      };
      await newOrder.save();

      return { order: newOrder, bkashURL: bkashPayment.bkashURL };
    }

    return { order: newOrder, bkashURL: null };
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    await session.endSession();
    throw error;
  }
};

// ── everything below is unchanged from before ────────────────────

const executeBkashPaymentIntoDB = async (paymentID: string) => {
  const order = await orderModel.findOne({ "bkash.paymentID": paymentID });
  if (!order) {
    throw new AppError(httpStatus.NOT_FOUND, "Order not found for this payment");
  }

  const result = await Bkash.executePayment(paymentID);

  if (result.transactionStatus === "Completed") {
    order.paymentStatus = "paid";
    order.status = "confirmed";
    order.bkash = {
      ...order.bkash,
      trxID: result.trxID,
      transactionStatus: result.transactionStatus,
      paymentExecuteTime: result.paymentExecuteTime,
    };
  } else {
    order.paymentStatus = "failed";
    order.bkash = {
      ...order.bkash,
      transactionStatus: result.transactionStatus || "Failed",
    };
  }

  await order.save();
  return order;
};

const getAllOrdersFromDB = async (
  query: Record<string, unknown>,
  authUser: { id: string; role: string }
) => {
  const baseQuery = authUser.role === "customer" ? { user: authUser.id } : {};

  const orderQuery = new QueryBuilder(
    orderModel.find(baseQuery).populate("address").populate("coupon"),
    query
  )
    .search(["orderNumber"])
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await orderQuery.modelQuery;
  const meta = await orderQuery.countTotal();

  return { result, meta };
};

const getSingleOrderFromDB = async (
  orderId: string,
  authUser: { id: string; role: string }
) => {
  const order = await orderModel.findById(orderId).populate("address").populate("coupon");

  if (!order) {
    throw new AppError(httpStatus.NOT_FOUND, "Order not found");
  }
  if (authUser.role === "customer" && order.user.toString() !== authUser.id) {
    throw new AppError(httpStatus.FORBIDDEN, "You cannot access this order");
  }

  const items = await orderItemModel.find({ order: order._id });
  return { order, items };
};

const updateOrderStatusInDB = async (orderId: string, status: TOrderStatus) => {
  const order = await orderModel.findByIdAndUpdate(
    orderId,
    { status },
    { new: true, runValidators: true }
  );
  if (!order) {
    throw new AppError(httpStatus.NOT_FOUND, "Order not found");
  }
  return order;
};

const updatePaymentStatusInDB = async (
  orderId: string,
  paymentStatus: TPaymentStatus
) => {
  const order = await orderModel.findByIdAndUpdate(
    orderId,
    { paymentStatus },
    { new: true, runValidators: true }
  );
  if (!order) {
    throw new AppError(httpStatus.NOT_FOUND, "Order not found");
  }
  return order;
};

const cancelOrderInDB = async (
  orderId: string,
  authUser: { id: string; role: string }
) => {
  const order = await orderModel.findById(orderId);
  if (!order) {
    throw new AppError(httpStatus.NOT_FOUND, "Order not found");
  }
  if (authUser.role === "customer" && order.user.toString() !== authUser.id) {
    throw new AppError(httpStatus.FORBIDDEN, "You cannot cancel this order");
  }
  if (!["pending", "confirmed"].includes(order.status)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Order cannot be cancelled once it is ${order.status}`
    );
  }

  order.status = "cancelled";

  const items = await orderItemModel.find({ order: order._id });
  for (const item of items) {
    await productVariantModel.findByIdAndUpdate(item.variant, {
      $inc: { stock: item.quantity },
    });
  }

  if (order.paymentMethod === "bkash" && order.paymentStatus === "paid") {
    order.paymentStatus = "refunded";
  }

  await order.save();
  return order;
};

export const OrderServices = {
  createOrderIntoDB,
  executeBkashPaymentIntoDB,
  getAllOrdersFromDB,
  getSingleOrderFromDB,
  updateOrderStatusInDB,
  updatePaymentStatusInDB,
  cancelOrderInDB,
};