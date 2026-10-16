import { Types } from "mongoose";
import type { PipelineStage } from "mongoose";
import { productImageModel } from "../ProductImage/productImage.model.ts";
import { orderItemModel } from "../OrderItem/orderItem.model.ts";
import { buildBuckets, DASHBOARD_TZ, DashboardQueryError, metric, MONGO_FORMAT, resolveRange, round, share, type TDashboardQuery, type TGranularity } from "../Dashboard/Dashboard.utils.ts";
import { orderModel } from "../Order/order.model.ts";
import { productModel } from "../Product/product.model.ts";
import { categoryModel } from "../Category/category.model.ts";
import { couponModel } from "../Coupon/coupon.model.ts";
import { userModel } from "../User/user.model.ts";
import { addressModel } from "../Address/address.model.ts";
import { reviewModel } from "../Review/review.model.ts";


const ORDER_STATUSES = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];
const ACTIVE_STATUSES = ["pending", "confirmed", "processing", "shipped"] as const;

const inRange = (s: Date, e: Date) => ({ createdAt: { $gte: s, $lte: e } });
const NOT_CANCELLED = { $ne: "cancelled" };
const IS_VALID = { $ne: ["$status", "cancelled"] };
const IS_CANCELLED = { $eq: ["$status", "cancelled"] };

const sumIf = (cond: any, field: any) => ({ $sum: { $cond: [cond, field, 0] } });
const countIf = (cond: any) => ({ $sum: { $cond: [cond, 1, 0] } });

const lookupOne = (
    from: string,
    localField: string,
    project: Record<string, 1>,
    as: string,
    keepMissing = false
): PipelineStage[] =>
    [
        {
            $lookup: {
                from,
                let: { ref: `$${localField}` },
                pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$ref"] } } }, { $project: project }],
                as,
            },
        },
        { $unwind: { path: `$${as}`, preserveNullAndEmptyArrays: keepMissing } },
    ] as PipelineStage[];

const firstImageLookup = (productField: string): PipelineStage =>
    ({
        $lookup: {
            from: productImageModel.collection.name,
            let: { pid: productField },
            pipeline: [
                { $match: { $expr: { $eq: ["$product", "$$pid"] } } },
                { $sort: { sortOrder: 1 } },
                { $limit: 1 },
                { $project: { url: 1 } },
            ],
            as: "img",
        },
    }) as PipelineStage;

/** One row per order item, for this customer's non-cancelled orders in range */
const userItemStages = (uid: Types.ObjectId, s: Date, e: Date): PipelineStage[] =>
    [
        { $match: { user: uid, status: NOT_CANCELLED, ...inRange(s, e) } },
        {
            $lookup: {
                from: orderItemModel.collection.name,
                let: { oid: "$_id" },
                pipeline: [
                    { $match: { $expr: { $eq: ["$order", "$$oid"] } } },
                    { $project: { product: 1, productName: 1, quantity: 1, total: 1 } },
                ],
                as: "items",
            },
        },
        { $unwind: "$items" },
    ] as PipelineStage[];

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------
const kpis = async (uid: Types.ObjectId, s: Date, e: Date) => {
    const [[o], [i]] = await Promise.all([
        orderModel.aggregate([
            { $match: { user: uid, ...inRange(s, e) } },
            {
                $group: {
                    _id: null,
                    allOrders: { $sum: 1 },
                    orders: countIf(IS_VALID),
                    cancelledOrders: countIf(IS_CANCELLED),
                    deliveredOrders: countIf({ $eq: ["$status", "delivered"] }),
                    totalSpent: sumIf(IS_VALID, "$total"),
                    totalSaved: sumIf(IS_VALID, "$discount"),
                    shippingPaid: sumIf(IS_VALID, "$shippingCost"),
                },
            },
        ]),
        orderModel.aggregate([...userItemStages(uid, s, e), { $group: { _id: null, units: { $sum: "$items.quantity" } } }]),
    ]);

    const k = {
        allOrders: 0,
        orders: 0,
        cancelledOrders: 0,
        deliveredOrders: 0,
        totalSpent: 0,
        totalSaved: 0,
        shippingPaid: 0,
        ...(o ?? {}),
    };
    return { ...k, itemsPurchased: i?.units ?? 0, averageOrderValue: k.orders ? k.totalSpent / k.orders : 0 };
};

