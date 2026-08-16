import { z } from "zod";
import { Types } from "mongoose";

const objectId = z.string().refine((val) => Types.ObjectId.isValid(val), {
  message: "Invalid id",
});

const createProductValidationSchema = z.object({
  body: z
    .object({
      name: z.string({ message: "Name is required" }).trim().min(1),
      slug: z.string().trim().toLowerCase().optional(),
      description: z
        .string({ message: "Description is required" })
        .trim()
        .min(1),
      category: objectId,
      collections: z.array(objectId).optional(),
      basePrice: z.number({ message: "Base price is required" }).min(0),
      discountPrice: z.number().min(0).optional(),
      isFeatured: z.boolean().optional(),
      isActive: z.boolean().optional(),
    })
    .refine(
      (data) =>
        data.discountPrice === undefined || data.discountPrice < data.basePrice,
      {
        message: "Discount price must be less than base price",
        path: ["discountPrice"],
      }
    ),
});

const updateProductValidationSchema = z.object({
  // NOTE: no cross-field discount/base price refine here — on a partial
  // update we might only receive one of the two fields. The service layer
  // merges this payload with the existing document and validates the
  // combined values there, where the real numbers are known.
  body: z
    .object({
      name: z.string().trim().min(1).optional(),
      slug: z.string().trim().toLowerCase().optional(),
      description: z.string().trim().min(1).optional(),
      category: objectId.optional(),
      collections: z.array(objectId).optional(),
      basePrice: z.number().min(0).optional(),
      discountPrice: z.number().min(0).optional(),
      isFeatured: z.boolean().optional(),
      isActive: z.boolean().optional(),
    })
    .strict(),
});

// ---- Composite creation: one admin form submit -> product + images + variants ----

const productImageInputSchema = z.object({
  url: z.string({ message: "Image URL is required" }).url("Invalid image URL"),
  alt: z.string().trim().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const productVariantInputSchema = z.object({
  sku: z.string().trim().toUpperCase().optional(), // auto-generated if omitted
  size: z.string({ message: "Size is required" }).trim().min(1),
  color: z.object({
    name: z.string({ message: "Color name is required" }).trim().min(1),
    hexCode: z
      .string()
      .trim()
      .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, "Invalid hex color code")
      .optional(),
  }),
  price: z.number({ message: "Variant price is required" }).min(0),
  stock: z.number().min(0).default(0),
  image: z.string().url("Invalid image URL").optional(),
  isActive: z.boolean().optional(),
});

const createProductWithDetailsValidationSchema = z.object({
  body: z
    .object({
      name: z.string({ message: "Name is required" }).trim().min(1),
      slug: z.string().trim().toLowerCase().optional(),
      description: z
        .string({ message: "Description is required" })
        .trim()
        .min(1),
      category: objectId,
      collections: z.array(objectId).optional(),
      basePrice: z.number({ message: "Base price is required" }).min(0),
      discountPrice: z.number().min(0).optional(),
      isFeatured: z.boolean().optional(),
      isActive: z.boolean().optional(),
      images: z.array(productImageInputSchema).optional(),
      // A product with zero variants can't actually be sold, so at least
      // one is required on the composite "create full product" flow.
      variants: z
        .array(productVariantInputSchema)
        .min(1, "At least one variant is required"),
    })
    .refine(
      (data) =>
        data.discountPrice === undefined || data.discountPrice < data.basePrice,
      {
        message: "Discount price must be less than base price",
        path: ["discountPrice"],
      }
    ),
});

export const ProductValidation = {
  createProductValidationSchema,
  updateProductValidationSchema,
  createProductWithDetailsValidationSchema,
};