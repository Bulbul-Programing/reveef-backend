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
    isDeleted?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
};

export interface TProductRef {
    _id: string;
    name: string;
    slug: string;
}

export interface TProductImage {
    _id: string;
    product: string;
    url: string;
    alt?: string;
    sortOrder: number;
}

export interface TProductVariant {
    _id: string;
    product: string;
    sku: string;
    size: string;
    color: {
        name: string;
        hexCode?: string;
        color: string
    };
    price: number;
    stock: number;
    image?: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface TDetailProduct {
    _id: string;
    id?: string;
    name: string;
    slug: string;
    description: string;
    category: string;
    collections: TProductRef[];
    basePrice: number;
    discountPrice?: number;
    isFeatured: boolean;
    isActive: boolean;
    isDeleted: boolean;
    createdAt: string;
    updatedAt: string;
    images: TProductImage[];
    variants: TProductVariant[];
}


///

// Backend product document type — adapt this to your existing schema.
export type TProductDocument = {
    _id: Types.ObjectId;
    name: string;
    slug: string;
    description: string;
    category: Types.ObjectId;
    collections?: Types.ObjectId[];
    basePrice: number;
    discountPrice?: number;
    isFeatured: boolean;
    isActive: boolean;
    isDeleted: boolean;
    createdAt: Date;
    updatedAt: Date;
};

// Use a separate type for the populated API result if needed.
export type TPopulatedProduct = Omit<
    TProductDocument,
    "category" | "collections"
> & {
    category: {
        _id: Types.ObjectId;
        name: string;
        slug: string;
    };
    collections?: {
        _id: Types.ObjectId;
        name: string;
        slug: string;
    }[];
    images: {
        _id: Types.ObjectId;
        url: string;
        alt?: string;
        sortOrder: number;
    }[];
    variants: unknown[];
};