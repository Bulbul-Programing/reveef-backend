import mongoose, { model } from "mongoose";
import type { TProduct } from "./product.interface.ts";

const productSchema = new mongoose.Schema<TProduct>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },

        slug: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
        },

        description: {
            type: String,
            required: true,
        },

        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Category",
            required: true,
        },

        collections: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Collection",
            },
        ],

        basePrice: {
            type: Number,
            required: true,
            min: 0,
        },

        discountPrice: {
            type: Number,
            min: 0,
        },

        isFeatured: {
            type: Boolean,
            default: false,
        },

        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

export const productModel = model<TProduct>('Product', productSchema);