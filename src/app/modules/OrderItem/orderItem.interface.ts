import type { ObjectId } from "mongoose";

export type TOrderItem = {
  order: string;
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