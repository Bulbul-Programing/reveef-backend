import { Server } from "http";


export const setupGracefulShutdown = (server: Server) => {
    const shutdown = async (signal: string, err?: unknown) => {
        console.log(`${signal} received. Shutting down gracefully...`);

        try {
            // Stop accepting new connections
            await new Promise<void>((resolve, reject) => {
                server.close((error) => {
                    if (error) return reject(error);
                    resolve();
                });
            });

            console.log("HTTP server closed.");

            // await prisma.$disconnect();
            console.log("Prisma disconnected.");
        } catch (error) {
            console.error("Error during shutdown:", error);
        } finally {
            process.exit(err ? 1 : 0);
        }
    }

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

    process.on("unhandledRejection", (reason) => {
        console.error("Unhandled Rejection:", reason);
        shutdown("unhandledRejection", reason);
    });

    process.on("uncaughtException", (error) => {
        console.error("Uncaught Exception:", error);
        shutdown("uncaughtException", error);
    });
}