import type { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync.ts";
import { ProductServices } from "./product.service.ts";
import { sendResponse } from "../../utils/sendResponse.ts";

const createProduct = catchAsync(async (req: Request, res: Response) => {
  const result = await ProductServices.createProductIntoDB(req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Product created successfully",
    data: result,
  });
});

const getAllProducts = catchAsync(async (req: Request, res: Response) => {
  const { meta, result } = await ProductServices.getAllProductsFromDB(
    req.query,
    req.user?.role
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Products retrieved successfully",
    meta,
    data: result,
  });
});

const getSingleProduct = catchAsync(async (req: Request, res: Response) => {
  const result = await ProductServices.getSingleProductFromDB(
    req.params.id as string,
    req.user?.role
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Product retrieved successfully",
    data: result,
  });
});

const updateProduct = catchAsync(async (req: Request, res: Response) => {
  const result = await ProductServices.updateProductIntoDB(
    req.params.id as string,
    req.body
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Product updated successfully",
    data: result,
  });
});

const deactivateProduct = catchAsync(async (req: Request, res: Response) => {
  const result = await ProductServices.deactivateProductIntoDB(req.params.id as string);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Product deactivated successfully",
    data: result,
  });
});

export const ProductControllers = {
  createProduct,
  getAllProducts,
  getSingleProduct,
  updateProduct,
  deactivateProduct,
};