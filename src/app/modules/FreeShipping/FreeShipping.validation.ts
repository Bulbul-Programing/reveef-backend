import { z } from "zod";

const freeShippingSchema = z.object({
    body: z.object({
        minimumPurchase: z
            .number()
            .finite()
            .min(0, "Minimum purchase cannot be negative"),

        isActive: z.boolean().optional(),
    })
});

const updateFreeShippingSchema = z.object({
    body: z.object({
        minimumPurchase: z
            .number()
            .finite()
            .min(0, "Minimum purchase cannot be negative")
            .optional(),

        isActive: z.boolean().optional(),
    }).refine(
        (data) =>
            data.minimumPurchase !== undefined ||
            data.isActive !== undefined,
        {
            message: "Provide at least one field to update",
        }
    )
})


export const freeShippingValidation = {
    freeShippingSchema,
    updateFreeShippingSchema,
};