const spendingTrend = async (uid: Types.ObjectId, s: Date, e: Date, g: TGranularity) => {
    const rows = await orderModel.aggregate([
        { $match: { user: uid, ...inRange(s, e) } },
        {
            $group: {
                _id: { $dateToString: { format: MONGO_FORMAT[g], date: "$createdAt", timezone: DASHBOARD_TZ } },
                orders: countIf(IS_VALID),
                spent: sumIf(IS_VALID, "$total"),
                saved: sumIf(IS_VALID, "$discount"),
            },
        },
    ]);
    const map = new Map<string, any>(rows.map((r: any) => [r._id, r]));
    return buildBuckets(s, e, g).map((label) => {
        const r = map.get(label);
        return { label, orders: r?.orders ?? 0, spent: round(r?.spent ?? 0), saved: round(r?.saved ?? 0) };
    });
};

const orderStatusBreakdown = async (uid: Types.ObjectId, s: Date, e: Date) => {
    const rows = await orderModel.aggregate([
        { $match: { user: uid, ...inRange(s, e) } },
        { $group: { _id: "$status", count: { $sum: 1 }, amount: { $sum: "$total" } } },
    ]);
    const total = rows.reduce((a: number, r: any) => a + r.count, 0);
    return ORDER_STATUSES.map((status) => {
        const r = rows.find((x: any) => x._id === status);
        return { status, count: r?.count ?? 0, amount: round(r?.amount ?? 0), share: share(r?.count ?? 0, total) };
    });
};

/** Orders still on the way, with their status timeline (not date filtered) */
const activeOrders = async (uid: Types.ObjectId) => {
    const orders = await orderModel.find({ user: uid, status: { $in: ACTIVE_STATUSES } })
        .sort({ createdAt: -1 })
        .limit(10)
        .select("orderNumber status total paymentMethod paymentStatus statusLog createdAt")
        .lean();

    return orders.map((o: any) => ({
        _id: o._id,
        orderNumber: o.orderNumber,
        status: o.status,
        total: o.total,
        paymentMethod: o.paymentMethod,
        paymentStatus: o.paymentStatus,
        placedAt: o.createdAt,
        timeline: (o.statusLog ?? []).map((l: any) => ({ status: l.toStatus, at: l.createdAt, note: l.note })),
    }));
};

const recentOrders = async (uid: Types.ObjectId) => {
    const rows = await orderModel.aggregate([
        { $match: { user: uid } },
        { $sort: { createdAt: -1 } },
        { $limit: 5 },
        {
            $lookup: {
                from: orderItemModel.collection.name,
                let: { oid: "$_id" },
                pipeline: [
                    { $match: { $expr: { $eq: ["$order", "$$oid"] } } },
                    { $project: { _id: 0, product: 1, productName: 1, quantity: 1, size: 1, color: 1 } },
                ],
                as: "items",
            },
        },
        {
            $project: {
                orderNumber: 1,
                status: 1,
                paymentStatus: 1,
                paymentMethod: 1,
                total: 1,
                createdAt: 1,
                itemCount: { $sum: "$items.quantity" },
                items: { $slice: ["$items", 3] },
            },
        },
    ]);
    return rows;
};

const topProducts = async (uid: Types.ObjectId, s: Date, e: Date) => {
    const rows = await orderModel.aggregate([
        ...userItemStages(uid, s, e),
        {
            $group: {
                _id: "$items.product",
                name: { $first: "$items.productName" },
                units: { $sum: "$items.quantity" },
                spent: { $sum: "$items.total" },
                lastBoughtAt: { $max: "$createdAt" },
            },
        },
        { $sort: { units: -1, spent: -1 } },
        { $limit: 5 },
        ...lookupOne(productModel.collection.name, "_id", { slug: 1 }, "p", true),
        firstImageLookup("$_id"),
        {
            $project: {
                _id: 0,
                productId: "$_id",
                name: 1,
                slug: "$p.slug",
                image: { $arrayElemAt: ["$img.url", 0] },
                units: 1,
                spent: 1,
                lastBoughtAt: 1,
            },
        },
    ] as PipelineStage[]);
    return rows.map((r: any) => ({ ...r, spent: round(r.spent) }));
};

