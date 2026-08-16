import { z } from "zod";

const loginValidationSchema = z.object({
    body: z.object({
        identifier: z.string({ message: 'Email or Number is required!' }),
        password: z.string({ message: 'Password is required!' })
    })
})

export const loginValidation = {
    loginValidationSchema
}