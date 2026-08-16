import type { Types } from "mongoose";

export type TProductVariant = {
  product: Types.ObjectId;
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