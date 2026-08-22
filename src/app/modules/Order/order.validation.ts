import { z } from "zod";

const orderItemInput = z.object({
  product: z.string({ message: "Product id is required" }),
  variant: z.string({ message: "Variant id is required" }),
  quantity: z
    .number({ message: "Quantity is required" })
    .int()
    .positive("Quantity must be at least 1"),
});

const createOrder = z.object({
  body: z.object({
    fullName: z.string({ message: "Full name is required" }).min(2),
    phoneNumber: z
      .string({ message: "Phone number is required" })
      .regex(/^01[3-9]\d{8}$/, "Enter a valid Bangladeshi phone number"),
    email: z.string().email("Invalid email").optional(),

    address: z.string({ message: "Address is required" }),
    district: z.string({ message: "District is required" }),
    upazila: z.string().optional(),
    postalCode: z.string().optional(),

    coupon: z.string().optional(),
    paymentMethod: z.enum(["cod", "bkash", "nagad", "card"]).default("cod"),
    items: z.array(orderItemInput).min(1, "At least one item is required"),
  }),
});

const updateOrderStatus = z.object({
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

const updatePaymentStatus = z.object({
  body: z.object({
    paymentStatus: z.enum(["pending", "paid", "failed", "refunded"]),
  }),
});

export const OrderValidation = {
  createOrder,
  updateOrderStatus,
  updatePaymentStatus,
};