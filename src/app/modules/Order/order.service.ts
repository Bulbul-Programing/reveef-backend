import mongoose, { Types } from "mongoose";
import { orderModel } from "./order.model.ts";
import type {
  TOrderStatus,
  TPaymentMethod,
  TUpdateOrderPayload,
} from "./order.interface.ts";
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
import { userModel } from "../User/user.model.ts";
import { addressModel } from "../Address/address.model.ts";

const orderSearchableFields = ["orderNumber"];

const DEFAULT_SHIPPING_COST = 120;

const generateOrderNumber = async () => {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");

  let orderNumber = "";
  let isUnique = false;

  while (!isUnique) {
    const randomPart = Math.floor(1000 + Math.random() * 9000);

    orderNumber = `ORD-${datePart}-${randomPart}`;

    const existing = await orderModel.findOne({ orderNumber });

    if (!existing) {
      isUnique = true;
    }
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
    divition: string;
    district: string;
    upazila: string;
    postalCode?: string;
  };

  items: {
    variant: string;
    quantity: number;
  }[];

  paymentMethod: TPaymentMethod;
  couponCode?: string;
};

/**
 * Guest-first checkout
 *
 * Creates:
 * - User
 * - Address
 * - Order
 * - Order items
 * - Stock deduction
 *
 * Everything is handled inside one transaction.
 */
