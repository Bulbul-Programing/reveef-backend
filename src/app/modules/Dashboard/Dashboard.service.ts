import type { PipelineStage } from "mongoose";
import { orderModel } from "../Order/order.model.ts";
import { orderItemModel } from "../OrderItem/orderItem.model.ts";
import { userModel } from "../User/user.model.ts";
import { buildBuckets, DASHBOARD_TZ, metric, MONGO_FORMAT, resolveRange, round, share, type TDashboardQuery, type TGranularity } from "./Dashboard.utils.ts";

import { productModel } from "../Product/product.model.ts";
import { productImageModel } from "../ProductImage/productImage.model.ts";
import { categoryModel } from "../Category/category.model.ts";
import { addressModel } from "../Address/address.model.ts";
import { couponModel } from "../Coupon/coupon.model.ts";
import { reviewModel } from "../Review/review.model.ts";
import { productVariantModel } from "../ProductVariant/productVariant.model.ts";


const LOW_STOCK_THRESHOLD = 5;
const ORDER_STATUSES = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// ---------------------------------------------------------------------------
// Small aggregation helpers
// ---------------------------------------------------------------------------
const inRange = (s: Date, e: Date) => ({ createdAt: { $gte: s, $lte: e } });
const NOT_CANCELLED = { $ne: "cancelled" };

const IS_VALID = { $ne: ["$status", "cancelled"] };
const IS_CANCELLED = { $eq: ["$status", "cancelled"] };
const IS_PAID = { $eq: ["$paymentStatus", "paid"] };

const sumIf = (cond: any, field: any) => ({ $sum: { $cond: [cond, field, 0] } });
const countIf = (cond: any) => ({ $sum: { $cond: [cond, 1, 0] } });

/** $lookup of a single document by _id (index friendly, works on MongoDB 4.x+) */
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

/** Order items that belong to non-cancelled orders created in range */
const validItemStages = (s: Date, e: Date): PipelineStage[] => [
    { $match: inRange(s, e) },
    ...lookupOne(orderModel.collection.name, "order", { status: 1 }, "o"),
    { $match: { "o.status": NOT_CANCELLED } },
];

// ---------------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------------
const orderKpis = async (s: Date, e: Date) => {
    const [r] = await orderModel.aggregate([
        { $match: inRange(s, e) },
        {
            $group: {
                _id: null,
                allOrders: { $sum: 1 },
                orders: countIf(IS_VALID),
                cancelledOrders: countIf(IS_CANCELLED),
                deliveredOrders: countIf({ $eq: ["$status", "delivered"] }),
                grossSales: sumIf(IS_VALID, "$total"),
                paidRevenue: sumIf(IS_PAID, "$total"),
                refunded: sumIf({ $eq: ["$paymentStatus", "refunded"] }, "$total"),
                discountGiven: sumIf(IS_VALID, "$discount"),
                shippingCollected: sumIf(IS_VALID, "$shippingCost"),
                customers: { $addToSet: "$user" },
            },
        },
        { $addFields: { activeCustomers: { $size: "$customers" } } },
        { $project: { _id: 0, customers: 0 } },
    ]);

    const k = {
        allOrders: 0,
        orders: 0,
        cancelledOrders: 0,
        deliveredOrders: 0,
        grossSales: 0,
        paidRevenue: 0,
        refunded: 0,
        discountGiven: 0,
        shippingCollected: 0,
        activeCustomers: 0,
        ...(r ?? {}),
    };

    return {
        ...k,
        averageOrderValue: k.orders ? k.grossSales / k.orders : 0,
        cancellationRate: k.allOrders ? (k.cancelledOrders / k.allOrders) * 100 : 0,
    };
};

const unitsSold = async (s: Date, e: Date) => {
    const [r] = await orderItemModel.aggregate([
        ...validItemStages(s, e),
        { $group: { _id: null, units: { $sum: "$quantity" } } },
    ]);
    return r?.units ?? 0;
};

const newCustomers = (s: Date, e: Date) =>
    userModel.countDocuments({ role: "customer", ...inRange(s, e) });

