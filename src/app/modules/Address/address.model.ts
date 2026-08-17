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

        address: {
            type: String,
            required: true,
        },

        district: {
            type: String,
            required: true,
        },

        upazila: String,

        postalCode: String,

        isDefault: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true, versionKey: false }
);

export const addressModel = model<TAddress>('Address', addressSchema);