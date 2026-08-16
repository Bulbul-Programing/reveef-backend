import type { ObjectId } from "mongoose";

export type TProductImage = {
  product: ObjectId;
  url: string;
  alt?: string;
  sortOrder?: number;
  createdAt?: Date;
  updatedAt?: Date;
};