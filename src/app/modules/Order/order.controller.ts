import type { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync.ts";
import { OrderServices } from "./order.service.ts";
import { sendResponse } from "../../utils/sendResponse.ts";

const checkout = catchAsync(async (req: Request, res: Response) => {
  const result = await OrderServices.guestCheckoutIntoDB(req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Order placed successfully",
    data: result,
  });
});

const trackOrder = catchAsync(async (req: Request, res: Response) => {
  const { orderNumber, phoneNumber } = req.query as {
    orderNumber: string;
    phoneNumber: string;
  };

  const result = await OrderServices.trackOrderFromDB(orderNumber, phoneNumber);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Order retrieved successfully",
    data: result,
  });
});

const getMyOrders = catchAsync(async (req: Request, res: Response) => {
  const { meta, result } = await OrderServices.getMyOrdersFromDB(
    req.user.id,
    req.query
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Orders retrieved successfully",
    meta,
    data: result,
  });
});

const getAllOrders = catchAsync(async (req: Request, res: Response) => {
  const { meta, result } = await OrderServices.getAllOrdersFromDB(req.query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Orders retrieved successfully",
    meta,
    data: result,
  });
});

const getSingleOrder = catchAsync(async (req: Request, res: Response) => {
  const result = await OrderServices.getSingleOrderFromDB(req.params.id as string, {
    id: req.user.id,
    role: req.user.role,
  });

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Order retrieved successfully",
    data: result,
  });
});

const updateOrderStatus = catchAsync(async (req: Request, res: Response) => {
  const result = await OrderServices.updateOrderStatusIntoDB(
    req.params.id as string,
    req.body.status
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Order status updated successfully",
    data: result,
  });
});

const cancelMyOrder = catchAsync(async (req: Request, res: Response) => {
  const result = await OrderServices.cancelMyOrderIntoDB(
    req.params.id as string,
    req.user.id
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Order cancelled successfully",
    data: result,
  });
});

const initiateBkashPayment = catchAsync(async (req: Request, res: Response) => {
  const result = await OrderServices.initiateBkashPaymentIntoDB(
    req.params.id as string,
    req.user.id
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "bKash payment initiated",
    data: result,
  });
});

/**
 * bKash redirects the customer's browser here directly — no app auth
 * token is attached, so this route sits outside checkAuth entirely.
 * Redirects to the frontend instead of returning JSON, since a browser
 * lands here, not an API client.
 */
const handleBkashCallback = catchAsync(async (req: Request, res: Response) => {
  const { paymentID, status } = req.query as {
    paymentID: string;
    status: string;
  };

  const result = await OrderServices.handleBkashCallbackIntoDB(
    paymentID,
    status
  );

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  return res.redirect(
    `${frontendUrl}/orders/${result.order._id}?payment=${result.redirectStatus}`
  );
});

export const OrderControllers = {
  checkout,
  trackOrder,
  getMyOrders,
  getAllOrders,
  getSingleOrder,
  updateOrderStatus,
  cancelMyOrder,
  initiateBkashPayment,
  handleBkashCallback,
};