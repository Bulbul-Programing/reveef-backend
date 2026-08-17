import { Router } from "express";
import { checkAuth } from "../../middleware/checkAuth.ts";
import { validateRequest } from "../../middleware/validateRequest.ts";
import { AddressValidation } from "./address.validation.ts";
import { AddressControllers } from "./address.controller.ts";

const router = Router();

router.post(
    "/",
    checkAuth("customer", "admin", "stuff"),
    validateRequest(AddressValidation.createAddressValidationSchema),
    AddressControllers.createAddress
);

router.get(
    "/me",
    checkAuth("customer", "admin", "stuff"),
    AddressControllers.getMyAddresses
);

// Admin/stuff lookup for order fulfillment & support — read-only,
// editing/deleting stays owner-only regardless of role.
router.get(
    "/user/:userId",
    checkAuth("admin", "stuff"),
    AddressControllers.getUserAddresses
);

router.get(
    "/:id",
    checkAuth("customer", "admin", "stuff"),
    AddressControllers.getSingleAddress
);

router.patch(
    "/:id",
    checkAuth("customer", "admin", "stuff"),
    validateRequest(AddressValidation.updateAddressValidationSchema),
    AddressControllers.updateAddress
);

router.delete(
    "/:id",
    checkAuth("customer", "admin", "stuff"),
    AddressControllers.deleteAddress
);

export const addressRouter = router;