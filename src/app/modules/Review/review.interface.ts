import { Types } from "mongoose";

export interface TReview {
  _id?: Types.ObjectId;
  user: Types.ObjectId;
  product: Types.ObjectId;
  rating: number;
  comment?: string;
  isApproved: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}