import type { ObjectId } from "mongoose";

export interface TResetPassword {
  _id: ObjectId;
  resetPasswordToken: string;
  createdAt : Date
}