import { z } from "zod";

const userRoleEnum = z.enum(["customer", "admin", "stuff"]);

const createUserValidationSchema = z.object({
  body: z.object({
    name: z.string({ message: "Name is required" }).trim().min(1),
    email: z
      .string({ message: "Email is required" })
      .email("Invalid email address")
      .trim()
      .toLowerCase()
      .optional()
      ,
    password: z
      .string({ message: "Password is required" })
      .min(6, "Password must be at least 6 characters long"),
    phoneNumber: z
      .string({ message: "Phone number is required" })
      .trim()
      .min(6, "Invalid phone number"),
    profilePicture: z.string().url("Invalid image URL").optional(),
    // role is intentionally accepted here only for type completeness;
    // the service layer always overrides it to "customer" on self-registration.
    role: userRoleEnum.optional(),
  }),
});

const updateUserValidationSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(1).optional(),
      profilePicture: z.string().url("Invalid image URL").optional(),
      phoneNumber: z.string().trim().min(6, "Invalid phone number").optional(),
    })
    .strict(), // block role/isActive/password from sneaking in through this route
});

const updateUserRoleValidationSchema = z.object({
  body: z.object({
    role: userRoleEnum,
  }),
});

const updateUserStatusValidationSchema = z.object({
  body: z.object({
    isActive: z.boolean({ message: "isActive is required" }),
  }),
});

const changePasswordValidationSchema = z.object({
  body: z.object({
    oldPassword: z.string({ message: "Old password is required" }),
    newPassword: z
      .string({ message: "New password is required" })
      .min(6, "Password must be at least 6 characters long"),
  }),
});

export const UserValidation = {
  createUserValidationSchema,
  updateUserValidationSchema,
  updateUserRoleValidationSchema,
  updateUserStatusValidationSchema,
  changePasswordValidationSchema,
};