const guestCheckoutIntoDB = async (
  payload: TGuestCheckoutPayload
) => {
  const user = await UserServices.findOrCreateGuestUserIntoDB({
    name: payload.name,
    phoneNumber: payload.phoneNumber,
  });

  const address = await AddressServices.findOrCreateAddressIntoDB(
    String(user._id),
    {
      fullName: payload.address.fullName,
      phoneNumber:
        payload.address.phoneNumber || payload.phoneNumber,
      address: payload.address.address,
      divition: payload.address.divition,
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

    // ---------------------------------------------------------
    // Process products / variants / stock
    // ---------------------------------------------------------

    for (const item of payload.items) {
      const variant = await productVariantModel
        .findById(item.variant)
        .session(session);

      if (!variant || !variant.isActive) {
        throw new AppError(
          404,
          "One of the selected items is unavailable"
        );
      }

      const product = await productModel
        .findById(variant.product)
        .session(session);

      if (!product || !product.isActive) {
        throw new AppError(
          404,
          "One of the selected products is unavailable"
        );
      }

      const deducted = await productVariantModel.findOneAndUpdate(
        {
          _id: variant._id,
          stock: { $gte: item.quantity },
        },
        {
          $inc: {
            stock: -item.quantity,
          },
        },
        {
          new: true,
          session,
        }
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

    // ---------------------------------------------------------
    // Coupon validation
    // ---------------------------------------------------------

    let discount = 0;

    let couponId: Types.ObjectId | undefined = undefined;

    if (payload.couponCode) {
      const coupon = await couponModel
        .findOne({
          code: payload.couponCode.trim().toUpperCase(),
        })
        .session(session);

      if (!coupon) {
        throw new AppError(400, "Coupon code not found");
      }

      if (!coupon.isActive) {
        throw new AppError(
          400,
          "This coupon is no longer active"
        );
      }

      const now = new Date();

      if (coupon.startDate > now) {
        throw new AppError(
          400,
          "This coupon is not active yet"
        );
      }

      if (coupon.expiryDate < now) {
        throw new AppError(
          400,
          "This coupon has expired"
        );
      }

      if (
        typeof coupon.usageLimit === "number" &&
        (coupon.usedCount ?? 0) >= coupon.usageLimit
      ) {
        throw new AppError(
          400,
          "This coupon has reached its usage limit"
        );
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

      if (
        coupon.type === "percentage" &&
        typeof coupon.maximumDiscount === "number"
      ) {
        discount = Math.min(
          discount,
          coupon.maximumDiscount
        );
      }

      // Never allow discount to exceed subtotal
      discount = Math.min(discount, subtotal);

      couponId = coupon._id;

      // Atomically increase coupon usage
      if (typeof coupon.usageLimit === "number") {
        const bumped = await couponModel.findOneAndUpdate(
          {
            _id: coupon._id,
            usedCount: {
              $lt: coupon.usageLimit,
            },
          },
          {
            $inc: {
              usedCount: 1,
            },
          },
          {
            new: true,
            session,
          }
        );

        if (!bumped) {
          throw new AppError(
            400,
            "This coupon has just reached its usage limit"
          );
        }
      } else {
        await couponModel.updateOne(
          {
            _id: coupon._id,
          },
          {
            $inc: {
              usedCount: 1,
            },
          },
          {
            session,
          }
        );
      }
    }

    // ---------------------------------------------------------
    // Calculate total
    // ---------------------------------------------------------

    const shippingCost =
      payload.address.district.toLowerCase() === "dhaka"
        ? 70
        : DEFAULT_SHIPPING_COST;

    const total =
      subtotal - discount + shippingCost;

    const orderNumber = await generateOrderNumber();

    // ---------------------------------------------------------
    // Create order
    // ---------------------------------------------------------

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

      // Initial status history
      statusLog: [
        {
          changedBy: user._id,

          fromStatus: undefined,

          toStatus: "pending",

          note: "Order placed",
        },
      ],

      paymentMethod: payload.paymentMethod,

      paymentStatus: "pending",
    });

    await createdOrder.save({
      session,
    });

    order = createdOrder;

    // ---------------------------------------------------------
    // Create order items
    // ---------------------------------------------------------

    orderItems = await orderItemModel.insertMany(
      orderItemsData.map((item) => ({
        ...item,
        order: order._id,
      })),
      {
        session,
      }
    );

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();

    throw error;
  } finally {
    session.endSession();
  }

  // ---------------------------------------------------------
  // bKash payment
  // ---------------------------------------------------------

  let bkashURL: string | undefined;

  if (payload.paymentMethod === "bkash") {
    try {
      const bkashPayment =
        await BkashService.createPayment({
          amount: order.total,

          orderNumber: order.orderNumber,

          payerReference: String(user._id),
        });

      order.bkashPaymentID =
        bkashPayment.paymentID;

      await order.save();

      bkashURL = bkashPayment.bkashURL;
    } catch {
      // Order still exists with paymentStatus "pending".
      // Client can retry payment later.
    }
  }

  return {
    order,
    items: orderItems,
    user,
    bkashURL,
  };
};

// ============================================================
// GET MY ORDERS
// ============================================================

const getMyOrdersFromDB = async (
  userId: string,
  query: Record<string, unknown>
) => {
  // =========================================================
  // ORDER FILTER
  // =========================================================

  const orderFilter: Record<string, unknown> = {
    user: userId,
  };

  const searchTerm = query.searchTerm as string;

  // =========================================================
  // SEARCH
  // =========================================================

  if (searchTerm) {
    const regex = new RegExp(searchTerm, "i");

    // -------------------------------------------------------
    // Search addresses
    // -------------------------------------------------------

    const addresses = await addressModel
      .find({
        user: userId,
        $or: [
          {
            address: regex,
          },
          {
            district: regex,
          },
          {
            upazila: regex,
          },
        ],
      })
      .select("_id");

    const addressIds = addresses.map(
      (address) => address._id
    );

    // -------------------------------------------------------
    // Search order items
    // -------------------------------------------------------

    const orderItems = await orderItemModel
      .find({
        productName: regex,
      })
      .select("order");

    const orderIdsFromItems = orderItems.map(
      (item) => item.order
    );

    // -------------------------------------------------------
    // Search order
    // -------------------------------------------------------

    orderFilter.$or = [
      {
        orderNumber: regex,
      },
      {
        address: {
          $in: addressIds,
        },
      },
      {
        _id: {
          $in: orderIdsFromItems,
        },
      },
    ];
  }

  // =========================================================
  // QUERY BUILDER
  // =========================================================

  const orderQuery = new QueryBuilder(
    orderModel
      .find(orderFilter)
      .populate(
        "user",
        "name phoneNumber"
      )
      .populate("address")
      .populate(
        "statusLog.changedBy",
        "name phoneNumber role"
      )
      .populate(
        "coupon",
        "name type value minimumPurchase usageLimit usedCount"
      ),
    query
  )
    .filter()
    .dateRange("createdAt")
    .sort()
    .paginate()
    .fields();

  const result = await orderQuery.modelQuery;

  // =========================================================
  // GET ORDER ITEMS
  // =========================================================

  const orderIds = result.map(
    (order) => order._id
  );

  const orderItems = await orderItemModel
    .find({
      order: {
        $in: orderIds,
      },
    })
    .populate({
      path: "product",
      select:
        "name slug basePrice discountPrice",
      populate: {
        path: "images",
        select:
          "url alt sortOrder",
      },
    })
    .populate(
      "variant",
      "color sku size price stock image"
    );

  // =========================================================
  // ATTACH ITEMS TO ORDERS
  // =========================================================

  const resultWithItems = result.map(
    (order) => ({
      ...order.toObject(),
      items: orderItems.filter(
        (item) =>
          item.order.toString() ===
          order._id.toString()
      ),
    })
  );

  // =========================================================
  // META
  // =========================================================

  const meta =
    await orderQuery.countTotal();

  return {
    meta,
    result: resultWithItems,
  };
};

// ============================================================
// GET ALL ORDERS
// ============================================================

const getAllOrdersFromDB = async (
  query: Record<string, unknown>
) => {
  const searchTerm = query.searchTerm as string;

  const orderFilter: Record<string, unknown> = {};

  // =========================================================
  // SEARCH
  // =========================================================

  if (searchTerm) {
    const regex = new RegExp(searchTerm, "i");

    // -----------------------------------------------------
    // Search users
    // -----------------------------------------------------

    const users = await userModel
      .find({
        $or: [
          {
            name: regex,
          },
          {
            phoneNumber: regex,
          },
        ],
      })
      .select("_id");

    const userIds = users.map(
      (user) => user._id
    );

    // -----------------------------------------------------
    // Search addresses
    // -----------------------------------------------------

    const addresses = await addressModel
      .find({
        $or: [
          {
            address: regex,
          },
          {
            district: regex,
          },
          {
            upazila: regex,
          },
        ],
      })
      .select("_id");

    const addressIds = addresses.map(
      (address) => address._id
    );

    // -----------------------------------------------------
    // Search order items
    // -----------------------------------------------------

    const orderItems = await orderItemModel
      .find({
        productName: regex,
      })
      .select("order");

    const orderIdsFromItems = orderItems.map(
      (item) => item.order
    );

    // -----------------------------------------------------
    // Search order
    // -----------------------------------------------------

    orderFilter.$or = [
      {
        orderNumber: regex,
      },
      {
        user: {
          $in: userIds,
        },
      },
      {
        address: {
          $in: addressIds,
        },
      },
      {
        _id: {
          $in: orderIdsFromItems,
        },
      },
    ];
  }

  // =========================================================
  // QUERY BUILDER
  // =========================================================

  const orderQuery = new QueryBuilder(
    orderModel
      .find(orderFilter)
      .populate(
        "user",
        "name phoneNumber"
      )
      .populate("address")
      .populate(
        "statusLog.changedBy",
        "name phoneNumber role"
      )
      .populate(
        "coupon",
        "name type value minimumPurchase usageLimit usedCount"
      ),
    query
  )
    .filter()
    .dateRange("createdAt")
    .sort()
    .paginate()
    .fields();

  const result = await orderQuery.modelQuery;

  // =========================================================
  // GET ORDER ITEMS
  // =========================================================

  const orderIds = result.map(
    (order) => order._id
  );

  const orderItems = await orderItemModel
    .find({
      order: {
        $in: orderIds,
      },
    })
    .populate({
      path: "product",
      select:
        "name slug basePrice discountPrice",
      populate: {
        path: "images",
        select:
          "url alt sortOrder",
      },
    })
    .populate(
      "variant",
      "color sku size price stock image"
    );

  // =========================================================
  // ATTACH ITEMS TO ORDERS
  // =========================================================

  const resultWithItems = result.map(
    (order) => ({
      ...order.toObject(),

      items: orderItems.filter(
        (item) =>
          item.order.toString() ===
          order._id.toString()
      ),
    })
  );

  // =========================================================
  // META
  // =========================================================

  const meta =
    await orderQuery.countTotal();

  return {
    meta,
    result: resultWithItems,
  };
};

// ============================================================
// GET SINGLE ORDER
// ============================================================

const getSingleOrderFromDB = async (
  orderId: string,
  // requester: TRequester
) => {
  const order = await orderModel
    .findById(orderId)

    .populate("address")

    .populate(
      "user",
      "name phoneNumber"
    )

    .populate(
      "statusLog.changedBy",
      "name phoneNumber role"
    );

  if (!order) {
    throw new AppError(
      404,
      "Order not found"
    );
  }

  const orderUserId = String(
    (order.user as any)?._id ??
    order.user
  );

  // const isOwner =
  //   orderUserId === requester.id;

  // const isStaff =
  //   requester.role === "admin" ||
  //   requester.role === "stuff";

  // if (!isOwner && !isStaff) {
  //   throw new AppError(
  //     403,
  //     "You are not allowed to view this order"
  //   );
  // }

  const items =
    await orderItemModel.find({
      order: order._id,
    });

  return {
    ...order.toObject(),
    items,
  };
};

// ============================================================
// TRACK ORDER
// ============================================================

/**
 * Public order lookup for guests.
 *
 * Requires:
 * - exact orderNumber
 * - phoneNumber
 */

const trackOrderFromDB = async (
  orderNumber: string,
  phoneNumber: string
) => {
  const order = await orderModel
    .findOne({
      orderNumber,
    })

    .populate(
      "user",
      "phoneNumber"
    )

    .populate("address")

    .populate(
      "statusLog.changedBy",
      "name phoneNumber role"
    );

  const orderUserPhone =
    (order?.user as any)?.phoneNumber;

  if (
    !order ||
    orderUserPhone !== phoneNumber
  ) {
    throw new AppError(
      404,
      "No order found for that order number and phone number"
    );
  }

  const items =
    await orderItemModel.find({
      order: order._id,
    });

  return {
    ...order.toObject(),
    items,
  };
};

// ============================================================
// ORDER STATUS FLOW
// ============================================================

const STATUS_FLOW: Record<
  TOrderStatus,
  TOrderStatus[]
> = {
  pending: [
    "confirmed",
    "cancelled",
  ],

  confirmed: [
    "processing",
    "cancelled",
  ],

  processing: [
    "shipped",
    "cancelled",
  ],

  shipped: [
    "delivered",
  ],

  delivered: [],

  cancelled: [],
};

// ============================================================
// CANCEL ORDER
// ============================================================

/**
 * Restocks every item on the order
 * and marks the order as cancelled.
 *
 * Status history is also updated
 * inside the same transaction.
 */

const cancelOrderIntoDB = async (
  orderId: string,
  changedBy: string,
  note?: string
) => {
  const order =
    await orderModel.findById(orderId);

  if (!order) {
    throw new AppError(
      404,
      "Order not found"
    );
  }

  if (
    [
      "shipped",
      "delivered",
      "cancelled",
    ].includes(order.status)
  ) {
    throw new AppError(
      400,
      `An order that is already "${order.status}" cannot be cancelled`
    );
  }

  const session =
    await mongoose.startSession();

  try {
    session.startTransaction();

    // ---------------------------------------------------------
    // Restore stock
    // ---------------------------------------------------------

    const items =
      await orderItemModel
        .find({
          order: orderId,
        })
        .session(session);

    for (const item of items) {
      await productVariantModel.findByIdAndUpdate(
        item.variant,
        {
          $inc: {
            stock: item.quantity,
          },
        },
        {
          session,
        }
      );
    }

    // ---------------------------------------------------------
    // Update status + status history
    // ---------------------------------------------------------

    const result =
      await orderModel.findByIdAndUpdate(
        orderId,
        {
          $set: {
            status: "cancelled",
          },

          $push: {
            statusLog: {
              changedBy:
                new Types.ObjectId(
                  changedBy
                ),

              fromStatus:
                order.status,

              toStatus:
                "cancelled",

              note:
                note ||
                "Order cancelled",
            },
          },
        },
        {
          new: true,
          session,
        }
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

// ============================================================
// CUSTOMER CANCEL ORDER
// ============================================================

const cancelMyOrderIntoDB = async (
  orderId: string,
  userId: string
) => {
  const order =
    await orderModel.findById(orderId);

  if (!order) {
    throw new AppError(
      404,
      "Order not found"
    );
  }

  if (
    String(order.user) !== userId
  ) {
    throw new AppError(
      403,
      "This order does not belong to you"
    );
  }

  // Customers can only self-cancel
  // pending or confirmed orders.
  if (
    ![
      "pending",
      "confirmed",
    ].includes(order.status)
  ) {
    throw new AppError(
      400,
      "This order can no longer be self-cancelled — please contact support"
    );
  }

  return cancelOrderIntoDB(
    orderId,
    userId,
    "Order cancelled by customer"
  );
};

// ============================================================
// UPDATE ORDER STATUS
// ============================================================

/**
 * This is the ONLY service responsible
 * for normal order status transitions.
 *
 * Example:
 *
 * pending -> confirmed
 * confirmed -> processing
 * processing -> shipped
 * shipped -> delivered
 */

const updateOrderStatusIntoDB = async (
  orderId: string,
  nextStatus: TOrderStatus,
  changedBy: string,
  note?: string
) => {
  const order =
    await orderModel.findById(orderId);

  if (!order) {
    throw new AppError(
      404,
      "Order not found"
    );
  }

  const currentStatus =
    order.status as TOrderStatus;

  const allowedNext =
    STATUS_FLOW[currentStatus];

  if (
    !allowedNext.includes(
      nextStatus
    )
  ) {
    throw new AppError(
      400,
      `Cannot move an order from "${currentStatus}" to "${nextStatus}"`
    );
  }

  // ---------------------------------------------------------
  // Cancellation
  // ---------------------------------------------------------

  if (
    nextStatus === "cancelled"
  ) {
    return cancelOrderIntoDB(
      orderId,
      changedBy,
      note || "Order cancelled"
    );
  }

  // ---------------------------------------------------------
  // Normal status change
  // ---------------------------------------------------------

  const result =
    await orderModel.findByIdAndUpdate(
      orderId,
      {
        $set: {
          status: nextStatus,
        },

        $push: {
          statusLog: {
            changedBy:
              new Types.ObjectId(
                changedBy
              ),

            fromStatus:
              currentStatus,

            toStatus:
              nextStatus,

            note,
          },
        },
      },
      {
        new: true,
      }
    );
  return result;
};

// ============================================================
// INITIATE BKASH PAYMENT
// ============================================================

/**
 * Retry hook for when the initial
 * bKash createPayment call failed.
 *
 * Also useful when a COD order
 * wants to pay online later.
 */

const initiateBkashPaymentIntoDB = async (
  orderId: string,
  userId: string
) => {
  const order =
    await orderModel.findById(orderId);

  if (!order) {
    throw new AppError(
      404,
      "Order not found"
    );
  }

  if (
    String(order.user) !== userId
  ) {
    throw new AppError(
      403,
      "This order does not belong to you"
    );
  }

  if (
    order.paymentStatus === "paid"
  ) {
    throw new AppError(
      400,
      "This order has already been paid"
    );
  }

  if (
    order.status === "cancelled"
  ) {
    throw new AppError(
      400,
      "This order has been cancelled"
    );
  }

  const bkashPayment =
    await BkashService.createPayment({
      amount: order.total,

      orderNumber:
        order.orderNumber,

      payerReference: userId,
    });

  order.bkashPaymentID =
    bkashPayment.paymentID;

  order.paymentMethod =
    "bkash";

  await order.save();

  return {
    bkashURL:
      bkashPayment.bkashURL,
  };
};

// ============================================================
// BKASH CALLBACK
// ============================================================

/**
 * bKash redirects customer's browser
 * back here with:
 *
 * ?paymentID&status
 *
 * executePayment() is the real source
 * of truth.
 */

const handleBkashCallbackIntoDB = async (
  paymentID: string,
  status: string
) => {
  const order =
    await orderModel.findOne({
      bkashPaymentID: paymentID,
    });

  if (!order) {
    throw new AppError(
      404,
      "Order not found for this payment"
    );
  }

  // ---------------------------------------------------------
  // bKash redirect failed
  // ---------------------------------------------------------

  if (status !== "success") {
    order.paymentStatus =
      "failed";

    await order.save();

    return {
      order,
      redirectStatus:
        "failed" as const,
    };
  }

  // ---------------------------------------------------------
  // Execute payment
  // ---------------------------------------------------------

  const result =
    await BkashService.executePayment(
      paymentID
    );

  // ---------------------------------------------------------
  // Payment successful
  // ---------------------------------------------------------

  if (
    result.transactionStatus ===
    "Completed"
  ) {
    order.paymentStatus =
      "paid";

    order.bkashTrxID =
      result.trxID;

    // -------------------------------------------------------
    // pending -> confirmed
    //
    // Only add history if the status
    // actually changes.
    // -------------------------------------------------------

    if (
      order.status === "pending"
    ) {
      const previousStatus =
        order.status;

      order.status =
        "confirmed";

      order.statusLog.push({
        changedBy:
          order.user,

        fromStatus:
          previousStatus,

        toStatus:
          "confirmed",

        note:
          "Order confirmed after successful bKash payment",

        createdAt:
          new Date(),

        updatedAt:
          new Date(),
      });
    }

    await order.save();

    return {
      order,
      redirectStatus:
        "success" as const,
    };
  }

  // ---------------------------------------------------------
  // Payment failed
  // ---------------------------------------------------------

  order.paymentStatus =
    "failed";

  await order.save();

  return {
    order,
    redirectStatus:
      "failed" as const,
  };
};

// ============================================================
// UPDATE ORDER INFORMATION
// ============================================================

/**
 * Updates:
 *
 * - Customer name
 * - Customer phone
 * - Address
 * - District
 * - Upazila
 * - Discount
 * - Shipping cost
 *
 * IMPORTANT:
 * This function does NOT update order.status.
 *
 * Status changes must go through:
 * updateOrderStatusIntoDB()
 */

const updateOrderIntoDB = async (
  orderId: string,
  payload: TUpdateOrderPayload
) => {
  const order =
    await orderModel
      .findById(orderId)
      .populate(
        "user",
        "name"
      );

  if (!order) {
    throw new AppError(
      404,
      "Order not found"
    );
  }

  if (
    [
      "delivered",
      "cancelled",
    ].includes(order.status)
  ) {
    throw new AppError(
      400,
      `An order that is already "${order.status}" cannot be edited`
    );
  }

  const session =
    await mongoose.startSession();

  try {
    session.startTransaction();

    // ---------------------------------------------------------
    // Update user name / phone
    // ---------------------------------------------------------

    if (
      payload.name ||
      payload.phoneNumber
    ) {
      await userModel.findByIdAndUpdate(
        order.user,
        {
          ...(payload.name && {
            name: payload.name,
          }),

          ...(payload.phoneNumber && {
            phoneNumber:
              payload.phoneNumber,
          }),
        },
        {
          session,
        }
      );

      await addressModel.findOneAndUpdate(
        {
          user: order.user._id,
        },
        {
          ...(payload.name && {
            fullName: payload.name,
          }),

          ...(payload.phoneNumber && {
            phoneNumber:
              payload.phoneNumber,
          }),
        },
        {
          session,
        }
      );
    }

    // ---------------------------------------------------------
    // IMPORTANT:
    //
    // status is intentionally NOT updated here.
    //
    // Use updateOrderStatusIntoDB()
    // for status changes.
    // ---------------------------------------------------------

    // ---------------------------------------------------------
    // Update address / district / upazila
    // ---------------------------------------------------------

    if (
      payload.address ||
      payload.district ||
      payload.upazila
    ) {
      await addressModel.findByIdAndUpdate(
        order.address,
        {
          ...(payload.address && {
            address:
              payload.address,
          }),

          ...(payload.district && {
            district:
              payload.district,
          }),

          ...(payload.upazila && {
            upazila:
              payload.upazila,
          }),
        },
        {
          session,
        }
      );

      // Recalculate shipping cost
      // based on district unless
      // manually overridden below.
      if (
        payload.district &&
        typeof payload.shippingCost !==
        "number"
      ) {
        order.shippingCost =
          payload.district.toLowerCase() ===
            "dhaka"
            ? 70
            : DEFAULT_SHIPPING_COST;
      }
    }

    // ---------------------------------------------------------
    // Discount
    // ---------------------------------------------------------

    if (
      typeof payload.discount ===
      "number"
    ) {
      if (
        payload.discount < 0 ||
        payload.discount >
        order.subtotal
      ) {
        throw new AppError(
          400,
          "Discount must be between 0 and the order subtotal"
        );
      }

      order.discount =
        payload.discount;
    }

    // ---------------------------------------------------------
    // Shipping cost
    // ---------------------------------------------------------

    if (
      typeof payload.shippingCost ===
      "number"
    ) {
      if (
        payload.shippingCost < 0
      ) {
        throw new AppError(
          400,
          "Shipping cost cannot be negative"
        );
      }

      order.shippingCost =
        payload.shippingCost;
    }

    // ---------------------------------------------------------
    // Recalculate total
    // ---------------------------------------------------------

    order.total =
      order.subtotal -
      order.discount +
      order.shippingCost;

    await order.save({
      session,
    });

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();

    throw error;
  } finally {
    session.endSession();
  }

  // ---------------------------------------------------------
  // Return updated order
  // ---------------------------------------------------------

  const updatedOrder =
    await orderModel
      .findById(orderId)
      .populate("address")
      .populate(
        "user",
        "name phoneNumber"
      )
      .populate(
        "statusLog.changedBy",
        "name phoneNumber role"
      );

  return {
    order: updatedOrder,
  };
};

// ============================================================
// EXPORT
// ============================================================

export const OrderServices = {
  guestCheckoutIntoDB,

  trackOrderFromDB,

  updateOrderIntoDB,

  getMyOrdersFromDB,

  getAllOrdersFromDB,

  getSingleOrderFromDB,

  cancelMyOrderIntoDB,

  updateOrderStatusIntoDB,

  initiateBkashPaymentIntoDB,

  handleBkashCallbackIntoDB,
};