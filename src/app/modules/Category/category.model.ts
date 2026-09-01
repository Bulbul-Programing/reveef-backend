import mongoose, { model } from "mongoose";
import type { TCategory } from "./category.interface.ts";

const categorySchema = new mongoose.Schema<TCategory>({
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: String,
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    imageUrl: { type: String },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false }
}, {
    timestamps: true,
    versionKey: false
});

export const categoryModel = model<TCategory>('Category', categorySchema);