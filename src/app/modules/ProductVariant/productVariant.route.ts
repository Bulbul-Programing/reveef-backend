import { Router } from "express";
import { ProductVariantControllers } from "./productVariant.controller.ts";
import { checkAuth } from "../../middleware/checkAuth.ts";
import { validateRequest } from "../../middleware/validateRequest.ts";
import { ProductVariantValidation } from "./productVariant.validation.ts";

const router = Router();

// Public storefront routes — active variants only, no auth required
// Supports ?product=<id> to list all variants for a given product
router.get("/", ProductVariantControllers.getAllProductVariants);
router.get("/:id", ProductVariantControllers.getSingleProductVariant);

// Admin / stuff management routes
router.post(
    "/",
    checkAuth("admin", "stuff"),
    validateRequest(
        ProductVariantValidation.createProductVariantValidationSchema
    ),
    ProductVariantControllers.createProductVariant
);

router.patch(
    "/:id",
    checkAuth("admin", "stuff"),
    validateRequest(
        ProductVariantValidation.updateProductVariantValidationSchema
    ),
    ProductVariantControllers.updateProductVariant
);

router.patch(
    "/:id/stock",
    checkAuth("admin", "stuff"),
    validateRequest(ProductVariantValidation.adjustStockValidationSchema),
    ProductVariantControllers.adjustStock
);

router.patch(
    "/:id/deactivate",
    checkAuth("admin", "stuff"),
    ProductVariantControllers.deactivateProductVariant
);

export const productVariantRouter = router;