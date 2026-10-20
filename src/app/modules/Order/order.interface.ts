import { Types } from "mongoose";

export type TOrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export type TPaymentMethod = "cod" | "bkash" | "nagad" | "card";
export type TPaymentStatus = "pending" | "paid" | "failed" | "refunded";

type TStatusLog = {
  changedBy: Types.ObjectId,
  fromStatus: TOrderStatus
  toStatus: TOrderStatus
  note?: string
  createdAt: Date
  updatedAt: Date
}

export interface TOrder {
  _id?: Types.ObjectId;
  user: Types.ObjectId;
  orderNumber: string;
  address: Types.ObjectId;
  subtotal: number;
  discount: number;
  shippingCost: number;
  total: number;
  coupon?: Types.ObjectId;
  status: TOrderStatus;
  statusLog: TStatusLog[];
  paymentMethod: TPaymentMethod;
  paymentStatus: TPaymentStatus;
  bkashPaymentID?: string;
  bkashTrxID?: string;
  createdAt?: Date;
  updatedAt?: Date;
}


export type TUpdateOrderPayload = Partial<{
  name: string;
  phoneNumber: string;
  address: string;
  division: string;
  district: string;
  upazila: string;
  discount: number;
  shippingCost: number;
  status: TOrderStatus
}>;