// ---------------------------------------------------------------------------
// Trend (sales + new customers per bucket, gaps filled with zeros)
// ---------------------------------------------------------------------------
const buildTrend = async (s: Date, e: Date, g: TGranularity) => {
    const dateStr = { $dateToString: { format: MONGO_FORMAT[g], date: "$createdAt", timezone: DASHBOARD_TZ } };

    const [orders, users] = await Promise.all([
        orderModel.aggregate([
            { $match: inRange(s, e) },
            {
                $group: {
                    _id: dateStr,
                    orders: countIf(IS_VALID),
                    cancelled: countIf(IS_CANCELLED),
                    sales: sumIf(IS_VALID, "$total"),
                    paid: sumIf(IS_PAID, "$total"),
                    discount: sumIf(IS_VALID, "$discount"),
                },
            },
        ]),
        userModel.aggregate([
            { $match: { role: "customer", ...inRange(s, e) } },
            { $group: { _id: dateStr, newCustomers: { $sum: 1 } } },
        ]),
    ]);

    const oMap = new Map<string, any>(orders.map((o: any) => [o._id, o]));
    const uMap = new Map<string, any>(users.map((u: any) => [u._id, u]));

    return buildBuckets(s, e, g).map((label) => {
        const o = oMap.get(label);
        const u = uMap.get(label);
        return {
            label,
            orders: o?.orders ?? 0,
            cancelled: o?.cancelled ?? 0,
            sales: round(o?.sales ?? 0),
            paid: round(o?.paid ?? 0),
            discount: round(o?.discount ?? 0),
            newCustomers: u?.newCustomers ?? 0,
        };
    });
};

// ---------------------------------------------------------------------------
// Breakdowns
// ---------------------------------------------------------------------------
const orderStatusBreakdown = async (s: Date, e: Date) => {
    const rows = await orderModel.aggregate([
        { $match: inRange(s, e) },
        { $group: { _id: "$status", count: { $sum: 1 }, amount: { $sum: "$total" } } },
    ]);
    const total = rows.reduce((a: number, r: any) => a + r.count, 0);
    return ORDER_STATUSES.map((status) => {
        const r = rows.find((x: any) => x._id === status);
        return { status, count: r?.count ?? 0, amount: round(r?.amount ?? 0), share: share(r?.count ?? 0, total) };
    });
};

const paymentBreakdown = async (s: Date, e: Date) => {
    const [methods, statuses] = await Promise.all([
        orderModel.aggregate([
            { $match: { ...inRange(s, e), status: NOT_CANCELLED } },
            { $group: { _id: "$paymentMethod", orders: { $sum: 1 }, amount: { $sum: "$total" } } },
            { $sort: { amount: -1 } },
        ]),
        orderModel.aggregate([
            { $match: inRange(s, e) },
            { $group: { _id: "$paymentStatus", orders: { $sum: 1 }, amount: { $sum: "$total" } } },
            { $sort: { orders: -1 } },
        ]),
    ]);
    const totalAmount = methods.reduce((a: number, r: any) => a + r.amount, 0);
    return {
        methods: methods.map((m: any) => ({
            method: m._id,
            orders: m.orders,
            amount: round(m.amount),
            share: share(m.amount, totalAmount),
        })),
        statuses: statuses.map((x: any) => ({ status: x._id, orders: x.orders, amount: round(x.amount) })),
    };
};

const topProducts = async (s: Date, e: Date) => {
    const rows = await orderItemModel.aggregate([
        ...validItemStages(s, e),
        {
            $group: {
                _id: "$product",
                name: { $first: "$productName" },
                units: { $sum: "$quantity" },
                revenue: { $sum: "$total" },
                orders: { $addToSet: "$order" },
            },
        },
        { $addFields: { orders: { $size: "$orders" } } },
        { $sort: { revenue: -1 } },
        { $limit: 10 },
        ...lookupOne(productModel.collection.name, "_id", { name: 1, slug: 1 }, "p", true),
        {
            $lookup: {
                from: productImageModel.collection.name,
                let: { pid: "$_id" },
                pipeline: [
                    { $match: { $expr: { $eq: ["$product", "$$pid"] } } },
                    { $sort: { sortOrder: 1 } },
                    { $limit: 1 },
                    { $project: { url: 1 } },
                ],
                as: "img",
            },
        },
        {
            $project: {
                _id: 0,
                productId: "$_id",
                name: { $ifNull: ["$p.name", "$name"] },
                slug: "$p.slug",
                image: { $arrayElemAt: ["$img.url", 0] },
                units: 1,
                orders: 1,
                revenue: 1,
            },
        },
    ] as PipelineStage[]);
    return rows.map((r: any) => ({ ...r, revenue: round(r.revenue) }));
};

