import { z } from "zod";

export const contactValidationSchema = z.object({
    body: z.object({
        name: z
            .string()
            .trim()
            .min(1, "Name is required")
            .max(100, "Name must not exceed 100 characters"),

        email: z
            .string()
            .trim()
            .min(1, "Email is required")
            .email("Please provide a valid email address")
            .max(254, "Email must not exceed 254 characters"),

        phone: z
            .string()
            .trim()
            .max(30, "Phone must not exceed 30 characters")
            .optional()
            .default(""),

        topic: z.enum(
            [
                "General enquiry",
                "Order support",
                "Wholesale",
                "Custom production",
                "Factory visit",
            ],
            {
                message: "Please select a valid enquiry topic",
            }
        ),

        message: z
            .string()
            .trim()
            .min(5, "Message must contain at least 5 characters")
            .max(5000, "Message must not exceed 5000 characters"),

        website: z.string().optional().default(""),
    })
});