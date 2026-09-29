/**
 * Additions for order.service.ts
 * -------------------------------
 * Paste these functions into your existing OrderServices file and add
 * them to the exported `OrderServices` object at the bottom (see the
 * export block at the end of this file for the exact names to add).
 *
 * Assumes:
 *  - `Address` model's collection name is "addresses" (Mongoose's default
 *    pluralization of `model<TAddress>('Address', ...)`). Adjust the
 *    `from` field in the $lookup stages below if you've overridden it.
 *  - Revenue/date calculations use `order.createdAt` (from `timestamps: true`).
 *  - `updateOrderIntoDB` needs `userModel` and `addressModel` imported
 *    directly (not just the `UserServices` / `AddressServices` wrappers
 *    already in your file) — see the imports below.
 */

import mongoose, { Types } from "mongoose";
import type { TPaymentMethod } from "./order.interface.ts";
// New imports needed at the top of order.service.ts:
import { userModel } from "../User/user.model.ts";
import { addressModel } from "../Address/address.model.ts";

// If you have a TPaymentStatus type in order.interface.ts, import and use
// that instead of this inline union.
type TPaymentStatus = "pending" | "paid" | "failed" | "refunded";

// ─────────────────────────────────────────────────────────────────
// 1. Update order (edits allowed only while order hasn't shipped)
// ─────────────────────────────────────────────────────────────────
//
// Design notes:
//  - `name` / `phone` patch the User document behind the order (the
//    account, not just this one order).
//  - `address` / `district` / `upazila` patch the Address document the
//    order points to. NOTE: if that Address doc is shared (e.g. it's
//    also the customer's saved default address, or reused on other
//    orders via findOrCreateAddressIntoDB's dedup), this edit changes
//    it everywhere it's referenced — not just on this order. If you
//    need per- order snapshots instead, clone the address into a new
//    doc here and point `order.address` at the clone.
//  - `paymentStatus` is intentionally NOT accepted. It must never be
//    settable by hand — it's only ever set by handleBkashCallbackIntoDB
//    (real bKash confirmation) or your COD/delivery-confirmation flow.
//    Allowing a manual paymentStatus write would let anyone mark an
//    order "paid" without money having moved.
//  - `paymentMethod`: switching TO "bkash" doesn't just flip the enum —
//    it kicks off a real bKash payment session and returns a `bkashURL`
//    the customer must actually complete; paymentStatus stays "pending"
//    until the callback confirms it. Switching AWAY from "bkash" is
//    blocked once a bKash transaction has actually completed
//    (`bkashTrxID` is set) or the order is already marked "paid" —
//    otherwise someone could dodge a bKash payment obligation by
//    quietly relabeling the order "cod" (or vice versa, claim a cod
//    order was "paid" by hijacking a stale bkash session).

type TUpdateOrderPayload = Partial<{
    name: string;
    phone: string;
    address: string;
    district: string;
    upazila: string;
    paymentMethod: TPaymentMethod;
    paymentStatus: TPaymentStatus; // rejected — see notes above
    discount: number;
    shippingCost: number;
}>;

