import type { Application, Request, Response } from 'express';
import express from 'express';
import cors from 'cors';
import 'dotenv/config'
import cookieParser from 'cookie-parser';
import { envVars } from './app/envConfig/index.js';
import router from './app/router/index.js';
import globalErrorHandler from './app/middleware/globalErrorHandler.js';
import { authRateLimiter, generalRateLimiter } from './app/middleware/rateLimiter.ts';

const app: Application = express()

app.use(cors({ origin: ["http://localhost:3000"] }))

app.use(express.json());

app.use(generalRateLimiter);
app.use("/api/v1/auth", authRateLimiter);
app.get("/api/test", (req, res) => {
    res.json({ message: "OK" });
});
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

app.use('/api/v1', router)
app.use(globalErrorHandler);

app.get('/', (req: Request, res: Response) => {
    res.send({
        message: "Server is running..",
        environment: envVars.PORT,
        uptime: process.uptime().toFixed(2) + " sec",
        timeStamp: new Date().toISOString()
    })
});

app.use((req: Request, res: Response) => {
    return res.status(404).json({
        success: false,
        message: 'API not Found',
        error: '',
    });
})

export default app;