import type { JwtPayload } from "jsonwebtoken";
import { envVars } from "../../envConfig/index.ts";
import AppError from "../../error/AppError.ts";
import { isPasswordMatched } from "../../utils/isPasswordMatch.ts";
import { createToken, verifyToken } from "../../utils/jwtToken.ts";
import { userModel } from "../User/user.model.ts";
import type { TLogin } from "./auth.interface.ts";
import crypto from "crypto";
import { sendEmail } from "../../utils/sendEmail.ts";
import bcrypt from "bcryptjs";
import { resetPasswordModel } from "../ResetPassword/resetPassword.model.ts";

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
    phoneNumber: isExistUser.phoneNumber,
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
    envVars.REFRESH_TOKEN_SECRET as string,
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

const refreshToken = async (token: string) => {
  if (!token) {
    throw new AppError(401, "Refresh token is required");
  }

  let decodedToken: JwtPayload & { id: string };

  try {
    decodedToken = verifyToken(
      token,
      envVars.REFRESH_TOKEN_SECRET as string
    ) as JwtPayload & { id: string };
  } catch (error) {
    throw new AppError(401, "Invalid or expired refresh token");
  }

  const user = await userModel.findById(decodedToken.id);

  if (!user) {
    throw new AppError(404, "User not found");
  }

  if (!user.isActive) {
    throw new AppError(403, "User is inactive");
  }

  const jwtPayload = {
    id: user._id.toString(),
    email: user.email,
    phoneNumber: user.phoneNumber,
    role: user.role,
  };

  const accessToken = createToken(
    jwtPayload,
    envVars.ACCESS_TOKEN_SECRETE as string,
    envVars.ACCESS_TOKEN_EXPIRE as string
  );

  return {
    accessToken,
  };
};

