import type { ObjectId } from "mongoose";

export type TProduct = {
    name: string;
    slug: string;
    description: string;
    category: ObjectId;
    collections?: string[];
    basePrice: number;
    discountPrice?: number;
    isFeatured?: boolean;
    isActive?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
};