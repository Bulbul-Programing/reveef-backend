import { Router } from "express";
import { validateRequest } from "../../middleware/validateRequest.ts";
import { OrderValidation } from "./order.validation.ts";
import { OrderControllers } from "./order.controller.ts";
import { checkAuth } from "../../middleware/checkAuth.ts";

const router = Router();

router.post(
    "/",
    validateRequest(OrderValidation.checkoutValidationSchema),
    OrderControllers.checkout
);

// Public — order lookup for guests, who have no way to log in yet.
// ?orderNumber=...&phoneNumber=...
router.get("/track", OrderControllers.trackOrder);

// Public — bKash redirects the browser here directly, no auth header
// attached, so this cannot sit behind checkAuth.
router.get("/payment/bkash/callback", OrderControllers.handleBkashCallback);

router.get("/me", checkAuth("customer", "admin", "stuff"), OrderControllers.getMyOrders);

router.get("/", checkAuth("admin", "stuff"), OrderControllers.getAllOrders);

router.get(
    "/:id",
    checkAuth("customer", "admin", "stuff"),
    OrderControllers.getSingleOrder
);

router.post(
    "/:id/payment/bkash",
    checkAuth("customer", "admin", "stuff"),
    OrderControllers.initiateBkashPayment
);

router.patch(
    "/:id/status",
    checkAuth("admin", "stuff"),
    validateRequest(OrderValidation.updateOrderStatusValidationSchema),
    OrderControllers.updateOrderStatus
);

router.patch(
    "/:id/cancel",
    checkAuth("customer", "admin", "stuff"),
    OrderControllers.cancelMyOrder
);

export const orderRouter = router;