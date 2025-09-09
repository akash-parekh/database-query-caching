import express from "express";
import { errorHandler } from "./middleware/errorHandler.js";
import { healthRouter } from "./routes/health.js";

export const createApp = ({ redisClient, pgPool }) => {
    const app = express();
    app.use("/health", healthRouter({ redisClient, pgPool }));
    app.use(errorHandler);
    return app;
};
