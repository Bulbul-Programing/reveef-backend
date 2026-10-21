import type { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync.ts";
import { sendContactEmail } from "./sendContactEmailService.ts";
import { sendResponse } from "../../utils/sendResponse.ts";
import httpStatus from "http-status";

export const sendContactEmailController = catchAsync(async (req: Request, res: Response) => {
    const sendEmail = await sendContactEmail(req.body)

    sendResponse(res, {
        statusCode: httpStatus.CREATED,
        success: true,
        message: "Mail send successfully",
        data: sendEmail,
    });
});