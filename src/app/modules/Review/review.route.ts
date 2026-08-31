import { Router } from "express";
import { ReviewControllers } from "./review.controller.ts";
import { checkAuth } from "../../middleware/checkAuth.ts";
import { validateRequest } from "../../middleware/validateRequest.ts";
import { ReviewValidation } from "./review.validation.ts";

const router = Router();

// Public — approved reviews for a given product (used on the PDP)
router.get("/product/:productId", ReviewControllers.getProductReviews);

// Admin/stuff moderation queue — every review, including unapproved
router.get("/", checkAuth("admin", "stuff"), ReviewControllers.getAllReviews);

router.post(
  "/",
  checkAuth("customer", "admin", "stuff"),
  validateRequest(ReviewValidation.createReviewValidationSchema),
  ReviewControllers.createReview
);

router.patch(
  "/:id",
  checkAuth("customer", "admin", "stuff"),
  validateRequest(ReviewValidation.updateReviewValidationSchema),
  ReviewControllers.updateReview
);

router.patch(
  "/:id/moderate",
  checkAuth("admin", "stuff"),
  validateRequest(ReviewValidation.moderateReviewValidationSchema),
  ReviewControllers.moderateReview
);

router.delete(
  "/:id",
  checkAuth("customer", "admin", "stuff"),
  ReviewControllers.deleteReview
);

export const reviewRouter = router