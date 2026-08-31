import type { ObjectId } from "mongoose";

export type TCoupon = {
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  minimumPurchase?: number;
  maximumDiscount?: number;
  usageLimit?: number;
  usedCount?: number;
  startDate: Date;
  expiryDate: Date;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};


export type TVerifyCouponInput = {
  code: string;
  cartSubtotal: number;
};