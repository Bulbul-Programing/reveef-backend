import httpStatus from "http-status";
import type { TCoupon, TVerifyCouponInput } from "./coupon.interface.ts";
import { couponModel } from "./coupon.model.ts";
import AppError from "../../error/AppError.ts";
import QueryBuilder from "../../builder/QueryBuilder.ts";
// ── Create (staff/admin) ──────────────────────────────────────────
const createCouponIntoDB = async (payload: Partial<TCoupon>) => {
    const existing = await couponModel.findOne({
        code: payload.code?.trim().toUpperCase(),
    });
    if (existing) {
        throw new AppError(httpStatus.CONFLICT, "This coupon code already exists");
    }

    const coupon = await couponModel.create(payload);
    return coupon;
};

// ── Get all (staff/admin only — full list) ────────────────────────
const getAllCouponsFromDB = async (query: Record<string, unknown>) => {
    const couponQuery = new QueryBuilder(couponModel.find(), query)
        .search(["code"])
        .filter()
        .sort()
        .paginate()
        .fields();

    const result = await couponQuery.modelQuery;
    const meta = await couponQuery.countTotal();

    return { result, meta };
};

// ── Get single (staff/admin only) ─────────────────────────────────
const getSingleCouponFromDB = async (id: string) => {
    const coupon = await couponModel.findById(id);
    if (!coupon) {
        throw new AppError(httpStatus.NOT_FOUND, "Coupon not found");
    }
    return coupon;
};

// ── Update (staff/admin) ───────────────────────────────────────────
const updateCouponIntoDB = async (id: string, payload: Partial<TCoupon>) => {
    if (payload.code) {
        const existing = await couponModel.findOne({
            code: payload.code.trim().toUpperCase(),
            _id: { $ne: id },
        });
        if (existing) {
            throw new AppError(httpStatus.CONFLICT, "This coupon code already exists");
        }
    }

    const coupon = await couponModel.findByIdAndUpdate(id, payload, {
        new: true,
        runValidators: true,
    });
    if (!coupon) {
        throw new AppError(httpStatus.NOT_FOUND, "Coupon not found");
    }
    return coupon;
};

// ── Delete (admin only, enforced in route) ────────────────────────
const deleteCouponFromDB = async (id: string) => {
    const coupon = await couponModel.findByIdAndDelete(id);
    if (!coupon) {
        throw new AppError(httpStatus.NOT_FOUND, "Coupon not found");
    }
    return coupon;
};

// ── Verify a single coupon by code (all roles — user's checkout flow) ──
// Runs the exact same checks as the order service's inline coupon logic,
// so this can also be reused there via CouponServices.verifyCouponFromDB
// instead of duplicating the checks inline in order.service.ts.
const verifyCouponFromDB = async (payload: TVerifyCouponInput) => {
    const coupon = await couponModel.findOne({
        code: payload.code.trim().toUpperCase(),
    });

    if (!coupon) {
        throw new AppError(httpStatus.NOT_FOUND, "Coupon code not found");
    }
    if (!coupon.isActive) {
        throw new AppError(httpStatus.BAD_REQUEST, "This coupon is no longer active");
    }

    const now = new Date();
    if (coupon.startDate > now) {
        throw new AppError(httpStatus.BAD_REQUEST, "This coupon is not active yet");
    }
    if (coupon.expiryDate < now) {
        throw new AppError(httpStatus.BAD_REQUEST, "This coupon has expired");
    }
    if (
        typeof coupon.usageLimit === "number" &&
        (coupon.usedCount ?? 0) >= coupon.usageLimit
    ) {
        throw new AppError(httpStatus.BAD_REQUEST, "This coupon has reached its usage limit");
    }
    if (coupon.minimumPurchase && payload.cartSubtotal < coupon.minimumPurchase) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            `This coupon requires a minimum order of ${coupon.minimumPurchase}`
        );
    }

    let discount = coupon.type === "percentage"
            ? (payload.cartSubtotal * coupon.value) / 100
            : coupon.value;

    if (coupon.type === "percentage" && typeof coupon.maximumDiscount === "number") {
        discount = Math.min(discount, coupon.maximumDiscount);
    }
    discount = Math.min(discount, payload.cartSubtotal);

    return { coupon, discount };
};

export const CouponServices = {
    createCouponIntoDB,
    getAllCouponsFromDB,
    getSingleCouponFromDB,
    updateCouponIntoDB,
    deleteCouponFromDB,
    verifyCouponFromDB,
};