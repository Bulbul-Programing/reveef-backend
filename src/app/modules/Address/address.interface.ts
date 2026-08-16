import type { ObjectId } from "mongoose";

export type TAddress = {
  user: ObjectId;
  fullName: string;
  phone: string;
  addressLine: string;
  city: string;
  area?: string;
  postalCode?: string;
  isDefault?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};