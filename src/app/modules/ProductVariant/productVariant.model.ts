import mongoose, { model } from "mongoose";
import type { TProductVariant } from "./productVariant.interface.ts";

const productVariantSchema = new mongoose.Schema<TProductVariant>(
    {
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true,
        },

        sku: {
            type: String,
            required: true,
            unique: true,
            uppercase: true,
            trim: true,
        },

        size: {
            type: String,
            required: true,
            trim: true,
        },

        color: {
            name: {
                type: String,
                required: true,
            },

            hexCode: {
                type: String,
            },
        },

        price: {
            type: Number,
            required: true,
            min: 0,
        },

        stock: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
        },

        image: {
            type: String,
        },

        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true, versionKey : false }
);

export const productVariantModel = model<TProductVariant>('ProductVariant', productVariantSchema);