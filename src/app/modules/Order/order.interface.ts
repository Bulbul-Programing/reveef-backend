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
  paymentMethod: TPaymentMethod;
  paymentStatus: TPaymentStatus;
  bkashPaymentID?: string;
  bkashTrxID?: string;
  createdAt?: Date;
  updatedAt?: Date;
}