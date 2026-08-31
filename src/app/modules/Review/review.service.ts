import { Types } from "mongoose";
import { orderModel } from "../Order/order.model.ts";
import AppError from "../../error/AppError.ts";
import { orderItemModel } from "../OrderItem/orderItem.model.ts";
import type { TReview } from "./review.interface.ts";
import { productModel } from "../Product/product.model.ts";
import { reviewModel } from "./review.model.ts";
import type { TUserRole } from "../User/user.interface.ts";
import QueryBuilder from "../../builder/QueryBuilder.ts";

const reviewSearchableFields = ["comment"];

/**
 * Verified-purchase gate: the user must have at least one delivered order
 * containing this product before reviewing it. If you'd rather allow open
 * reviews from anyone, remove this call from createReviewIntoDB below —
 * it's isolated in this one function.
 */
const assertVerifiedPurchase = async (userId: string, productId: string) => {
  const deliveredOrderIds = await orderModel
    .find({ user: userId, status: "delivered" })
    .distinct("_id");

  if (!deliveredOrderIds.length) {
    throw new AppError(
      403,
      "You can only review products from a delivered order"
    );
  }

  const hasPurchased = await orderItemModel.exists({
    order: { $in: deliveredOrderIds },
    product: productId,
  });

  if (!hasPurchased) {
    throw new AppError(
      403,
      "You can only review products from a delivered order"
    );
  }
};

const createReviewIntoDB = async (userId: string, payload: TReview) => {
  const product = await productModel.findById(payload.product);
  if (!product) {
    throw new AppError(404, "Product not found");
  }

  await assertVerifiedPurchase(userId, String(payload.product));

  const existingReview = await reviewModel.findOne({
    user: userId,
    product: payload.product,
  });
  if (existingReview) {
    throw new AppError(400, "You have already reviewed this product");
  }

  const result = await reviewModel.create({ ...payload, user: userId });
  return result;
};

/**
 * Public product review listing — only approved reviews, unless the
 * caller is admin/stuff (used by their own moderation-aware views).
 */
const getProductReviewsFromDB = async (
  productId: string,
  query: Record<string, unknown>,
  requesterRole?: TUserRole
) => {
  const canSeeUnapproved =
    requesterRole === "admin" || requesterRole === "stuff";

  const baseFilter: Record<string, unknown> = { product: productId };
  if (!canSeeUnapproved) {
    baseFilter.isApproved = true;
  }

  const reviewQuery = new QueryBuilder(
    reviewModel.find(baseFilter).populate("user", "name profilePicture"),
    query
  )
    .search(reviewSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await reviewQuery.modelQuery;
  const meta = await reviewQuery.countTotal();

  return { meta, result };
};

/**
 * Admin/stuff moderation queue — every review across every product,
 * including ones awaiting approval.
 */
const getAllReviewsFromDB = async (query: Record<string, unknown>) => {
  const reviewQuery = new QueryBuilder(
    reviewModel
      .find()
      .populate("user", "name")
      .populate("product", "name slug"),
    query
  )
    .search(reviewSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await reviewQuery.modelQuery;
  const meta = await reviewQuery.countTotal();

  return { meta, result };
};

const updateReviewIntoDB = async (
  reviewId: string,
  payload: Partial<TReview>,
  userId: string
) => {
  const review = await reviewModel.findById(reviewId);
  if (!review) {
    throw new AppError(404, "Review not found");
  }

  if (String(review.user) !== userId) {
    throw new AppError(403, "You are not allowed to update this review");
  }

  const result = await reviewModel.findByIdAndUpdate(reviewId, payload, {
    new: true,
    runValidators: true,
  });

  return result;
};

const moderateReviewIntoDB = async (reviewId: string, isApproved: boolean) => {
  const review = await reviewModel.findById(reviewId);
  if (!review) {
    throw new AppError(404, "Review not found");
  }

  const result = await reviewModel.findByIdAndUpdate(
    reviewId,
    { isApproved },
    { new: true }
  );

  return result;
};

const deleteReviewFromDB = async (
  reviewId: string,
  userId: string,
  userRole: TUserRole
) => {
  const review = await reviewModel.findById(reviewId);
  if (!review) {
    throw new AppError(404, "Review not found");
  }

  const isOwner = String(review.user) === userId;
  const isStaff = userRole === "admin" || userRole === "stuff";

  if (!isOwner && !isStaff) {
    throw new AppError(403, "You are not allowed to delete this review");
  }

  await reviewModel.findByIdAndDelete(reviewId);
  return null;
};

/**
 * Aggregate rating summary for a product's PDP. Computed on the fly rather
 * than denormalized onto Product, so no schema migration is needed — only
 * counts approved reviews, matching the public listing's visibility rule.
 */
const getProductRatingSummary = async (productId: string) => {
  const [summary] = await reviewModel.aggregate([
    {
      $match: {
        product: new Types.ObjectId(productId),
        isApproved: true,
      },
    },
    {
      $group: {
        _id: "$product",
        averageRating: { $avg: "$rating" },
        reviewCount: { $sum: 1 },
      },
    },
  ]);

  return {
    averageRating: summary ? Math.round(summary.averageRating * 10) / 10 : 0,
    reviewCount: summary ? summary.reviewCount : 0,
  };
};

export const ReviewServices = {
  createReviewIntoDB,
  getProductReviewsFromDB,
  getAllReviewsFromDB,
  updateReviewIntoDB,
  moderateReviewIntoDB,
  deleteReviewFromDB,
  getProductRatingSummary,
};