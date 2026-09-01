import type { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync.ts';
import { loginService } from './auth.service.ts';
import { setAuthCookie } from '../../utils/setCookie.ts';
import { sendResponse } from '../../utils/sendResponse.ts';

const loginUser = catchAsync(async (req: Request, res: Response) => {
  const result = await loginService.loginUser(req.body);

  setAuthCookie(res, result)

  res.status(200).json({
    success: true,
    massage: 'User logged in successfully',
    accessToken: result.accessToken,
    refreshToken: result.refreshToken
  });
});

const getUserData = catchAsync(async (req: Request, res: Response) => {
  const email = req.params.email as string
  const result = await loginService.getUserDataIntoDB(email);

  res.status(200).json({
    success: true,
    massage: 'User data retrieve successfully',
    data: result
  });
});

const getAccessTokenByRefreshToken = catchAsync(async (req: Request, res: Response) => {
  const { refreshToken } = req.cookies;

  const result = await loginService.refreshToken(refreshToken);

  res.cookie("accessToken", result.accessToken, {
    secure: true,
    httpOnly: true,
    sameSite: "none",
    maxAge: 1000 * 60 * 60,
  });

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Access token generated successfully!",
    data: {
      message: "Access token generated successfully!",
    },
  });
})

const forgotPassword = catchAsync(
  async (req: Request, res: Response) => {
    await loginService.forgotPassword(req.body.email);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Password reset link sent to your email",
      data: null,
    });
  }
);

const resetPassword = catchAsync(async (req: Request, res: Response) => {

  await loginService.resetPassword(req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Password reset successfully!",
    data: null,
  });
}
);

export const loginController = {
  loginUser,
  getUserData,
  getAccessTokenByRefreshToken,
  forgotPassword,
  resetPassword
}
