import type { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync.ts';
import { loginService } from './auth.service.ts';
import { setAuthCookie } from '../../utils/setCookie.ts';

const loginUser = catchAsync(async (req: Request, res: Response) => {
  const result = await loginService.loginUser(req.body);

  setAuthCookie(res, result)

  res.status(200).json({
    success: true,
    massage: 'User logged in successfully',
    accessToken: result.accessToken,
    refreshToken : result.refreshToken
  });
});

const getUserData = catchAsync(async (req: Request, res: Response) => {
  const email = req.params.email as string
  const result = await loginService.getUserDataIntoDB(email);

  res.status(200).json({
    success: true,
    massage: 'User data retrieve successfully',
    data : result
  });
});

export const loginController = {
    loginUser,
    getUserData
}
