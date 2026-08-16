import mongoose, { model } from "mongoose";
import type { TCollection } from "./collection.interface.ts";

const collectionSchema = new mongoose.Schema<TCollection>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },

    description: String,

    image: String,

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true, versionKey: false }
);

export const collectionModel = model<TCollection>('collection', collectionSchema);