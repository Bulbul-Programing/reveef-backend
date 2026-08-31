import type { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync.ts";
import { ReviewServices } from "./review.service.ts";
import { sendResponse } from "../../utils/sendResponse.ts";

const createReview = catchAsync(async (req: Request, res: Response) => {
  console.log(req.user);
  const result = await ReviewServices.createReviewIntoDB(
    req.user.id,
    req.body
  );

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Review added successfully",
    data: result,
  });
});

const getProductReviews = catchAsync(async (req: Request, res: Response) => {
  const { meta, result } = await ReviewServices.getProductReviewsFromDB(
    req.params.productId as string,
    req.query,
    req.user?.role
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Reviews retrieved successfully",
    meta,
    data: result,
  });
});

const getAllReviews = catchAsync(async (req: Request, res: Response) => {
  const { meta, result } = await ReviewServices.getAllReviewsFromDB(req.query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Reviews retrieved successfully",
    meta,
    data: result,
  });
});

const updateReview = catchAsync(async (req: Request, res: Response) => {
  const result = await ReviewServices.updateReviewIntoDB(
    req.params.id as string,
    req.body,
    req.user.id
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Review updated successfully",
    data: result,
  });
});

const moderateReview = catchAsync(async (req: Request, res: Response) => {
  const result = await ReviewServices.moderateReviewIntoDB(
    req.params.id as string,
    req.body.isApproved
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Review moderated successfully",
    data: result,
  });
});

const deleteReview = catchAsync(async (req: Request, res: Response) => {
  await ReviewServices.deleteReviewFromDB(
    req.params.id as string,
    req.user.id,
    req.user.role
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Review deleted successfully",
    data: null,
  });
});

export const ReviewControllers = {
  createReview,
  getProductReviews,
  getAllReviews,
  updateReview,
  moderateReview,
  deleteReview,
};