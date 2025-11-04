import express from "express";
import { errorHandler } from "./middleware/errorHandler.js";
import { healthRouter } from "./routes/health.js";
import { productListRouter } from "./routes/productList.js";

export const createApp = ({ redisClient, pgPool }) => {
    const app = express();
    app.use(express.json());
    app.use("/health", healthRouter({ redisClient, pgPool }));
    app.use("/products", productListRouter({ pgPool, redisClient }));
    app.use(errorHandler);
    return app;
};
