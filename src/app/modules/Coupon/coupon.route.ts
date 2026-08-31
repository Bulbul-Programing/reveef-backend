import { Router } from "express";
import { CouponValidation } from "./coupon.validation.ts";
import { CouponControllers } from "./coupon.controller.ts";
import { validateRequest } from "../../middleware/validateRequest.ts";
import { checkAuth } from "../../middleware/checkAuth.ts";

const router = Router();

// user, staff, admin — verify/apply a coupon code at checkout.
// This is intentionally open to guests too if your checkAuth allows optional
// auth on this route; swap for optionalAuth (from the Order module) if guest
// users should be able to apply coupons before an account exists.
router.post(
    "/verify",
    validateRequest(CouponValidation.verifyCoupon),
    CouponControllers.verifyCoupon
);

// staff/admin only — full coupon management
router.post(
    "/",
    checkAuth("staff", "admin"),
    validateRequest(CouponValidation.createCoupon),
    CouponControllers.createCoupon
);

router.get("/", checkAuth("staff", "admin"), CouponControllers.getAllCoupons);

router.get("/:id", checkAuth("staff", "admin"), CouponControllers.getSingleCoupon);

router.patch(
    "/:id",
    checkAuth("staff", "admin"),
    validateRequest(CouponValidation.updateCoupon),
    CouponControllers.updateCoupon
);

// admin only — deleting a coupon outright is more destructive than
// deactivating it (isActive: false via PATCH), so it's admin-gated
router.delete("/:id", checkAuth("admin"), CouponControllers.deleteCoupon);

export const couponRouter = router