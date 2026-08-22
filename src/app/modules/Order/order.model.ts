import { model, Schema } from "mongoose";
import type { TOrder } from "./order.interface.ts";

const bkashSchema = new Schema(
    {
        paymentID: { type: String },
        trxID: { type: String },
        transactionStatus: { type: String },
        amount: { type: Number },
        paymentCreateTime: { type: String },
        paymentExecuteTime: { type: String },
    },
    { _id: false }
);

const orderSchema = new Schema<TOrder>(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: "user",
            required: true,
        },

        orderNumber: {
            type: String,
            required: true,
            unique: true,
        },

        address: {
            type: Schema.Types.ObjectId,
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
            type: Schema.Types.ObjectId,
            ref: "coupon",
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

        bkashPaymentID: {
            type: String,
        },

        bkashTrxID: {
            type: String,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

export const orderModel = model<TOrder>("Order", orderSchema)