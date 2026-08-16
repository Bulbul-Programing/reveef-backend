import { Router } from "express";
import { ProductControllers } from "./product.controller.ts";
import { checkAuth } from "../../middleware/checkAuth.ts";
import { validateRequest } from "../../middleware/validateRequest.ts";
import { ProductValidation } from "./product.validation.ts";

const router = Router();

// Public storefront routes — active products only, no auth required
// Supports ?category=<id>, ?collections=<id1>,<id2>, ?minPrice, ?maxPrice, ?searchTerm
router.get("/", ProductControllers.getAllProducts);
router.get("/:id", ProductControllers.getSingleProduct);

// Admin / stuff management routes
router.post(
  "/",
  checkAuth("admin", "stuff"),
  validateRequest(ProductValidation.createProductValidationSchema),
  ProductControllers.createProduct
);

router.patch(
  "/:id",
  checkAuth("admin", "stuff"),
  validateRequest(ProductValidation.updateProductValidationSchema),
  ProductControllers.updateProduct
);

router.patch(
  "/:id/deactivate",
  checkAuth("admin", "stuff"),
  ProductControllers.deactivateProduct
);

export const productRouter = router;