const favoriteCategories = async (uid: Types.ObjectId, s: Date, e: Date) => {
    const rows = await orderModel.aggregate([
        ...userItemStages(uid, s, e),
        ...lookupOne(productModel.collection.name, "items.product", { category: 1 }, "p"),
        { $group: { _id: "$p.category", units: { $sum: "$items.quantity" }, spent: { $sum: "$items.total" } } },
        { $sort: { spent: -1 } },
        { $limit: 5 },
        ...lookupOne(categoryModel.collection.name, "_id", { name: 1, slug: 1 }, "c", true),
        {
            $project: {
                _id: 0,
                categoryId: "$_id",
                name: { $ifNull: ["$c.name", "Uncategorised"] },
                slug: "$c.slug",
                units: 1,
                spent: 1,
            },
        },
    ] as PipelineStage[]);
    const total = rows.reduce((a: number, r: any) => a + r.spent, 0);
    return rows.map((r: any) => ({ ...r, spent: round(r.spent), share: share(r.spent, total) }));
};

const paymentMethods = async (uid: Types.ObjectId, s: Date, e: Date) => {
    const rows = await orderModel.aggregate([
        { $match: { user: uid, status: NOT_CANCELLED, ...inRange(s, e) } },
        { $group: { _id: "$paymentMethod", orders: { $sum: 1 }, amount: { $sum: "$total" } } },
        { $sort: { amount: -1 } },
    ]);
    const total = rows.reduce((a: number, r: any) => a + r.amount, 0);
    return rows.map((r: any) => ({
        method: r._id,
        orders: r.orders,
        amount: round(r.amount),
        share: share(r.amount, total),
    }));
};

const couponUsage = async (uid: Types.ObjectId, s: Date, e: Date) => {
    const rows = await orderModel.aggregate([
        { $match: { user: uid, status: NOT_CANCELLED, coupon: { $exists: true, $ne: null }, ...inRange(s, e) } },
        { $group: { _id: "$coupon", usage: { $sum: 1 }, saved: { $sum: "$discount" } } },
        { $sort: { saved: -1 } },
        { $limit: 5 },
        ...lookupOne(couponModel.collection.name, "_id", { code: 1, type: 1, value: 1 }, "c", true),
        { $project: { _id: 0, couponId: "$_id", code: "$c.code", type: "$c.type", value: "$c.value", usage: 1, saved: 1 } },
    ] as PipelineStage[]);
    return rows.map((r: any) => ({ ...r, saved: round(r.saved) }));
};

/** Lifetime stats (all time, not date filtered) */
const lifetime = async (uid: Types.ObjectId) => {
    const [[r], user] = await Promise.all([
        orderModel.aggregate([
            { $match: { user: uid } },
            {
                $group: {
                    _id: null,
                    totalOrders: countIf(IS_VALID),
                    deliveredOrders: countIf({ $eq: ["$status", "delivered"] }),
                    totalSpent: sumIf(IS_VALID, "$total"),
                    totalSaved: sumIf(IS_VALID, "$discount"),
                    firstOrderAt: { $min: "$createdAt" },
                    lastOrderAt: { $max: "$createdAt" },
                },
            },
        ]),
        userModel.findById(uid).select("name email phoneNumber profilePicture createdAt").lean(),
    ]);

    return {
        profile: user
            ? {
                  name: (user as any).name,
                  email: (user as any).email,
                  phoneNumber: (user as any).phoneNumber,
                  profilePicture: (user as any).profilePicture,
                  memberSince: (user as any).createdAt,
              }
            : null,
        totalOrders: r?.totalOrders ?? 0,
        deliveredOrders: r?.deliveredOrders ?? 0,
        totalSpent: round(r?.totalSpent ?? 0),
        totalSaved: round(r?.totalSaved ?? 0),
        firstOrderAt: r?.firstOrderAt ?? null,
        lastOrderAt: r?.lastOrderAt ?? null,
    };
};

const addressStats = async (uid: Types.ObjectId) => {
    const [total, defaultAddress] = await Promise.all([
        addressModel.countDocuments({ user: uid }),
        addressModel.findOne({ user: uid, isDefault: true }).select("fullName phoneNumber address district upazila postalCode").lean(),
    ]);
    return { total, defaultAddress };
};

