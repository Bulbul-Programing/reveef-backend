import { Server } from "http";
import app from "./app.js";
import { envVars } from "./app/envConfig/index.js";
import { setupGracefulShutdown } from "./app/middleware/shutdown.js";
import mongoose from "mongoose";

let server: Server
async function mainFunction() {
    try {
         await mongoose.connect(envVars.DATABASE_URL as string);
        server = app.listen(envVars.PORT, () => {
            console.log(`🚀 Server is running on http://localhost:${envVars.PORT}`);
        })

        setupGracefulShutdown(server)

        // Function to gracefully shut down the server
        const exitHandler = () => {
            if (server) {
                server.close(() => {
                    console.log('Server closed gracefully.');
                    process.exit(1); // Exit with a failure code
                });
            } else {
                process.exit(1);
            }
        };

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (error) => {
            console.log('Unhandled Rejection is detected, we are closing our server...');
            if (server) {
                server.close(() => {
                    console.log(error);
                    process.exit(1);
                });
            } else {
                process.exit(1);
            }
        });

    } catch (error) {
        console.error('Error during server startup:', error);
        process.exit(1);
    }
}

mainFunction()