const updateOrderIntoDB = async (
    orderId: string,
    payload: TUpdateOrderPayload
) => {
    const order = await orderModel.findById(orderId);
    if (!order) {
        throw new AppError(404, "Order not found");
    }

    if (["shipped", "delivered", "cancelled"].includes(order.status)) {
        throw new AppError(
            400,
            `An order that is already "${order.status}" cannot be edited`
        );
    }

    if (payload.paymentStatus) {
        throw new AppError(
            400,
            "paymentStatus cannot be set directly — it updates automatically once a bKash payment is confirmed or the order is settled on delivery"
        );
    }

    // Switching payment method is only a plain field change when moving
    // AWAY from bkash (or between cod/nagad/card); moving TO bkash needs a
    // real payment session, so that case is handled after the transaction
    // (see the bKash block below), not here.
    const switchingToBkash =
        !!payload.paymentMethod &&
        payload.paymentMethod === "bkash" &&
        order.paymentMethod !== "bkash";

    if (payload.paymentMethod && payload.paymentMethod !== order.paymentMethod) {
        if (order.paymentStatus === "paid") {
            throw new AppError(
                400,
                "Cannot change payment method on an order that has already been paid"
            );
        }
        if (!switchingToBkash && order.bkashTrxID) {
            throw new AppError(
                400,
                "This order already has a completed bKash transaction and its payment method can no longer be changed"
            );
        }
    }

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        // ---- name / phone → the User account behind this order ----
        if (payload.name || payload.phone) {
            await userModel.findByIdAndUpdate(
                order.user,
                {
                    ...(payload.name && { name: payload.name }),
                    ...(payload.phone && { phoneNumber: payload.phone }),
                },
                { session }
            );
        }

        // ---- address / district / upazila → the Address doc ----
        if (payload.address || payload.district || payload.upazila) {
            await addressModel.findByIdAndUpdate(
                order.address,
                {
                    ...(payload.address && { address: payload.address }),
                    ...(payload.district && { district: payload.district }),
                    ...(payload.upazila && { upazila: payload.upazila }),
                },
                { session }
            );

            // shipping cost depends on district (see guestCheckoutIntoDB) —
            // recompute unless the caller is also manually overriding it below
            if (payload.district && typeof payload.shippingCost !== "number") {
                order.shippingCost =
                    payload.district.toLowerCase() === "dhaka" ? 70 : DEFAULT_SHIPPING_COST;
            }
        }

        // ---- paymentMethod: plain change (not the bkash-init case) ----
        if (payload.paymentMethod && !switchingToBkash) {
            order.paymentMethod = payload.paymentMethod;
        }

        // ---- discount / shippingCost (manual overrides win over the
        // district-based recompute above) ----
        if (typeof payload.discount === "number") {
            if (payload.discount < 0 || payload.discount > order.subtotal) {
                throw new AppError(
                    400,
                    "Discount must be between 0 and the order subtotal"
                );
            }
            order.discount = payload.discount;
        }

        if (typeof payload.shippingCost === "number") {
            if (payload.shippingCost < 0) {
                throw new AppError(400, "Shipping cost cannot be negative");
            }
            order.shippingCost = payload.shippingCost;
        }

        order.total = order.subtotal - order.discount + order.shippingCost;

        await order.save({ session });
        await session.commitTransaction();
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }

    // ---- Switching to bkash: create the real payment session AFTER the
    // transaction commits (same reasoning as guestCheckoutIntoDB — a
    // third-party network call can't live inside a DB transaction). ----
    let bkashURL: string | undefined;
    if (switchingToBkash) {
        try {
            const bkashPayment = await BkashService.createPayment({
                amount: order.total,
                orderNumber: order.orderNumber,
                payerReference: String(order.user),
            });
            order.paymentMethod = "bkash";
            order.bkashPaymentID = bkashPayment.paymentID;
            await order.save();
            bkashURL = bkashPayment.bkashURL;
        } catch {
            throw new AppError(
                502,
                "Order was updated but starting the bKash payment failed — retry via the bKash payment endpoint"
            );
        }
    }

    const updatedOrder = await orderModel
        .findById(orderId)
        .populate("address")
        .populate("user", "name phoneNumber");

    return { order: updatedOrder, bkashURL };
};

// ─────────────────────────────────────────────────────────────────
// 2. Order stats for a date range (used by today/7d/30d/custom below)
// ─────────────────────────────────────────────────────────────────

type TOrderStats = {
    totalOrders: number;
    totalRevenue: number;
    totalSubtotal: number;
    totalDiscount: number;
    totalShippingCost: number;
    averageOrderValue: number;
    pendingOrders: number;
    confirmedOrders: number;
    processingOrders: number;
    shippedOrders: number;
    deliveredOrders: number;
    cancelledOrders: number;
    paidOrders: number;
};

const EMPTY_STATS: TOrderStats = {
    totalOrders: 0,
    totalRevenue: 0,
    totalSubtotal: 0,
    totalDiscount: 0,
    totalShippingCost: 0,
    averageOrderValue: 0,
    pendingOrders: 0,
    confirmedOrders: 0,
    processingOrders: 0,
    shippedOrders: 0,
    deliveredOrders: 0,
    cancelledOrders: 0,
    paidOrders: 0,
};

const getOrderStatsByDateRangeFromDB = async (
    startDate: Date,
    endDate: Date
): Promise<TOrderStats> => {
    const [result] = await orderModel.aggregate([
        {
            $match: {
                createdAt: { $gte: startDate, $lte: endDate },
            },
        },
        {
            $group: {
                _id: null,
                totalOrders: { $sum: 1 },
                totalRevenue: { $sum: "$total" },
                totalSubtotal: { $sum: "$subtotal" },
                totalDiscount: { $sum: "$discount" },
                totalShippingCost: { $sum: "$shippingCost" },
                averageOrderValue: { $avg: "$total" },
                pendingOrders: {
                    $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
                },
                confirmedOrders: {
                    $sum: { $cond: [{ $eq: ["$status", "confirmed"] }, 1, 0] },
                },
                processingOrders: {
                    $sum: { $cond: [{ $eq: ["$status", "processing"] }, 1, 0] },
                },
                shippedOrders: {
                    $sum: { $cond: [{ $eq: ["$status", "shipped"] }, 1, 0] },
                },
                deliveredOrders: {
                    $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] },
                },
                cancelledOrders: {
                    $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
                },
                paidOrders: {
                    $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0] },
                },
            },
        },
        { $project: { _id: 0 } },
    ]);

    return result ?? EMPTY_STATS;
};

