import mongoose, { model } from "mongoose";
import type { TCoupon } from "./coupon.interface.ts";

const couponSchema = new mongoose.Schema<TCoupon>(
    {
        code: {
            type: String,
            required: true,
            unique: true,
            uppercase: true,
            trim: true,
        },

        type: {
            type: String,
            enum: ["percentage", "fixed"],
            required: true,
        },

        value: {
            type: Number,
            required: true,
            min: 0,
        },

        minimumPurchase: {
            type: Number,
            default: 0,
        },

        maximumDiscount: {
            type: Number,
        },

        usageLimit: {
            type: Number,
        },

        usedCount: {
            type: Number,
            default: 0,
        },

        startDate: {
            type: Date,
            required: true,
        },

        expiryDate: {
            type: Date,
            required: true,
        },

        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true, versionKey: false }
);

export const couponModel = model<TCoupon>('coupon', couponSchema);