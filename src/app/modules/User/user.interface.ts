import type { ObjectId } from "mongoose";

export type TUserRole = "customer" | "admin" | "stuff";

export type TUser = {
  _id: ObjectId;
  name: string;
  email: string;
  password: string;
  profilePicture?: string;
  role: TUserRole
  phoneNumber: string;
  createdAt?: Date;
  updatedAt?: Date;
  isActive: boolean;
  needPasswordChange: boolean;
};

export interface TRequester {
  id: string;
  role: TUserRole;
}