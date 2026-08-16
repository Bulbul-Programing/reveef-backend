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

export const ProductValidation = {
  createProductValidationSchema,
  updateProductValidationSchema,
};