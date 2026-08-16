import type { Application, Request, Response } from 'express';
import express from 'express';
import cors from 'cors';
import 'dotenv/config'
import cookieParser from 'cookie-parser';
import { envVars } from './app/envConfig/index.js';
import router from './app/router/index.js';
import globalErrorHandler from './app/middleware/globalErrorHandler.js';

const app: Application = express()

app.use(cors({ origin: ["http://localhost:3000"] }))

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

app.use('/api/v1', router)

app.get('/', (req: Request, res: Response) => {
    res.send({
        message: "Server is running..",
        environment: envVars.PORT,
        uptime: process.uptime().toFixed(2) + " sec",
        timeStamp: new Date().toISOString()
    })
});


app.use(globalErrorHandler);

export default app;