const reviewStats = async (uid: Types.ObjectId) => {
    const [given, recent, toReview] = await Promise.all([
        reviewModel.aggregate([
            { $match: { user: uid } },
            { $group: { _id: null, count: { $sum: 1 }, avg: { $avg: "$rating" } } },
        ]),
        reviewModel
            .find({ user: uid })
            .sort({ createdAt: -1 })
            .limit(3)
            .select("product rating comment isApproved createdAt")
            .populate("product", "name slug")
            .lean(),
        // delivered products this customer has not reviewed yet
        orderModel.aggregate([
            { $match: { user: uid, status: "delivered" } },
            {
                $lookup: {
                    from: orderItemModel.collection.name,
                    let: { oid: "$_id" },
                    pipeline: [
                        { $match: { $expr: { $eq: ["$order", "$$oid"] } } },
                        { $project: { product: 1, productName: 1 } },
                    ],
                    as: "items",
                },
            },
            { $unwind: "$items" },
            {
                $group: {
                    _id: "$items.product",
                    name: { $first: "$items.productName" },
                    deliveredAt: { $max: "$updatedAt" },
                },
            },
            {
                $lookup: {
                    from: reviewModel.collection.name,
                    let: { pid: "$_id" },
                    pipeline: [
                        { $match: { $expr: { $and: [{ $eq: ["$product", "$$pid"] }, { $eq: ["$user", uid] }] } } },
                        { $limit: 1 },
                        { $project: { _id: 1 } },
                    ],
                    as: "reviewed",
                },
            },
            { $match: { reviewed: { $size: 0 } } },
            { $sort: { deliveredAt: -1 } },
            { $limit: 5 },
            firstImageLookup("$_id"),
            {
                $project: {
                    _id: 0,
                    productId: "$_id",
                    name: 1,
                    image: { $arrayElemAt: ["$img.url", 0] },
                    deliveredAt: 1,
                },
            },
        ] as PipelineStage[]),
    ]);

    return {
        totalGiven: given[0]?.count ?? 0,
        averageRatingGiven: round(given[0]?.avg ?? 0),
        recent,
        waitingForReview: toReview,
    };
};

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------
const getCustomerDashboard = async (userId: string, query: TDashboardQuery) => {
    if (!Types.ObjectId.isValid(userId)) throw new DashboardQueryError("Invalid user id");
    const uid = new Types.ObjectId(userId);

    const r = resolveRange(query);
    const { start: s, end: e, prevStart: ps, prevEnd: pe, granularity: g } = r;

    const [
        cur,
        prev,
        trend,
        previousTrend,
        orderStatus,
        active,
        recent,
        products,
        categories,
        payments,
        coupons,
        life,
        addresses,
        reviews,
    ] = await Promise.all([
        kpis(uid, s, e),
        kpis(uid, ps, pe),
        spendingTrend(uid, s, e, g),
        spendingTrend(uid, ps, pe, g),
        orderStatusBreakdown(uid, s, e),
        activeOrders(uid),
        recentOrders(uid),
        topProducts(uid, s, e),
        favoriteCategories(uid, s, e),
        paymentMethods(uid, s, e),
        couponUsage(uid, s, e),
        lifetime(uid),
        addressStats(uid),
        reviewStats(uid),
    ]);

    return {
        range: {
            key: r.key,
            timezone: DASHBOARD_TZ,
            granularity: g,
            startDate: s.toISOString(),
            endDate: e.toISOString(),
            previousStartDate: ps.toISOString(),
            previousEndDate: pe.toISOString(),
        },

        // KPI cards (current / previous / % change / trend)
        overview: {
            totalSpent: metric(cur.totalSpent, prev.totalSpent),
            orders: metric(cur.orders, prev.orders),
            averageOrderValue: metric(cur.averageOrderValue, prev.averageOrderValue),
            itemsPurchased: metric(cur.itemsPurchased, prev.itemsPurchased),
            totalSaved: metric(cur.totalSaved, prev.totalSaved),
            shippingPaid: metric(cur.shippingPaid, prev.shippingPaid),
            deliveredOrders: metric(cur.deliveredOrders, prev.deliveredOrders),
            cancelledOrders: metric(cur.cancelledOrders, prev.cancelledOrders),
        },

        charts: {
            spendingTrend: trend,
            previousSpendingTrend: previousTrend,
            orderStatus,
            paymentMethods: payments,
        },

        topProducts: products,
        favoriteCategories: categories,
        coupons,

        // not date filtered
        lifetime: life,
        activeOrders: active,
        recentOrders: recent,
        addresses,
        reviews,
    };
};

export const customerDashboardService = { getCustomerDashboard };