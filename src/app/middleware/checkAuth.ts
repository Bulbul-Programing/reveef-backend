import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status-codes";
import type { JwtPayload } from "jsonwebtoken";
import { envVars } from "../envConfig/index.js";
import type { TUserRole } from "../modules/User/user.interface.ts";
import AppError from "../error/AppError.ts";
import { verifyToken } from "../utils/jwtToken.ts";
import { userModel } from "../modules/User/user.model.ts";

export type decodedPayload = {
    userId: string,
    email: string,
    role: TUserRole
}

export const checkAuth = (...authRoles: string[]) => async (req: Request, res: Response, next: NextFunction) => {

    try {
        const accessToken = req.cookies.accessToken || req.headers.authorization;

        if (!accessToken) {
            throw new AppError(403, "Token Not found")
        }

        const verifiedToken = verifyToken(accessToken, envVars.ACCESS_TOKEN_SECRETE) as JwtPayload
       
        const isUserExist = await userModel.findById(verifiedToken.id)
        
        if (!isUserExist) {
            throw new AppError(httpStatus.BAD_REQUEST, "User does not exist")
        }
        
        if (!authRoles.includes(verifiedToken.role)) {
            throw new AppError(403, "You are not authorized for this route!!!")
        }
        req.user = verifiedToken
        next()

    } catch (error) {
        console.log("jwt error", error);
        next(error)
    }
}