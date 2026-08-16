import type { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync.ts";
import { ProductVariantServices } from "./productVariant.service.ts";
import { sendResponse } from "../../utils/sendResponse.ts";

const createProductVariant = catchAsync(async (req: Request, res: Response) => {
  const result = await ProductVariantServices.createProductVariantIntoDB(
    req.body
  );

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Product variant created successfully",
    data: result,
  });
});

const getAllProductVariants = catchAsync(async (req: Request, res: Response) => {
  const { meta, result } =
    await ProductVariantServices.getAllProductVariantsFromDB(
      req.query,
      req.user?.role
    );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Product variants retrieved successfully",
    meta,
    data: result,
  });
});

const getSingleProductVariant = catchAsync(async (req: Request, res: Response) => {
  const result = await ProductVariantServices.getSingleProductVariantFromDB(
    req.params.id as string,
    req.user?.role
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Product variant retrieved successfully",
    data: result,
  });
});

const updateProductVariant = catchAsync(async (req: Request, res: Response) => {
  const result = await ProductVariantServices.updateProductVariantIntoDB(
    req.params.id as string,
    req.body
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Product variant updated successfully",
    data: result,
  });
});

const adjustStock = catchAsync(async (req: Request, res: Response) => {
  const result = await ProductVariantServices.adjustStockIntoDB(
    req.params.id as string,
    req.body.quantity
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Stock adjusted successfully",
    data: result,
  });
});

const deactivateProductVariant = catchAsync(async (req: Request, res: Response) => {
  const result = await ProductVariantServices.deactivateProductVariantIntoDB(
    req.params.id as string
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Product variant deactivated successfully",
    data: result,
  });
});

export const ProductVariantControllers = {
  createProductVariant,
  getAllProductVariants,
  getSingleProductVariant,
  updateProductVariant,
  adjustStock,
  deactivateProductVariant,
};