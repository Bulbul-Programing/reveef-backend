import { z } from "zod";
import { Types } from "mongoose";

const objectId = z.string().refine((val) => Types.ObjectId.isValid(val), {
  message: "Invalid id",
});

const createReviewValidationSchema = z.object({
  body: z.object({
    // `user` is never accepted here — always taken from req.user.id.
    product: objectId,
    rating: z
      .number({ message: "Rating is required" })
      .int()
      .min(1)
      .max(5),
    comment: z.string().trim().max(1000).optional(),
  }),
});

const updateReviewValidationSchema = z.object({
  body: z
    .object({
      rating: z.number().int().min(1).max(5).optional(),
      comment: z.string().trim().max(1000).optional(),
      // `isApproved` intentionally excluded — moderation happens through
      // the dedicated /:id/moderate endpoint, not a self-service update.
    })
    .strict(),
});

const moderateReviewValidationSchema = z.object({
  body: z.object({
    isApproved: z.boolean({ message: "isApproved is required" }),
  }),
});

export const ReviewValidation = {
  createReviewValidationSchema,
  updateReviewValidationSchema,
  moderateReviewValidationSchema,
};