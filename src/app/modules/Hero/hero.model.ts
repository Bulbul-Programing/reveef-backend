import mongoose, { model } from "mongoose";
import type { THero } from "./hero.interface.ts";

const heroSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
        },

        subtitle: String,

        image: {
            type: String,
            required: true,
        },

        buttonText: String,

        buttonLink: String,

        collection: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Collection",
        },

        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
        },

        sortOrder: {
            type: Number,
            default: 0,
        },

        isActive: {
            type: Boolean,
            default: true,
        },

        startDate: Date,

        endDate: Date,
    },
    { timestamps: true }
);

export const heroModel = model<THero>('Hero', heroSchema);