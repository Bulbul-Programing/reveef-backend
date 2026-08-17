import bcrypt from "bcryptjs";
import AppError from "../../error/AppError.ts";
import type { TRequester, TUser, TUserRole } from "./user.interface.ts";
import { userModel } from "./user.model.ts";
import QueryBuilder from "../../builder/QueryBuilder.ts";

const userSearchableFields = ["name", "email", "phoneNumber"];

const createUserIntoDB = async (payload: TUser) => {
  const existingUser = await userModel.findOne({ email: payload.email });
  if (existingUser) {
    throw new AppError(400, "This email is already registered");
  }

  const hashedPassword = await bcrypt.hash(payload.password, 10);

  // Public registration can never set its own role or isActive.
  const userData = {
    ...payload,
    password: hashedPassword,
    role: "customer" as TUserRole,
    isActive: true,
  };

  const result = await userModel.create(userData);
  return result;
};

const getAllUsersFromDB = async (query: Record<string, unknown>) => {
  const userQuery = new QueryBuilder(userModel.find(), query)
    .search(userSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await userQuery.modelQuery;
//   const meta = await userQuery.countTotal();

  return {  result };
};

const getMyProfileFromDB = async (userId: string) => {
  const user = await userModel.findById(userId);
  if (!user) {
    throw new AppError(404, "User not found");
  }
  return user;
};

const getSingleUserFromDB = async (targetId: string, requester: TRequester) => {
  const user = await userModel.findById(targetId);
  if (!user) {
    throw new AppError(404, "User not found");
  }
  return shapeUserResponse(user, requester);
};

const updateUserIntoDB = async (
  targetId: string,
  payload: Partial<TUser>,
  requester: TRequester
) => {
  const user = await userModel.findById(targetId);
  if (!user) {
    throw new AppError(404, "User not found");
  }

  const isOwner = String(user._id) === requester.id;
  const isAdmin = requester.role === "admin";

  if (!isOwner && !isAdmin) {
    throw new AppError(403, "You are not allowed to update this profile");
  }

  const result = await userModel.findByIdAndUpdate(targetId, payload, {
    new: true,
    runValidators: true,
  });

  return result;
};

const updateUserRoleIntoDB = async (targetId: string, role: TUserRole) => {
  const user = await userModel.findById(targetId);
  if (!user) {
    throw new AppError(404, "User not found");
  }

  const result = await userModel.findByIdAndUpdate(
    targetId,
    { role },
    { returnDocument: 'after' }
  );

  return result;
};

const updateUserStatusIntoDB = async (targetId: string, isActive: boolean) => {
  const user = await userModel.findById(targetId);
  if (!user) {
    throw new AppError(404, "User not found");
  }

  const result = await userModel.findByIdAndUpdate(
    targetId,
    { isActive },
    { returnDocument: 'after' }
  );

  return result;
};

const changePasswordIntoDB = async (
  userId: string,
  payload: { oldPassword: string; newPassword: string }
) => {
  const user = await userModel.findById(userId).select("+password");
  if (!user) {
    throw new AppError(404, "User not found");
  }

  const isPasswordCorrect = await bcrypt.compare(
    payload.oldPassword,
    user.password
  );
  if (!isPasswordCorrect) {
    throw new AppError(400, "Old password is incorrect");
  }

  const hashedPassword = await bcrypt.hash(payload.newPassword, 10);
  await userModel.findByIdAndUpdate(userId, { password: hashedPassword });

  return null;
};

const shapeUserResponse = (user: TUser, requester: TRequester) => {
  const isOwner = String(user._id) === requester.id;

  if (isOwner || requester.role === "admin") {
    return user;
  }

  if (requester.role === "stuff") {
    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      profilePicture: user.profilePicture,
      role: user.role,
      isActive: user.isActive,
    };
  }

  return {
    _id: user._id,
    name: user.name,
    profilePicture: user.profilePicture,
  };
};

export const UserServices = {
  createUserIntoDB,
  getAllUsersFromDB,
  getMyProfileFromDB,
  getSingleUserFromDB,
  updateUserIntoDB,
  updateUserRoleIntoDB,
  updateUserStatusIntoDB,
  changePasswordIntoDB,
};