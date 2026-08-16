import mongoose, { model } from "mongoose";
import type { TOrder } from "./order.interface.ts";

const orderSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        orderNumber: {
            type: String,
            required: true,
            unique: true,
        },

        address: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Address",
            required: true,
        },

        subtotal: {
            type: Number,
            required: true,
            min: 0,
        },

        discount: {
            type: Number,
            default: 0,
            min: 0,
        },

        shippingCost: {
            type: Number,
            default: 0,
            min: 0,
        },

        total: {
            type: Number,
            required: true,
            min: 0,
        },

        coupon: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Coupon",
        },

        status: {
            type: String,
            enum: [
                "pending",
                "confirmed",
                "processing",
                "shipped",
                "delivered",
                "cancelled",
            ],
            default: "pending",
        },

        paymentMethod: {
            type: String,
            enum: ["cod", "bkash", "nagad", "card"],
            default: "cod",
        },

        paymentStatus: {
            type: String,
            enum: ["pending", "paid", "failed", "refunded"],
            default: "pending",
        },
    },
    { timestamps: true, versionKey : false }
);

export const orderModel = model<TOrder>('Order', orderSchema);