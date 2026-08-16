import { Router } from "express";
import { ProductImageControllers } from "./productImage.controller.ts";
import { checkAuth } from "../../middleware/checkAuth.ts";
import { validateRequest } from "../../middleware/validateRequest.ts";
import { ProductImageValidation } from "./productImage.validation.ts";

const router = Router();

// Public gallery routes — supports ?product=<id> to fetch one product's images
router.get("/", ProductImageControllers.getAllProductImages);

// Admin / stuff management routes
router.post(
  "/",
  checkAuth("admin", "stuff"),
  validateRequest(ProductImageValidation.createProductImageValidationSchema),
  ProductImageControllers.createProductImage
);

// Must be registered before "/:id" — otherwise Express treats "reorder"
// as an :id param and this route is never reached.
router.patch(
  "/reorder",
  checkAuth("admin", "stuff"),
  validateRequest(ProductImageValidation.reorderProductImagesValidationSchema),
  ProductImageControllers.reorderProductImages
);

router.get("/:id", ProductImageControllers.getSingleProductImage);

router.patch(
  "/:id",
  checkAuth("admin", "stuff"),
  validateRequest(ProductImageValidation.updateProductImageValidationSchema),
  ProductImageControllers.updateProductImage
);

router.delete(
  "/:id",
  checkAuth("admin", "stuff"),
  ProductImageControllers.deleteProductImage
);

export const productImageRouter = router;