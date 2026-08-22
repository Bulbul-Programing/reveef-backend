import { Router } from "express";
import { OrderControllers } from "./order.controller.ts";
import { checkAuth } from "../../middleware/checkAuth.ts";
import { validateRequest } from "../../middleware/validateRequest.ts";
import { OrderValidation } from "./order.validation.ts";
import optionalAuth from "../../middleware/optionalAuth.ts";

const router = Router();

// bKash hits this without auth — it's a redirect from bKash's server
router.get("/bkash/callback", OrderControllers.bkashCallback);

router.post(
    "/",
    optionalAuth,
    //   checkAuth("user"),
    validateRequest(OrderValidation.createOrder),
    OrderControllers.createOrder
);

router.get(
    "/",
    checkAuth("customer", "staff", "admin"),
    OrderControllers.getAllOrders
);

router.get(
    "/:id",
    checkAuth("customer", "staff", "admin"),
    OrderControllers.getSingleOrder
);

router.patch(
    "/:id/status",
    checkAuth("staff", "admin"),
    validateRequest(OrderValidation.updateOrderStatus),
    OrderControllers.updateOrderStatus
);

router.patch(
    "/:id/payment-status",
    checkAuth("staff", "admin"),
    validateRequest(OrderValidation.updatePaymentStatus),
    OrderControllers.updatePaymentStatus
);

router.patch(
    "/:id/cancel",
    checkAuth("customer", "staff", "admin"),
    OrderControllers.cancelOrder
);

export const orderRouter = router