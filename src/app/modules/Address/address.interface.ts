import type { Types } from "mongoose";

export type TAddress = {
  user: Types.ObjectId;
  fullName: string;
  phoneNumber: string;
  address: string;
  district: string;
  upazila: string;
  postalCode?: string;
  isDefault?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};