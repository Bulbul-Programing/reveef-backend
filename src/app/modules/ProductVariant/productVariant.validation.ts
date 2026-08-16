import { z } from "zod";
import { Types } from "mongoose";

const objectId = z.string().refine((val) => Types.ObjectId.isValid(val), {
  message: "Invalid id",
});

const colorSchema = z.object({
  name: z.string({ message: "Color name is required" }).trim().min(1),
  hexCode: z
    .string()
    .trim()
    .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, "Invalid hex color code")
    .optional(),
});

const createProductVariantValidationSchema = z.object({
  body: z.object({
    product: objectId,
    sku: z.string().trim().toUpperCase().optional(), // auto-generated if omitted
    size: z.string({ message: "Size is required" }).trim().min(1),
    color: colorSchema,
    price: z.number({ message: "Price is required" }).min(0),
    stock: z.number().min(0).default(0),
    image: z.string().url("Invalid image URL").optional(),
    isActive: z.boolean().optional(),
  }),
});

const updateProductVariantValidationSchema = z.object({
  body: z
    .object({
      sku: z.string().trim().toUpperCase().optional(),
      size: z.string().trim().min(1).optional(),
      color: colorSchema.partial().optional(),
      price: z.number().min(0).optional(),
      image: z.string().url("Invalid image URL").optional(),
      isActive: z.boolean().optional(),
      // NOTE: `product` and `stock` are intentionally excluded.
      // - product: a variant should never be reassigned to a different product
      // - stock: goes through PATCH /:id/stock -> adjustStockIntoDB (atomic $inc)
    })
    .strict(),
});

const adjustStockValidationSchema = z.object({
  body: z.object({
    // positive = restock, negative = deduct (e.g. order placed / damaged goods)
    quantity: z
      .number({ message: "Quantity is required" })
      .int("Quantity must be a whole number")
      .refine((val) => val !== 0, "Quantity cannot be zero"),
  }),
});

export const ProductVariantValidation = {
  createProductVariantValidationSchema,
  updateProductVariantValidationSchema,
  adjustStockValidationSchema,
};