const topCategories = async (s: Date, e: Date) => {
    const rows = await orderItemModel.aggregate([
        ...validItemStages(s, e),
        ...lookupOne(productModel.collection.name, "product", { category: 1 }, "p"),
        { $group: { _id: "$p.category", units: { $sum: "$quantity" }, revenue: { $sum: "$total" } } },
        { $sort: { revenue: -1 } },
        { $limit: 8 },
        ...lookupOne(categoryModel.collection.name, "_id", { name: 1, slug: 1 }, "c", true),
        {
            $project: {
                _id: 0,
                categoryId: "$_id",
                name: { $ifNull: ["$c.name", "Uncategorised"] },
                slug: "$c.slug",
                units: 1,
                revenue: 1,
            },
        },
    ] as PipelineStage[]);
    const total = rows.reduce((a: number, r: any) => a + r.revenue, 0);
    return rows.map((r: any) => ({ ...r, revenue: round(r.revenue), share: share(r.revenue, total) }));
};

const topDistricts = async (s: Date, e: Date) => {
    const rows = await orderModel.aggregate([
        { $match: { ...inRange(s, e), status: NOT_CANCELLED } },
        ...lookupOne(addressModel.collection.name, "address", { district: 1 }, "a", true),
        { $group: { _id: "$a.district", orders: { $sum: 1 }, sales: { $sum: "$total" } } },
        { $sort: { orders: -1 } },
        { $limit: 10 },
        { $project: { _id: 0, district: { $ifNull: ["$_id", "Unknown"] }, orders: 1, sales: 1 } },
    ] as PipelineStage[]);
    const total = rows.reduce((a: number, r: any) => a + r.orders, 0);
    return rows.map((r: any) => ({ ...r, sales: round(r.sales), share: share(r.orders, total) }));
};

const peakTimes = async (s: Date, e: Date) => {
    const [r] = await orderModel.aggregate([
        { $match: { ...inRange(s, e), status: NOT_CANCELLED } },
        {
            $facet: {
                byHour: [
                    {
                        $group: {
                            _id: { $hour: { date: "$createdAt", timezone: DASHBOARD_TZ } },
                            orders: { $sum: 1 },
                            sales: { $sum: "$total" },
                        },
                    },
                ],
                byWeekday: [
                    {
                        $group: {
                            _id: { $dayOfWeek: { date: "$createdAt", timezone: DASHBOARD_TZ } },
                            orders: { $sum: 1 },
                            sales: { $sum: "$total" },
                        },
                    },
                ],
            },
        },
    ]);

    const byHour = Array.from({ length: 24 }, (_, h) => {
        const x = r?.byHour.find((i: any) => i._id === h);
        return { hour: h, label: `${String(h).padStart(2, "0")}:00`, orders: x?.orders ?? 0, sales: round(x?.sales ?? 0) };
    });
    const byWeekday = WEEKDAYS.map((day, i) => {
        const x = r?.byWeekday.find((w: any) => w._id === i + 1); // Mongo: 1 = Sunday
        return { day, orders: x?.orders ?? 0, sales: round(x?.sales ?? 0) };
    });
    return { byHour, byWeekday };
};

