import { Router } from "express";
import { asyncWrapper } from "../middleware/asyncWrapper.js";

export const healthRouter = ({ redisClient, pgPool }) => {
    const router = Router();

    router.get(
        "/",
        asyncWrapper(async (req, res) => {
            await pgPool.query("SELECT 1");
            await redisClient.ping();
            res.json({ status: "OK", service: "All" });
        }),
    );

    router.get(
        "/db",
        asyncWrapper(async (req, res) => {
            await pgPool.query("SELECT 1");
            res.json({ status: "OK", service: "PostgresSQL" });
        }),
    );

    router.get(
        "/redis",
        asyncWrapper(async (req, res) => {
            await redisClient.ping();
            res.json({ status: "OK", service: "REDIS" });
        }),
    );

    return router;
};
