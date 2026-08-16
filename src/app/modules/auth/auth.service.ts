import { envVars } from "../../envConfig/index.ts";
import AppError from "../../error/AppError.ts";
import { isPasswordMatched } from "../../utils/isPasswordMatch.ts";
import { createToken } from "../../utils/jwtToken.ts";
import { userModel } from "../User/user.model.ts";
import type { TLogin } from "./auth.interface.ts";

const loginUser = async (payload: TLogin) => {

  let isExistUser = await userModel.findOne({
    $or: [
      { email: payload.identifier },
      { phoneNumber: payload.identifier }
    ]
  }).select('+password')

  if (!isExistUser) {
    throw new AppError(403, 'user not found');
  }

  const isPasswordMatch = await isPasswordMatched(
    payload.password,
    (isExistUser.password as string),
  );
  if (!isPasswordMatch) {
    throw new AppError(403, 'Password do not matched');
  }

  const jwtPayload = {
    email: isExistUser.email,
    phoneNumber : isExistUser.phoneNumber,
    role: isExistUser.role,
    id: isExistUser._id
  };

  const accessToken = createToken(
    jwtPayload,
    envVars.ACCESS_TOKEN_SECRETE as string,
    envVars.ACCESS_TOKEN_EXPIRE as string,
  );
  const refreshToken = createToken(
    jwtPayload,
    envVars.ACCESS_TOKEN_SECRETE as string,
    envVars.REFRESH_TOKEN_EXPIRE as string,
  );

  return { accessToken, refreshToken }
};

const getUserDataIntoDB = async (email: string) => {
  const getUser = await userModel.findOne({ email }).select({ password: 0 })
  if (!getUser) {
    throw new AppError(404, 'User not found')
  }
  return getUser
}

export const loginService = {
  loginUser,
  getUserDataIntoDB
};