// today: local midnight → now
const getTodayOrderStatsFromDB = async (): Promise<TOrderStats> => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return getOrderStatsByDateRangeFromDB(start, now);
};

// last N days: N*24h ago (midnight-aligned) → now
const getLastNDaysOrderStatsFromDB = async (
    days: number
): Promise<TOrderStats> => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);
    return getOrderStatsByDateRangeFromDB(start, end);
};

const getLast7DaysOrderStatsFromDB = () => getLastNDaysOrderStatsFromDB(7);
const getLast30DaysOrderStatsFromDB = () => getLastNDaysOrderStatsFromDB(30);

// arbitrary date range, inclusive of both endpoints (whole days)
const getCustomDateRangeOrderStatsFromDB = async (
    startDate: string,
    endDate: string
): Promise<TOrderStats> => {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new AppError(400, "Invalid date range provided");
    }
    if (start > end) {
        throw new AppError(400, "Start date cannot be after end date");
    }

    return getOrderStatsByDateRangeFromDB(start, end);
};

// ─────────────────────────────────────────────────────────────────
// 3. Top districts / upazilas by order count
// ─────────────────────────────────────────────────────────────────

type TLocationOrderCount = {
    district: string;
    totalOrders: number;
    totalRevenue: number;
};

type TUpazilaOrderCount = {
    district: string;
    upazila: string;
    totalOrders: number;
    totalRevenue: number;
};

const getTopDistrictsAndUpazilasFromDB = async (
    limit = 10
): Promise<{ byDistrict: TLocationOrderCount[]; byUpazila: TUpazilaOrderCount[] }> => {
    const byDistrict: TLocationOrderCount[] = await orderModel.aggregate([
        {
            $lookup: {
                from: "addresses",
                localField: "address",
                foreignField: "_id",
                as: "addressInfo",
            },
        },
        { $unwind: "$addressInfo" },
        {
            $group: {
                _id: "$addressInfo.district",
                totalOrders: { $sum: 1 },
                totalRevenue: { $sum: "$total" },
            },
        },
        { $sort: { totalOrders: -1 } },
        { $limit: limit },
        {
            $project: {
                _id: 0,
                district: "$_id",
                totalOrders: 1,
                totalRevenue: 1,
            },
        },
    ]);

    const byUpazila: TUpazilaOrderCount[] = await orderModel.aggregate([
        {
            $lookup: {
                from: "addresses",
                localField: "address",
                foreignField: "_id",
                as: "addressInfo",
            },
        },
        { $unwind: "$addressInfo" },
        {
            $group: {
                _id: {
                    district: "$addressInfo.district",
                    upazila: "$addressInfo.upazila",
                },
                totalOrders: { $sum: 1 },
                totalRevenue: { $sum: "$total" },
            },
        },
        { $sort: { totalOrders: -1 } },
        { $limit: limit },
        {
            $project: {
                _id: 0,
                district: "$_id.district",
                upazila: "$_id.upazila",
                totalOrders: 1,
                totalRevenue: 1,
            },
        },
    ]);

    return { byDistrict, byUpazila };
};

// ─────────────────────────────────────────────────────────────────
// Add these to the existing `export const OrderServices = { ... }`
// ─────────────────────────────────────────────────────────────────
//
// export const OrderServices = {
//   guestCheckoutIntoDB,
//   trackOrderFromDB,
//   getMyOrdersFromDB,
//   getAllOrdersFromDB,
//   getSingleOrderFromDB,
//   cancelMyOrderIntoDB,
//   updateOrderStatusIntoDB,
//   initiateBkashPaymentIntoDB,
//   handleBkashCallbackIntoDB,
//   updateOrderIntoDB,                 // new
//   getTodayOrderStatsFromDB,          // new
//   getLast7DaysOrderStatsFromDB,      // new
//   getLast30DaysOrderStatsFromDB,     // new
//   getCustomDateRangeOrderStatsFromDB,// new
//   getTopDistrictsAndUpazilasFromDB,  // new
// };