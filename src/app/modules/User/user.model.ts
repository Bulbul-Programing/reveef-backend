import mongoose, { model } from "mongoose";
import type { TUser } from "./user.interface.ts";

const userSchema = new mongoose.Schema<TUser>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },

        email: {
            type: String,
            unique: true,
            sparse: true,
            lowercase: true,
            trim: true,
        },

        profilePicture: {
            type: String,
            required: false
        },

        password: {
            type: String,
            required: true,
            select: false,
        },

        phoneNumber: {
            type: String,
            trim: true,
            required: true,
        },

        role: {
            type: String,
            enum: ["customer", "admin", "stuff"],
            default: "customer",
        },

        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true, versionKey : false }
);

export const userModel = model<TUser>('user', userSchema)