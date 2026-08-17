import type { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync.ts";
import { AddressServices } from "./address.service.ts";
import { sendResponse } from "../../utils/sendResponse.ts";

const createAddress = catchAsync(async (req: Request, res: Response) => {
  const result = await AddressServices.createAddressIntoDB(
    req.user.id,
    req.body
  );

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Address added successfully",
    data: result,
  });
});

const getMyAddresses = catchAsync(async (req: Request, res: Response) => {
  const { meta, result } = await AddressServices.getAddressesByUserFromDB(
    req.user.id,
    req.query
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Addresses retrieved successfully",
    meta,
    data: result,
  });
});

const getUserAddresses = catchAsync(async (req: Request, res: Response) => {
  const { meta, result } = await AddressServices.getAddressesByUserFromDB(
    req.params.userId as string,
    req.query
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Addresses retrieved successfully",
    meta,
    data: result,
  });
});

const getSingleAddress = catchAsync(async (req: Request, res: Response) => {
  const result = await AddressServices.getSingleAddressFromDB(
    req.params.id as string,
    { id: req.user.id, role: req.user.role }
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Address retrieved successfully",
    data: result,
  });
});

const updateAddress = catchAsync(async (req: Request, res: Response) => {
  const result = await AddressServices.updateAddressIntoDB(
    req.params.id as string,
    req.body,
    req.user.id
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Address updated successfully",
    data: result,
  });
});

const deleteAddress = catchAsync(async (req: Request, res: Response) => {
  await AddressServices.deleteAddressFromDB(req.params.id as string, req.user.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Address deleted successfully",
    data: null,
  });
});

export const AddressControllers = {
  createAddress,
  getMyAddresses,
  getUserAddresses,
  getSingleAddress,
  updateAddress,
  deleteAddress,
};