const avgDeliveryHours = async (s: Date, e: Date) => {
    const [r] = await orderModel.aggregate([
        { $match: { ...inRange(s, e), status: "delivered" } },
        {
            $addFields: {
                deliveredLog: {
                    $arrayElemAt: [
                        { $filter: { input: "$statusLog", cond: { $eq: ["$$this.toStatus", "delivered"] } } },
                        0,
                    ],
                },
            },
        },
        { $match: { "deliveredLog.createdAt": { $exists: true } } },
        { $group: { _id: null, avgMs: { $avg: { $subtract: ["$deliveredLog.createdAt", "$createdAt"] } } } },
    ]);
    return r ? round(r.avgMs / 3_600_000) : null;
};

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------
const customerStats = async (s: Date, e: Date) => {
    const [totalCustomers, top, repeat] = await Promise.all([
        userModel.countDocuments({ role: "customer" }),
        orderModel.aggregate([
            { $match: { ...inRange(s, e), status: NOT_CANCELLED } },
            { $group: { _id: "$user", orders: { $sum: 1 }, spent: { $sum: "$total" } } },
            { $sort: { spent: -1 } },
            { $limit: 5 },
            ...lookupOne(userModel.collection.name, "_id", { name: 1, phoneNumber: 1, email: 1, profilePicture: 1 }, "u", true),
            {
                $project: {
                    _id: 0,
                    userId: "$_id",
                    name: "$u.name",
                    phoneNumber: "$u.phoneNumber",
                    email: "$u.email",
                    profilePicture: "$u.profilePicture",
                    orders: 1,
                    spent: 1,
                },
            },
        ] as PipelineStage[]),
        orderModel.aggregate([
            { $match: { ...inRange(s, e), status: NOT_CANCELLED } },
            { $group: { _id: "$user", orders: { $sum: 1 } } },
            { $match: { orders: { $gte: 2 } } },
            { $count: "count" },
        ]),
    ]);
    return {
        totalCustomers,
        repeatCustomers: repeat[0]?.count ?? 0,
        topCustomers: top.map((c: any) => ({ ...c, spent: round(c.spent) })),
    };
};

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------
const couponStats = async (s: Date, e: Date) => {
    const now = new Date();
    const [top, activeCoupons] = await Promise.all([
        orderModel.aggregate([
            { $match: { ...inRange(s, e), status: NOT_CANCELLED, coupon: { $exists: true, $ne: null } } },
            {
                $group: {
                    _id: "$coupon",
                    usage: { $sum: 1 },
                    discountGiven: { $sum: "$discount" },
                    sales: { $sum: "$total" },
                },
            },
            { $sort: { usage: -1 } },
            { $limit: 5 },
            ...lookupOne(couponModel.collection.name, "_id", { code: 1, type: 1, value: 1 }, "c", true),
            {
                $project: {
                    _id: 0,
                    couponId: "$_id",
                    code: "$c.code",
                    type: "$c.type",
                    value: "$c.value",
                    usage: 1,
                    discountGiven: 1,
                    sales: 1,
                },
            },
        ] as PipelineStage[]),
        couponModel.countDocuments({
            isActive: true,
            isDeleted: false,
            startDate: { $lte: now },
            expiryDate: { $gte: now },
        }),
    ]);
    return {
        activeCoupons,
        topCoupons: top.map((c: any) => ({ ...c, discountGiven: round(c.discountGiven), sales: round(c.sales) })),
    };
};

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------
const reviewStats = async (s: Date, e: Date) => {
    const [dist, pendingApproval, recent] = await Promise.all([
        reviewModel.aggregate([
            { $match: inRange(s, e) },
            { $group: { _id: "$rating", count: { $sum: 1 } } },
        ]),
        reviewModel.countDocuments({ isApproved: false }),
        reviewModel
            .find()
            .sort({ createdAt: -1 })
            .limit(5)
            .populate("user", "name profilePicture")
            .populate("product", "name slug")
            .lean(),
    ]);

    const total = dist.reduce((a: number, r: any) => a + r.count, 0);
    const weighted = dist.reduce((a: number, r: any) => a + r._id * r.count, 0);

    return {
        total,
        averageRating: total ? round(weighted / total) : 0,
        distribution: [5, 4, 3, 2, 1].map((rating) => {
            const c = dist.find((d: any) => d._id === rating)?.count ?? 0;
            return { rating, count: c, share: share(c, total) };
        }),
        pendingApproval,
        recent,
    };
};

// ---------------------------------------------------------------------------
// Inventory (live snapshot, not date filtered)
// ---------------------------------------------------------------------------
const inventoryStats = async () => {
    const [summary, lowStockItems, totalProducts, activeProducts] = await Promise.all([
        productVariantModel.aggregate([
            { $match: { isActive: true } },
            {
                $group: {
                    _id: null,
                    variants: { $sum: 1 },
                    totalUnits: { $sum: "$stock" },
                    stockValue: { $sum: { $multiply: ["$stock", "$price"] } },
                    outOfStock: countIf({ $eq: ["$stock", 0] }),
                    lowStock: countIf({ $and: [{ $gt: ["$stock", 0] }, { $lte: ["$stock", LOW_STOCK_THRESHOLD] }] }),
                },
            },
        ]),
        productVariantModel
            .find({ isActive: true, stock: { $lte: LOW_STOCK_THRESHOLD } })
            .sort({ stock: 1 })
            .limit(10)
            .populate("product", "name slug")
            .select("sku size color stock product image")
            .lean(),
        productModel.countDocuments(),
        productModel.countDocuments({ isActive: true }),
    ]);

    const s = summary[0] ?? {};
    return {
        lowStockThreshold: LOW_STOCK_THRESHOLD,
        totalProducts,
        activeProducts,
        variants: s.variants ?? 0,
        totalUnits: s.totalUnits ?? 0,
        stockValue: round(s.stockValue ?? 0),
        outOfStock: s.outOfStock ?? 0,
        lowStock: s.lowStock ?? 0,
        lowStockItems,
    };
};

