import type { ObjectId } from "mongoose";

export type THero = {
  title: string;
  subtitle?: string;
  image: string;
  buttonText?: string;
  buttonLink?: string;
  collection?: string;
  product?: string;
  sortOrder?: number;
  isActive?: boolean;
  startDate?: Date;
  endDate?: Date;
  createdAt?: Date;
  updatedAt?: Date;
};