import mongoose, { model } from "mongoose";
import type { TReview } from "./review.interface.ts";

const reviewSchema = new mongoose.Schema<TReview>(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true,
        },

        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
        },

        comment: {
            type: String,
            trim: true,
        },

        isApproved: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

reviewSchema.index(
    { user: 1, product: 1 },
    { unique: true }
);

export const reviewModel = model<TReview>('Review', reviewSchema);