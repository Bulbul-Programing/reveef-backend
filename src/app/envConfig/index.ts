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
    BKASH_BASE_URL: string
    BKASH_APP_KEY: string
    BKASH_APP_SECRET: string
    BKASH_USERNAME: string
    BKASH_PASSWORD: string
    BKASH_CALLBACK_URL: string
    EMAIL_PASSWORD: string
    EMAIL_USER: string
    FRONTEND_URL: string
    RESET_PASSWORD_SECRETE: string
    RESET_PASSWORD_EXPIRE: string
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
        'STRIPE_WEBHOOK_SECRET',
        'BKASH_BASE_URL',
        'BKASH_APP_KEY',
        'BKASH_APP_SECRET',
        'BKASH_USERNAME',
        'BKASH_PASSWORD',
        'BKASH_CALLBACK_URL',
        "EMAIL_PASSWORD",
        "EMAIL_USER",
        "FRONTEND_URL",
        "RESET_PASSWORD_SECRETE",
        "RESET_PASSWORD_EXPIRE"
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
        STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET as string,
        BKASH_BASE_URL: process.env.BKASH_BASE_URL as string,
        BKASH_APP_KEY: process.env.BKASH_APP_KEY as string,
        BKASH_APP_SECRET: process.env.BKASH_APP_SECRET as string,
        BKASH_USERNAME: process.env.BKASH_USERNAME as string,
        BKASH_PASSWORD: process.env.BKASH_PASSWORD as string,
        BKASH_CALLBACK_URL: process.env.BKASH_CALLBACK_URL as string,
        EMAIL_USER: process.env.EMAIL_USER as string,
        EMAIL_PASSWORD: process.env.EMAIL_PASSWORD as string,
        FRONTEND_URL: process.env.FRONTEND_URL as string,
        RESET_PASSWORD_SECRETE: process.env.RESET_PASSWORD_SECRETE as string,
        RESET_PASSWORD_EXPIRE: process.env.RESET_PASSWORD_SECRETE as string
    }
}

export const envVars = localEnvVariables()

