import { z } from "zod";

const createCollectionValidationSchema = z.object({
  body: z.object({
    name: z.string({ message: "Name is required" }).trim().min(1),
    // Optional on purpose — service auto-generates it from `name` when omitted
    slug: z.string().trim().toLowerCase().optional(),
    description: z.string().trim().optional(),
    image: z.string().url("Invalid image URL").optional(),
    isActive: z.boolean().optional(),
  }),
});

const updateCollectionValidationSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(1).optional(),
      slug: z.string().trim().toLowerCase().optional(),
      description: z.string().trim().optional(),
      image: z.string().url("Invalid image URL").optional(),
      isActive: z.boolean().optional(),
    })
    .strict(),
});

export const CollectionValidation = {
  createCollectionValidationSchema,
  updateCollectionValidationSchema,
};