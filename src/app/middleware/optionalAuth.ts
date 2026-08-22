import type { NextFunction, Request, Response } from "express";
import { envVars } from "../envConfig/index.ts";
import jwt,{ type JwtPayload } from "jsonwebtoken";

// Attaches req.user if a valid token is present; otherwise just calls next()
// instead of throwing — lets guest checkout and logged-in checkout share
// one route.
const optionalAuth = (req: Request, _res: Response, next: NextFunction) => {
    const token =
        req.headers.authorization?.replace("Bearer ", "") || req.cookies?.accessToken;

    if (!token) {
        return next();
    }

    try {
        const decoded = jwt.verify(token, envVars.ACCESS_TOKEN_SECRETE as string) as JwtPayload;
        req.user = decoded as { id: string; role: string };
    } catch {
        // invalid/expired token on a guest-allowed route — proceed as guest
        // rather than blocking checkout
    }

    next();
};

export default optionalAuth;