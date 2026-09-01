import mongoose, { model } from "mongoose";
import type { TResetPassword } from "./resetPassword.interface.ts";

const resetPasswordSchema = new mongoose.Schema<TResetPassword>(
  {
    resetPasswordToken: {
      type: String,
      select: false,
      required: true,
    },

    createdAt: {
      type: Date,
      default: Date.now,
      expires: 180, // 180 seconds = 3 minutes
    },
  },
  {
    versionKey: false,
  }
);

export const resetPasswordModel = model<TResetPassword>('resetPassword', resetPasswordSchema)