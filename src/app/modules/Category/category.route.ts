import { Router } from "express";
import { CategoryControllers } from "./category.controller.ts";
import { checkAuth } from "../../middleware/checkAuth.ts";
import { validateRequest } from "../../middleware/validateRequest.ts";
import { CategoryValidation } from "./category.validation.ts";

const router = Router();

// Public storefront routes — active categories only, no auth required
router.get("/", CategoryControllers.getAllCategories);
router.get("/:id", CategoryControllers.getSingleCategory);

// Admin / stuff management routes
router.post(
  "/",
  checkAuth("admin", "stuff"),
  validateRequest(CategoryValidation.createCategoryValidationSchema),
  CategoryControllers.createCategory
);

router.patch(
  "/:id",
  checkAuth("admin", "stuff"),
  validateRequest(CategoryValidation.updateCategoryValidationSchema),
  CategoryControllers.updateCategory
);

router.delete("/:id", checkAuth("admin"), CategoryControllers.deleteCategory);

export const categoryRouter = router