import type { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync.ts";
import { UserServices } from "./user.service.ts";
import { sendResponse } from "../../utils/sendResponse.ts";

const createUser = catchAsync(async (req: Request, res: Response) => {
  const result = await UserServices.createUserIntoDB(req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "User registered successfully",
    data: result,
  });
});

const getAllUsers = catchAsync(async (req: Request, res: Response) => {
  const { result } = await UserServices.getAllUsersFromDB(req.query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Users retrieved successfully",
    data: result,
  });
});

const getMyProfile = catchAsync(async (req: Request, res: Response) => {
  const result = await UserServices.getMyProfileFromDB(req.user.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Profile retrieved successfully",
    data: result,
  });
});

const getSingleUser = catchAsync(async (req: Request, res: Response) => {
  const userId = req.params.id as string
  const result = await UserServices.getSingleUserFromDB(userId, {
    id: req.user.id,
    role: req.user.role,
  });

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "User retrieved successfully",
    data: result,
  });
});

const updateUser = catchAsync(async (req: Request, res: Response) => {
  const userId = req.params.id as string
  const result = await UserServices.updateUserIntoDB(userId, req.body, {
    id: req.user.id,
    role: req.user.role,
  });

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "User updated successfully",
    data: result,
  });
});

const updateUserRole = catchAsync(async (req: Request, res: Response) => {
  const userId = req.params.id as string
  const result = await UserServices.updateUserRoleIntoDB(
    userId,
    req.body.role
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "User role updated successfully",
    data: result,
  });
});

const updateUserStatus = catchAsync(async (req: Request, res: Response) => {
  const userId = req.params.id as string
  const result = await UserServices.updateUserStatusIntoDB(
    userId,
    req.body.isActive
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "User status updated successfully",
    data: result,
  });
});

const changePassword = catchAsync(async (req: Request, res: Response) => {
  await UserServices.changePasswordIntoDB(req.user.id, req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Password changed successfully",
    data: null,
  });
});

export const UserControllers = {
  createUser,
  getAllUsers,
  getMyProfile,
  getSingleUser,
  updateUser,
  updateUserRole,
  updateUserStatus,
  changePassword,
};