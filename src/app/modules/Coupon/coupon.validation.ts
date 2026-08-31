import { z } from "zod";

const createCoupon = z.object({
  body: z
    .object({
      code: z
        .string({ message: "Coupon code is required" })
        .trim()
        .min(3, "Code must be at least 3 characters")
        .max(20, "Code must be at most 20 characters"),
      type: z.enum(["percentage", "fixed"], {
        message: "Coupon type is required",
      }),
      value: z
        .number({ message: "Value is required" })
        .positive("Value must be greater than 0"),
      minimumPurchase: z.number().min(0).default(0),
      maximumDiscount: z.number().positive().optional(),
      usageLimit: z.number().int().positive().optional(),
      startDate: z.coerce.date({ message: "Start date is required" }),
      expiryDate: z.coerce.date({ message: "Expiry date is required" }),
      isActive: z.boolean().default(true),
    })
    .refine((data) => data.expiryDate > data.startDate, {
      message: "Expiry date must be after start date",
      path: ["expiryDate"],
    })
    .refine(
      (data) =>
        data.type !== "percentage" ||
        data.value <= 100, // percentage discount can't exceed 100%
      {
        message: "Percentage value cannot exceed 100",
        path: ["value"],
      }
    ),
});

const updateCoupon = z.object({
  body: z
    .object({
      code: z.string().trim().min(3).max(20).optional(),
      type: z.enum(["percentage", "fixed"]).optional(),
      value: z.number().positive().optional(),
      minimumPurchase: z.number().min(0).optional(),
      maximumDiscount: z.number().positive().optional(),
      usageLimit: z.number().int().positive().optional(),
      startDate: z.coerce.date().optional(),
      expiryDate: z.coerce.date().optional(),
      isActive: z.boolean().optional(),
    })
    .refine(
      (data) =>
        !data.startDate || !data.expiryDate || data.expiryDate > data.startDate,
      {
        message: "Expiry date must be after start date",
        path: ["expiryDate"],
      }
    ),
});

const verifyCoupon = z.object({
  body: z.object({
    code: z.string({ message: "Coupon code is required" }).trim(),
    cartSubtotal: z
      .number({ message: "Cart subtotal is required" })
      .min(0),
  }),
});

export const CouponValidation = {
  createCoupon,
  updateCoupon,
  verifyCoupon,
};