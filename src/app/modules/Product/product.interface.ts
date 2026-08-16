import type { ObjectId, Types } from "mongoose";

export type TProduct = {
    name: string;
    slug: string;
    description: string;
    category: Types.ObjectId;
    collections?: Types.ObjectId[];
    basePrice: number;
    discountPrice?: number;
    isFeatured?: boolean;
    isActive?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
};