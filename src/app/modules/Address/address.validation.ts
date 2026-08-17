import { z } from "zod";

const createAddressValidationSchema = z.object({
  body: z.object({
    // `user` is deliberately not accepted here — it's always taken from
    // req.user.id in the controller, so nobody can create an address
    // "for" a different account by passing someone else's id.
    fullName: z.string({ message: "Full name is required" }).trim().min(1),
    phone: z.string({ message: "Phone number is required" }).trim().min(6),
    address: z
      .string({ message: "Address line is required" })
      .trim()
      .min(1),
    district: z.string({ message: "City is required" }).trim().min(1),
    upazila: z.string().trim().optional(),
    postalCode: z.string().trim().optional(),
    isDefault: z.boolean().optional(),
  }),
});

const updateAddressValidationSchema = z.object({
  body: z
    .object({
      fullName: z.string().trim().min(1).optional(),
      phone: z.string().trim().min(6).optional(),
      address: z.string().trim().min(1).optional(),
      district: z.string().trim().min(1).optional(),
      upazila: z.string().trim().optional(),
      postalCode: z.string().trim().optional(),
      isDefault: z.boolean().optional(),
    })
    .strict(),
});

export const AddressValidation = {
  createAddressValidationSchema,
  updateAddressValidationSchema,
};