import mongoose, { model } from "mongoose";
import type { TOrderItem } from "./orderItem.interface.ts";

const orderItemSchema = new mongoose.Schema(
    {
        order: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            required: true,
        },

        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true,
        },

        variant: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ProductVariant",
            required: true,
        },

        productName: {
            type: String,
            required: true,
        },

        sku: {
            type: String,
            required: true,
        },

        size: String,

        color: String,

        price: {
            type: Number,
            required: true,
        },

        quantity: {
            type: Number,
            required: true,
            min: 1,
        },

        total: {
            type: Number,
            required: true,
        },
    },
    { timestamps: true, versionKey : false }
);

export const orderItemModel = model<TOrderItem>('orderItem', orderItemSchema);