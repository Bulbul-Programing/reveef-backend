import type { ObjectId, Types } from "mongoose";

export type TOrderItem = {
  order: Types.ObjectId;
  product: string;
  variant: string;
  productName: string;
  sku: string;
  size: string;
  color: string;
  price: number;
  quantity: number;
  total: number;
  createdAt?: Date;
  updatedAt?: Date;
};