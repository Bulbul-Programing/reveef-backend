import type { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync.ts";
import { freeShippingService } from "./FreeShipping.service.ts";
import { sendResponse } from "../../utils/sendResponse.ts";

const createFreeShipping = catchAsync(
    async (req: Request, res: Response) => {
        const result = await freeShippingService.createFreeShippingIntoDB(req.body);

        sendResponse(res, {
            statusCode: 201,
            success: true,
            message: "Free shipping configuration created successfully",
            data: result,
        });
    }
);

const getFreeShipping = catchAsync(
    async (_req: Request, res: Response) => {
        const result =
            await freeShippingService.getFreeShippingFromDB();

        sendResponse(res, {
            statusCode: 200,
            success: true,
            message: "Free shipping configuration retrieved successfully",
            data: result,
        });
    }
);

const updateFreeShipping = catchAsync(
    async (req: Request, res: Response) => {
        const result =
            await freeShippingService.updateFreeShippingIntoDB(req.body);

        sendResponse(res, {
            statusCode: 200,
            success: true,
            message: "Free shipping configuration updated successfully",
            data: result,
        });
    }
);

const checkFreeShipping = catchAsync(
    async (req: Request, res: Response) => {
        const subtotal = Number(req.query.subtotal);

        if (
            req.query.subtotal === undefined ||
            !Number.isFinite(subtotal) ||
            subtotal < 0
        ) {
            return sendResponse(res, {
                statusCode: 400,
                success: false,
                message: "A valid non-negative subtotal is required",
                data: null,
            });
        }

        const result =
            await freeShippingService.checkFreeShippingEligibility(subtotal);

        sendResponse(res, {
            statusCode: 200,
            success: true,
            message: "Free shipping eligibility checked successfully",
            data: result,
        });
    }
);

export const freeShippingController = {
    createFreeShipping,
    getFreeShipping,
    updateFreeShipping,
    checkFreeShipping,
};