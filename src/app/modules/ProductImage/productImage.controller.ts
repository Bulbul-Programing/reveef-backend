import type { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync.ts";
import { ProductImageServices } from "./productImage.service.ts";
import { sendResponse } from "../../utils/sendResponse.ts";

const createProductImage = catchAsync(async (req: Request, res: Response) => {
  const result = await ProductImageServices.createProductImageIntoDB(
    req.body
  );

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Product image added successfully",
    data: result,
  });
});

const getAllProductImages = catchAsync(async (req: Request, res: Response) => {
  const { meta, result } = await ProductImageServices.getAllProductImagesFromDB(
    req.query
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Product images retrieved successfully",
    meta,
    data: result,
  });
});

const getSingleProductImage = catchAsync(async (req: Request, res: Response) => {
  const result = await ProductImageServices.getSingleProductImageFromDB(
    req.params.id as string
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Product image retrieved successfully",
    data: result,
  });
});

const updateProductImage = catchAsync(async (req: Request, res: Response) => {
  const result = await ProductImageServices.updateProductImageIntoDB(
    req.params.id as string,
    req.body
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Product image updated successfully",
    data: result,
  });
});

const reorderProductImages = catchAsync(async (req: Request, res: Response) => {
  await ProductImageServices.reorderProductImagesIntoDB(req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Product images reordered successfully",
    data: null,
  });
});

const deleteProductImage = catchAsync(async (req: Request, res: Response) => {
  await ProductImageServices.deleteProductImageFromDB(req.params.id as string);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Product image deleted successfully",
    data: null,
  });
});

export const ProductImageControllers = {
  createProductImage,
  getAllProductImages,
  getSingleProductImage,
  updateProductImage,
  reorderProductImages,
  deleteProductImage,
};