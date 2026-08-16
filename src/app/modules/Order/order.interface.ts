import type { ObjectId } from "mongoose";

export type TOrder = {
  user: ObjectId;
  orderNumber: string;
  address: string;
  subtotal: number;
  discount?: number;
  shippingCost?: number;
  total: number;
  coupon?: string;
  status?:
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';
  paymentMethod?: 'cod' | 'bkash' | 'nagad' | 'card';
  paymentStatus?: 'pending' | 'paid' | 'failed' | 'refunded';
  createdAt?: Date;
  updatedAt?: Date;
};