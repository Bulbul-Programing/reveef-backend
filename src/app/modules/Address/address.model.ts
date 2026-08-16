import mongoose, { model } from "mongoose";
import type { TAddress } from "./address.interface.ts";

const addressSchema = new mongoose.Schema<TAddress>(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        fullName: {
            type: String,
            required: true,
        },

        phone: {
            type: String,
            required: true,
        },

        addressLine: {
            type: String,
            required: true,
        },

        city: {
            type: String,
            required: true,
        },

        area: String,

        postalCode: String,

        isDefault: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

export const addressModel = model<TAddress>('Address', addressSchema);