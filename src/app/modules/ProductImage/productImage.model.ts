import mongoose, { model } from "mongoose";
import type { TProductImage } from "./productImage.interface.ts";

const productImageSchema = new mongoose.Schema<TProductImage>(
    {
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true,
        },

        url: {
            type: String,
            required: true,
        },

        alt: {
            type: String,
        },

        sortOrder: {
            type: Number,
            default: 0,
        },
    },
    { timestamps: true, versionKey : false }
);

export const productImageModel = model<TProductImage>('productImage', productImageSchema);