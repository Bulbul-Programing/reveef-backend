import type { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync.ts";
import { CategoryServices } from "./category.service.ts";
import { sendResponse } from "../../utils/sendResponse.ts";

const createCategory = catchAsync(async (req: Request, res: Response) => {
    const result = await CategoryServices.createCategoryIntoDB(req.body);

    sendResponse(res, {
        statusCode: 201,
        success: true,
        message: "Category created successfully",
        data: result,
    });
});

const getAllCategories = catchAsync(async (req: Request, res: Response) => {
    const { meta, result } = await CategoryServices.getAllCategoriesFromDB(
        req.query,
        req.user?.role
    );

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Categories retrieved successfully",
        meta,
        data: result,
    });
});

const getSingleCategory = catchAsync(async (req: Request, res: Response) => {
    const categoryId = req.params.id as string
    const result = await CategoryServices.getSingleCategoryFromDB(
        categoryId,
        req.user?.role
    );

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Category retrieved successfully",
        data: result,
    });
});

const updateCategory = catchAsync(async (req: Request, res: Response) => {
    const categoryId = req.params.id as string
    const result = await CategoryServices.updateCategoryIntoDB(
        categoryId,
        req.body
    );

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Category updated successfully",
        data: result,
    });
});

const deleteCategory = catchAsync(async (req: Request, res: Response) => {
    const categoryId = req.params.id as string
    await CategoryServices.deleteCategoryFromDB(categoryId);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Category deleted successfully",
        data: null,
    });
});

export const CategoryControllers = {
    createCategory,
    getAllCategories,
    getSingleCategory,
    updateCategory,
    deleteCategory,
};