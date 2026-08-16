import { z } from "zod";
import { Types } from "mongoose";

const objectId = z.string().refine((val) => Types.ObjectId.isValid(val), {
  message: "Invalid id",
});

const createProductImageValidationSchema = z.object({
  body: z.object({
    product: objectId,
    url: z.string({ message: "Image URL is required" }).url("Invalid image URL"),
    alt: z.string().trim().optional(),
    // Optional on purpose — service appends to the end of the gallery
    // (current max sortOrder for this product + 1) when omitted.
    sortOrder: z.number().int().min(0).optional(),
  }),
});

const updateProductImageValidationSchema = z.object({
  body: z
    .object({
      url: z.string().url("Invalid image URL").optional(),
      alt: z.string().trim().optional(),
      sortOrder: z.number().int().min(0).optional(),
      // `product` intentionally excluded — an image shouldn't be
      // reassigned to a different product after creation.
    })
    .strict(),
});

const reorderProductImagesValidationSchema = z.object({
  body: z
    .array(
      z.object({
        id: objectId,
        sortOrder: z.number().int().min(0),
      })
    )
    .min(1, "Provide at least one image to reorder"),
});

export const ProductImageValidation = {
  createProductImageValidationSchema,
  updateProductImageValidationSchema,
  reorderProductImagesValidationSchema,
};