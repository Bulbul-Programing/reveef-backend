import express from "express";
import { freeShippingController } from "./FreeShipping.controller.ts";
import { validateRequest } from "../../middleware/validateRequest.ts";
import { freeShippingValidation } from "./FreeShipping.validation.ts";

const router = express.Router();

// Public: retrieve the current threshold
router.get("/", freeShippingController.getFreeShipping);

// Public: check eligibility for a subtotal
router.get("/check", freeShippingController.checkFreeShipping);

// Admin-protected routes: add your project's existing admin/staff auth middleware
router.post(
    "/",
    validateRequest(freeShippingValidation.freeShippingSchema),
    freeShippingController.createFreeShipping
);

router.patch(
    "/",
    validateRequest(freeShippingValidation.updateFreeShippingSchema),
    freeShippingController.updateFreeShipping
);

export const freeShippingRoutes = router;