const recentOrders = () =>
    orderModel
        .find()
        .sort({ createdAt: -1 })
        .limit(10)
        .select("orderNumber total status paymentStatus paymentMethod user address createdAt")
        .populate("user", "name phoneNumber")
        .populate("address", "fullName district upazila")
        .lean();

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------
const getDashboardOverview = async (query: TDashboardQuery) => {
    const r = resolveRange(query);
    const { start: s, end: e, prevStart: ps, prevEnd: pe, granularity: g } = r;

    const [
        kpi,
        prevKpi,
        units,
        prevUnits,
        newCust,
        prevNewCust,
        trend,
        previousTrend,
        orderStatus,
        payments,
        products,
        categories,
        districts,
        peak,
        deliveryHours,
        customers,
        coupons,
        reviews,
        inventory,
        latestOrders,
        pendingOrders,
        processingOrders,
    ] = await Promise.all([
        orderKpis(s, e),
        orderKpis(ps, pe),
        unitsSold(s, e),
        unitsSold(ps, pe),
        newCustomers(s, e),
        newCustomers(ps, pe),
        buildTrend(s, e, g),
        buildTrend(ps, pe, g),
        orderStatusBreakdown(s, e),
        paymentBreakdown(s, e),
        topProducts(s, e),
        topCategories(s, e),
        topDistricts(s, e),
        peakTimes(s, e),
        avgDeliveryHours(s, e),
        customerStats(s, e),
        couponStats(s, e),
        reviewStats(s, e),
        inventoryStats(),
        recentOrders(),
        orderModel.countDocuments({ status: "pending" }),
        orderModel.countDocuments({ status: "processing" }),
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

        // KPI cards, each with current / previous / % change / trend
        overview: {
            grossSales: metric(kpi.grossSales, prevKpi.grossSales),
            paidRevenue: metric(kpi.paidRevenue, prevKpi.paidRevenue),
            orders: metric(kpi.orders, prevKpi.orders),
            averageOrderValue: metric(kpi.averageOrderValue, prevKpi.averageOrderValue),
            unitsSold: metric(units, prevUnits),
            newCustomers: metric(newCust, prevNewCust),
            activeCustomers: metric(kpi.activeCustomers, prevKpi.activeCustomers),
            deliveredOrders: metric(kpi.deliveredOrders, prevKpi.deliveredOrders),
            cancelledOrders: metric(kpi.cancelledOrders, prevKpi.cancelledOrders),
            cancellationRate: metric(kpi.cancellationRate, prevKpi.cancellationRate),
            discountGiven: metric(kpi.discountGiven, prevKpi.discountGiven),
            shippingCollected: metric(kpi.shippingCollected, prevKpi.shippingCollected),
            refunded: metric(kpi.refunded, prevKpi.refunded),
            avgDeliveryHours: deliveryHours,
        },

        // charts (previousTrend lines up by index for period-over-period overlays)
        charts: {
            salesTrend: trend,
            previousSalesTrend: previousTrend,
            orderStatus,
            paymentMethods: payments.methods,
            paymentStatus: payments.statuses,
            peakHours: peak.byHour,
            peakWeekdays: peak.byWeekday,
        },

        // ranked lists
        topProducts: products,
        topCategories: categories,
        topDistricts: districts,
        customers,
        coupons,
        reviews,

        // live snapshots (not date filtered)
        inventory,
        recentOrders: latestOrders,
        alerts: {
            pendingOrders,
            processingOrders,
            unapprovedReviews: reviews.pendingApproval,
            outOfStockVariants: inventory.outOfStock,
            lowStockVariants: inventory.lowStock,
        },
    };
};

export const dashboardService = { getDashboardOverview };