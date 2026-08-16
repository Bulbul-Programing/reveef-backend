import type { ObjectId } from "mongoose";

export type TProductVariant = {
  product: ObjectId;
  sku: string;
  size: string;
  color: {
    name: string;
    hexCode?: string;
  };
  price: number;
  stock: number;
  image?: string;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};