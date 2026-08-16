import type { NextFunction, Request, Response } from "express";
import { json, ZodArray, ZodObject } from "zod";


export const validateRequest = (zodSchema: ZodObject) => async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (req.body.data) {
            req.body = JSON.parse(req.body.data)
        }
        const validate = await zodSchema.parseAsync({ body: req.body })
        req.body = validate.body
        next()
    } catch (error) {
        next(error)
    }
}

export const arrayOfObjectValidateRequest = (zodSchema: ZodArray) => async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (req.body.data) {
            req.body = JSON.parse(req.body.data)
        }

        req.body = await zodSchema.parseAsync(req.body)
        next()
    } catch (error) {
        next(error)
    }
}