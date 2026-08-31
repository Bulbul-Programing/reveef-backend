import httpStatus from "http-status";
import catchAsync from "../../utils/catchAsync.ts";
import type { Request, Response } from "express";
import { CouponServices } from "./coupon.service.ts";
import { sendResponse } from "../../utils/sendResponse.ts";

const createCoupon = catchAsync(async (req : Request, res : Response) => {
  const result = await CouponServices.createCouponIntoDB(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Coupon created successfully",
    data: result,
  });
});

const getAllCoupons = catchAsync(async (req : Request, res : Response) => {
  const { result, meta } = await CouponServices.getAllCouponsFromDB(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Coupons retrieved successfully",
    meta,
    data: result,
  });
});

const getSingleCoupon = catchAsync(async (req : Request, res : Response) => {
  const result = await CouponServices.getSingleCouponFromDB(req.params.id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Coupon retrieved successfully",
    data: result,
  });
});

const updateCoupon = catchAsync(async (req : Request, res : Response) => {
  const result = await CouponServices.updateCouponIntoDB(req.params.id  as string, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Coupon updated successfully",
    data: result,
  });
});

const deleteCoupon = catchAsync(async (req : Request, res : Response) => {
  await CouponServices.deleteCouponFromDB(req.params.id  as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Coupon deleted successfully",
    data: null,
  });
});

// Public/user-facing — validates a code against the caller's cart subtotal
// and returns full coupon details + computed discount if valid.
const verifyCoupon = catchAsync(async (req : Request, res : Response) => {
  const result = await CouponServices.verifyCouponFromDB(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Coupon applied successfully",
    data: result,
  });
});

export const CouponControllers = {
  createCoupon,
  getAllCoupons,
  getSingleCoupon,
  updateCoupon,
  deleteCoupon,
  verifyCoupon,
};