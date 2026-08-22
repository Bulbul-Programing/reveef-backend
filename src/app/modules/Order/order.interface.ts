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

export type TBkashInfo = {
  paymentID?: string;
  trxID?: string;
  transactionStatus?: string;
  amount?: number;
  paymentCreateTime?: string;
  paymentExecuteTime?: string;
};

export type TOrder = {
  user: Types.ObjectId;
  orderNumber: string;
  address: Types.ObjectId;
  subtotal: number;
  discount?: number;
  shippingCost?: number;
  total: number;
  coupon?: Types.ObjectId;
  status: TOrderStatus;
  paymentMethod: TPaymentMethod;
  paymentStatus: TPaymentStatus;
  bkash?: TBkashInfo;
};

export type TCreateOrderItemInput = {
  product: string;
  variant: string;
  quantity: number;
};

// Flat checkout payload — covers both guest and logged-in users.
// fullName/phone double as (a) the customer/account identity and
// (b) the delivery address contact info.
export type TCreateOrderInput = {
  fullName: string;
  phoneNumber: string;
  email?: string;
  address: string;
  district: string;
  upazila?: string;
  postalCode?: string;
  coupon?: string;
  paymentMethod: TPaymentMethod;
  items: TCreateOrderItemInput[];
};