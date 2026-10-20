import { Schema, model } from "mongoose";
import type { TFreeShipping } from "./FreeShipping.interface.ts";

const FREE_SHIPPING_CONFIG_ID = "free-shipping-config";

const freeShippingSchema = new Schema(
    {
        _id: {
            type: String,
            default: FREE_SHIPPING_CONFIG_ID,
        },
        minimumPurchase: {
            type: Number,
            required: true,
            min: 0,
            default: 1000,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

export const freeShippingModel = model<TFreeShipping>(
    "FreeShipping",
    freeShippingSchema
);

export { FREE_SHIPPING_CONFIG_ID };