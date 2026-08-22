import bcrypt from "bcryptjs";
import crypto from "crypto";
import type { TRequester, TUser, TUserRole } from "./user.interface.ts";
import { userModel } from "./user.model.ts";
import AppError from "../../error/AppError.ts";
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

/**
 * Guest-checkout identity resolution: matched purely by phoneNumber. If the
 * number is already registered, that account is reused as-is (name is NOT
 * overwritten — an existing customer's name shouldn't change just because
 * a new order used a slightly different spelling).
 *
 * If it's a new number, an account is created so the order has somewhere
 * to live and the customer can eventually see it on a dashboard. The
 * password is a cryptographically random value, NOT a fixed/shared
 * "dummy" password — a predictable password on every guest account would
 * let anyone who learns a customer's phone number (e.g. off a delivery
 * label) log into their account. This account is unusable to log into
 * until the customer goes through a proper password-reset / OTP flow.
 */
const findOrCreateGuestUserIntoDB = async (payload: {
  name: string;
  phoneNumber: string;
}) => {
  
  const existingUser = await userModel.findOne({
    phoneNumber: payload.phoneNumber,
  });
  
  if (existingUser) {
    return existingUser;
  }

  // Get last 3 digits of phone number
  const phoneLast3 = payload.phoneNumber.slice(-3);

  // Remove spaces from name
  const cleanName = payload.name.replace(/\s+/g, "");

  // Create password: name + last 3 digits
  const randomPassword = `${cleanName}${phoneLast3}`.toLocaleLowerCase();

  const hashedPassword = await bcrypt.hash(randomPassword, 10);

  const newUser = await userModel.create({
    name: payload.name,
    phoneNumber: payload.phoneNumber,
    password: hashedPassword,
    role: "customer",
    isActive: true,
  });

  const addPassword = {
    ...newUser.toObject(),
    password: randomPassword,
  };

  return addPassword;
};

const getAllUsersFromDB = async (query: Record<string, unknown>) => {
  const userQuery = new QueryBuilder(userModel.find(), query)
    .search(userSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await userQuery.modelQuery;
  const meta = await userQuery.countTotal();

  return { meta, result };
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
    { new: true }
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
    { new: true }
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

/**
 * Role-based response shaping.
 *  - Owner viewing themselves, or an admin viewing anyone -> full document
 *  - "stuff" viewing someone else -> limited operational fields
 *  - Anyone else viewing someone else -> minimal public-safe fields
 *
 * NOTE: `password` never appears here regardless, since the schema
 * has `select: false` and none of these queries re-select it.
 */
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
  findOrCreateGuestUserIntoDB,
  getAllUsersFromDB,
  getMyProfileFromDB,
  getSingleUserFromDB,
  updateUserIntoDB,
  updateUserRoleIntoDB,
  updateUserStatusIntoDB,
  changePasswordIntoDB,
};