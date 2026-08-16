import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";

export const createToken = (jwtPayload: JwtPayload, jwtSecret: string, expire: string) => {
    const token = jwt.sign(jwtPayload, jwtSecret, { expiresIn: expire } as SignOptions);
    return token
}

export const verifyToken = (token: string, secret: string) => {
    const verifyToken = jwt.verify(token, secret)
    return verifyToken
}