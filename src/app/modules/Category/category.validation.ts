import { z } from "zod";
import { Types } from "mongoose";

const objectId = z.string().refine((val) => Types.ObjectId.isValid(val), {
  message: "Invalid id",
});

const createCategoryValidationSchema = z.object({
  body: z.object({
    name: z.string({ message: "Name is required" }).trim().min(1),
    // Optional on purpose — service auto-generates it from `name` when omitted
    slug: z.string().trim().toLowerCase().optional(),
    description: z.string().trim().optional(),
    parent: objectId.nullable().optional(),
    imageUrl: z.string().url("Invalid image URL").optional(),
    isActive: z.boolean().optional(),
  }),
});

const updateCategoryValidationSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(1).optional(),
      slug: z.string().trim().toLowerCase().optional(),
      description: z.string().trim().optional(),
      parent: objectId.nullable().optional(),
      imageUrl: z.string().url("Invalid image URL").optional(),
      isActive: z.boolean().optional(),
    })
    .strict(),
});

export const CategoryValidation = {
  createCategoryValidationSchema,
  updateCategoryValidationSchema,
};