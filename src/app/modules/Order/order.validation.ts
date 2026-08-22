import { z } from "zod";
import { Types } from "mongoose";

const objectId = z.string().refine((val) => Types.ObjectId.isValid(val), {
  message: "Invalid id",
});

const checkoutValidationSchema = z.object({
  body: z.object({
    // Account identity — matched by phoneNumber. If this number already
    // has an account, it's reused (name is not overwritten there).
    name: z.string({ message: "Name is required" }).trim().min(1),
    phoneNumber: z
      .string({ message: "Phone number is required" })
      .trim()
      .min(6),

    address: z.object({
      fullName: z
        .string({ message: "Recipient name is required" })
        .trim()
        .min(1),
      // Optional here — defaults to the top-level phoneNumber in the
      // service if the delivery contact number is the same person.
      phoneNumber: z.string().trim().min(6).optional(),
      address: z
        .string({ message: "Address is required" })
        .trim()
        .min(1),
      district: z
        .string({ message: "District is required" })
        .trim()
        .min(1),
      upazila: z
        .string({ message: "Upazila is required" })
        .trim()
        .min(1),
      postalCode: z.string().trim().optional(),
    }),

    items: z
      .array(
        z.object({
          variant: objectId,
          quantity: z.number().int().min(1),
        })
      )
      .min(1, "Order must contain at least one item"),

    paymentMethod: z.enum(["cod", "bkash", "nagad", "card"]).default("cod"),
    couponCode: z.string().trim().toUpperCase().optional(),
  }),
});

const updateOrderStatusValidationSchema = z.object({
  body: z.object({
    status: z.enum([
      "pending",
      "confirmed",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
    ]),
  }),
});

export const OrderValidation = {
  checkoutValidationSchema,
  updateOrderStatusValidationSchema,
};