const forgotPassword = async (email: string) => {
  const user = await userModel.findOne({ email });

  if (!user) {
    throw new AppError(404, "User not found");
  }

  if (!user.email) {
    throw new AppError(
      400,
      "This account does not have an email address"
    );
  }

  const jwtPayload = {
    email: user.email,
    role: user.role,
    id: user._id
  };

  const resetPasswordToken = createToken(
    jwtPayload,
    envVars.RESET_PASSWORD_SECRETE as string,
    envVars.RESET_PASSWORD_EXPIRE as string,
  );

  // store reset token in db
  await resetPasswordModel.create({
    resetPasswordToken: resetPasswordToken
  })

  // Link sent to frontend
  const resetURL =
    `${envVars.FRONTEND_URL}/reset-password?token=${resetPasswordToken}`;

  const expirationTime = 3

  const html = `
    <!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">

    <title>Reset Your Password</title>

    <style>
        /* Basic reset */
        body,
        table,
        td,
        p,
        a {
            -webkit-text-size-adjust: 100%;
            -ms-text-size-adjust: 100%;
        }

        table,
        td {
            mso-table-lspace: 0pt;
            mso-table-rspace: 0pt;
        }

        img {
            -ms-interpolation-mode: bicubic;
            border: 0;
            outline: none;
            text-decoration: none;
            display: block;
        }

        table {
            border-collapse: collapse !important;
        }

        body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: 100% !important;
            background-color: #f5f7fb;
            font-family: Arial, Helvetica, sans-serif;
        }

        @media screen and (max-width: 600px) {
            .email-container {
                width: 100% !important;
            }

            .email-content {
                padding: 32px 24px !important;
            }

            .email-title {
                font-size: 26px !important;
                line-height: 34px !important;
            }

            .button {
                width: 100% !important;
            }

            .button a {
                display: block !important;
                padding: 16px 20px !important;
            }
        }
    </style>
</head>

<body>

    <!-- Preheader text -->
    <div style="
    display:none;
    max-height:0;
    overflow:hidden;
    opacity:0;
    color:transparent;
    mso-hide:all;
  ">
        Reset your password securely and regain access to your account.
    </div>

    <!-- Outer wrapper -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f7fb;">
        <tr>
            <td align="center" style="padding:40px 16px;">

                <!-- Email container -->
                <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" border="0" style="
            width:600px;
            max-width:600px;
            background-color:#ffffff;
            border-radius:12px;
            overflow:hidden;
          ">

                    <!-- Top brand area -->
                    <tr>
                        <td align="center" style="
                border-bottom:1px solid #edf0f5;
              ">
                            <!-- Replace with your CID -->
                            <a href="${envVars.FRONTEND_URL}" target="_blank">
                                <img src="https://res.cloudinary.com/fsynam2f/image/upload/v1788198058/New_Project_15.jpg" alt="Reveef" width="100" style="
                  width:100px;
                  max-width:150px;
                  height:auto;
                  margin:0 auto;
                ">
                            </a>

                        </td>
                    </tr>

                    <!-- Main content -->
                    <tr>
                        <td class="email-content" style="
                padding:48px 56px 44px;
                color:#263238;
              ">

                            <!-- Small label -->
                            <p style="
                margin:0 0 12px;
                color:#6b7280;
                font-size:13px;
                line-height:20px;
                font-weight:bold;
                letter-spacing:0.5px;
                text-transform:uppercase;
              ">
                                Account Security
                            </p>

                            <!-- Heading -->
                            <h1 class="email-title" style="
                  margin:0 0 20px;
                  color:#102a72;
                  font-size:30px;
                  line-height:40px;
                  font-weight:700;
                  letter-spacing:-0.4px;
                ">
                                Reset your password
                            </h1>

                            <!-- Greeting -->
                            <p style="
                margin:0 0 16px;
                color:#374151;
                font-size:16px;
                line-height:26px;
              ">
                                Hi ${user.name},
                            </p>

                            <!-- Description -->
                            <p style="
                margin:0 0 24px;
                color:#4b5563;
                font-size:16px;
                line-height:27px;
              ">
                                We received a request to reset the password for your
                                account. Click the button below to choose a new password.
                            </p>

                            <!-- Button -->
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
                                <tr>
                                    <td class="button" align="center" style="
                      border-radius:8px;
                      background-color:#102a72;
                    ">
                                        <a href="${resetURL}" target="_blank" style="
                        display:inline-block;
                        padding:15px 28px;
                        border-radius:8px;
                        background-color:#102a72;
                        width : 100%;
                        color:#ffffff;
                        font-size:15px;
                        line-height:20px;
                        font-weight:bold;
                        text-decoration:none;
                      ">
                                            Reset Password
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <!-- Expiration notice -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="
                  margin:0 0 26px;
                  background-color:#f7f8fc;
                  border-left:4px solid #102a72;
                ">
                                <tr>
                                    <td style="padding:14px 16px;">
                                        <p style="
                      margin:0;
                      color:#4b5563;
                      font-size:14px;
                      line-height:22px;
                    ">
                                            <strong style="color:#1f2937;">
                                                This link expires in ${expirationTime} minutes.
                                            </strong>
                                            For your security, please reset your password before
                                            the link expires.
                                        </p>
                                    </td>
                                </tr>
                            </table>

                            <!-- Alternative link -->
                            <p style="
                margin:0 0 8px;
                color:#6b7280;
                font-size:13px;
                line-height:21px;
              ">
                                If the button above doesn't work, copy and paste the
                                following link into your browser:
                            </p>

                            <p style="
                margin:0 0 28px;
                word-break:break-all;
                color:#102a72;
                font-size:13px;
                line-height:21px;
              ">
                                <a href="${resetURL}" target="_blank" style="
                    color:#102a72;
                    text-decoration:underline;
                  ">
                                    ${resetURL}
                                </a>
                            </p>

                            <!-- Security note -->
                            <p style="
                margin:0;
                padding-top:24px;
                border-top:1px solid #edf0f5;
                color:#6b7280;
                font-size:13px;
                line-height:21px;
              ">
                                If you didn't request a password reset, you can safely
                                ignore this email. Your password will remain unchanged.
                            </p>

                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td align="center" style="
                padding:28px 30px;
                background-color:#fafbfc;
                border-top:1px solid #edf0f5;
              ">

                            <p style="
                margin:0 0 8px;
                color:#9ca3af;
                font-size:12px;
                line-height:19px;
              ">
                                This is an automated message. Please do not reply to
                                this email.
                            </p>

                            <p style="
                margin:0;
                color:#9ca3af;
                font-size:12px;
                line-height:19px;
              ">
                                &copy; 2026 Reveef. All rights reserved.
                            </p>

                        </td>
                    </tr>

                </table>

            </td>
        </tr>
    </table>

</body>

</html>
  `;

  await sendEmail(
    user.email,
    "Reset Your Password",
    html
  );

  return null;
};

const resetPassword = async (payload: {
  token: string;
  newPassword: string;
}) => {

  const resetPasswordIsExist = await resetPasswordModel
    .findOne({
      resetPasswordToken: payload.token
    })

  if (!resetPasswordIsExist) {
    throw new AppError(
      400,
      "Invalid or expired reset token"
    );
  }

  const verifiedToken = verifyToken(payload.token, envVars.RESET_PASSWORD_SECRETE) as JwtPayload

  const hashedPassword = await bcrypt.hash(
    payload.newPassword,
    Number(envVars.BCRYPT_ROUNDS)
  );

  const updateUser = await userModel.findOneAndUpdate(
    { email: verifiedToken.email },
    {
      password: hashedPassword
    }
  )

  return null;
};

export const loginService = {
  loginUser,
  getUserDataIntoDB,
  refreshToken,
  forgotPassword,
  resetPassword
};