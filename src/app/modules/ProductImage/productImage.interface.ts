import type { ObjectId, Types } from "mongoose";

export type TProductImage = {
  product: Types.ObjectId;
  url: string;
  alt?: string;
  sortOrder?: number;
  createdAt?: Date;
  updatedAt?: Date;
};