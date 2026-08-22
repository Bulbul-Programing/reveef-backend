import httpStatus from "http-status";
import catchAsync from "../../utils/catchAsync.ts";
import { OrderServices } from "./order.service.ts";
import { sendResponse } from "../../utils/sendResponse.ts";

const createOrder = catchAsync(async (req, res) => {
    // req.user is only present if the request carried a valid token —
    // see the optional-auth note below. If absent, this is a guest checkout.
    const authUserId = req.user?.id;

    const { order, bkashURL } = await OrderServices.createOrderIntoDB(
        authUserId,
        req.body
    );

    sendResponse(res, {
        statusCode: httpStatus.CREATED,
        success: true,
        message: bkashURL
            ? "Order created — redirect to bKash to complete payment"
            : "Order placed successfully",
        data: { order, bkashURL },
    });
});

// bKash redirects here with ?paymentID=...&status=success|failure|cancel
const bkashCallback = catchAsync(async (req, res) => {
    const { paymentID, status } = req.query as {
        paymentID: string;
        status: string;
    };

    if (status !== "success") {
        return sendResponse(res, {
            statusCode: httpStatus.OK,
            success: false,
            message: `Payment ${status}`,
            data: null,
        });
    }

    const order = await OrderServices.executeBkashPaymentIntoDB(paymentID);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: order.paymentStatus === "paid",
        message:
            order.paymentStatus === "paid"
                ? "Payment completed successfully"
                : "Payment could not be completed",
        data: order,
    });
});

const getAllOrders = catchAsync(async (req, res) => {
    const authUser = req.user as { id: string; role: string };
    const { result, meta } = await OrderServices.getAllOrdersFromDB(
        req.query,
        authUser
    );

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Orders retrieved successfully",
        meta,
        data: result,
    });
});

const getSingleOrder = catchAsync(async (req, res) => {
    const authUser = req.user as { id: string; role: string };
    const result = await OrderServices.getSingleOrderFromDB(
        req.params.id as string,
        authUser
    );

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Order retrieved successfully",
        data: result,
    });
});

const updateOrderStatus = catchAsync(async (req, res) => {
    const result = await OrderServices.updateOrderStatusInDB(
        req.params.id as string,
        req.body.status
    );

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Order status updated successfully",
        data: result,
    });
});

const updatePaymentStatus = catchAsync(async (req, res) => {
    const result = await OrderServices.updatePaymentStatusInDB(
        req.params.id as string,
        req.body.paymentStatus
    );

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Payment status updated successfully",
        data: result,
    });
});

const cancelOrder = catchAsync(async (req, res) => {
    const authUser = req.user as { id: string; role: string };
    const result = await OrderServices.cancelOrderInDB(req.params.id as string, authUser);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Order cancelled successfully",
        data: result,
    });
});

export const OrderControllers = {
    createOrder,
    bkashCallback,
    getAllOrders,
    getSingleOrder,
    updateOrderStatus,
    updatePaymentStatus,
    cancelOrder,
};