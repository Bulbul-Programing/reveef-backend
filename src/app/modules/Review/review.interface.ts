import type { ObjectId } from "mongoose";

export type TReview = {
  user: ObjectId;
  product: ObjectId;
  rating: number;
  comment?: string;
  isApproved?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};