import { Router } from "express";
import { asyncWrapper } from "../middleware/asyncWrapper.js";

/**
 * @swagger
 * tags:
 *   name: Health
 *   description: API health and service connectivity checks
 */

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Check overall health of all services
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: All services are up and running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: OK
 *                 service:
 *                   type: string
 *                   example: All
 *       500:
 *         description: One or more services are down
 */

/**
 * @swagger
 * /health/db:
 *   get:
 *     summary: Check PostgreSQL database connectivity
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Database connection successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: OK
 *                 service:
 *                   type: string
 *                   example: PostgresSQL
 *       500:
 *         description: Database connection failed
 */

/**
 * @swagger
 * /health/redis:
 *   get:
 *     summary: Check Redis cache connectivity
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Redis connection successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: OK
 *                 service:
 *                   type: string
 *                   example: REDIS
 *       500:
 *         description: Redis connection failed
 */

export const healthRouter = ({ redisClient, pgPool }) => {
    const router = Router();

    // Overall health check
    router.get(
        "/",
        asyncWrapper(async (req, res) => {
            await pgPool.query("SELECT 1");
            await redisClient.ping();
            res.json({ status: "OK", service: "All" });
        }),
    );

    // PostgreSQL health check
    router.get(
        "/db",
        asyncWrapper(async (req, res) => {
            await pgPool.query("SELECT 1");
            res.json({ status: "OK", service: "PostgresSQL" });
        }),
    );

    // Redis health check
    router.get(
        "/redis",
        asyncWrapper(async (req, res) => {
            await redisClient.ping();
            res.json({ status: "OK", service: "REDIS" });
        }),
    );

    return router;
};
