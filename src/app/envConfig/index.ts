import dotenv from "dotenv";

dotenv.config()

interface EnvConfig {
    NODE_ENV: string,
    PORT: string,
    BCRYPT_ROUNDS: string,
    GOOGLE_CLIENT_SECRET: string,
    GOOGLE_CLIENT_ID: string,
    GOOGLE_CALLBACK_URL: string,
    ACCESS_TOKEN_SECRETE: string,
    REFRESH_TOKEN_SECRET: string,
    ACCESS_TOKEN_EXPIRE: string
    REFRESH_TOKEN_EXPIRE: string
    DATABASE_URL: string,
    EXPRESS_SESSION_SECRET: string
    // FRONTEND_URL: string
    STRIPE_SECRET_KEY: string
    STRIPE_WEBHOOK_SECRET: string
}

const localEnvVariables = (): EnvConfig => {
    const requiredEnvVariables: string[] = [
        'NODE_ENV',
        'PORT',
        'BCRYPT_ROUNDS',
        'GOOGLE_CLIENT_SECRET',
        'GOOGLE_CLIENT_ID',
        'GOOGLE_CALLBACK_URL',
        'ACCESS_TOKEN_SECRETE',
        'REFRESH_TOKEN_SECRET',
        'ACCESS_TOKEN_EXPIRE',
        'REFRESH_TOKEN_EXPIRE',
        'DATABASE_URL',
        'EXPRESS_SESSION_SECRET',
        // 'FRONTEND_URL',
        'STRIPE_SECRET_KEY',
        'STRIPE_WEBHOOK_SECRET'
    ]

    requiredEnvVariables.forEach(envVar => {
        if (!process.env[envVar]) {
            throw new Error(`Missing require environment variable ${envVar}`)
        }
    })

    return {
        NODE_ENV: process.env.NODE_ENV as string,
        PORT: process.env.PORT as string,
        BCRYPT_ROUNDS: process.env.BCRYPT_ROUNDS as string,
        GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET as string,
        GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID as string,
        GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL as string,
        ACCESS_TOKEN_SECRETE: process.env.ACCESS_TOKEN_SECRETE as string,
        REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET as string,
        ACCESS_TOKEN_EXPIRE: process.env.ACCESS_TOKEN_EXPIRE as string,
        REFRESH_TOKEN_EXPIRE: process.env.REFRESH_TOKEN_EXPIRE as string,
        DATABASE_URL: process.env.DATABASE_URL as string,
        EXPRESS_SESSION_SECRET: process.env.EXPRESS_SESSION_SECRET as string,
        // FRONTEND_URL: process.env.FRONTEND_URL as string,
        STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY as string,
        STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET as string
    }
}

export const envVars = localEnvVariables()

