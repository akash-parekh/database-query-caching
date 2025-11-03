import dotenv from "dotenv";
import { connectWithRetry, createRedisClient } from "./src/config/redis.js";
import {
    createPostgresPool,
    ensureProductsTableAndData,
} from "./src/config/db.js";
import { createApp } from "./src/app.js";
dotenv.config();

// REDIS CONFIG
const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = process.env.REDIS_PORT || 6379;
// const REDIS_DB = process.env.REDIS_DB || 0;

const redisClient = createRedisClient({
    host: REDIS_HOST,
    port: REDIS_PORT,
    // db: REDIS_DB,
});

// POSTGRES CONFIG
const PGHOST = process.env.POSTGRES_HOST || "localhost";
const PGUSER = process.env.POSTGRES_USER || "postgres";
const PGPASSWORD = process.env.POSTGRES_PASSWORD || "postgres";
const PGDB = process.env.POSTGRES_DB || "product_db";
const PGPORT = process.env.POSTGRES_PORT || 5432;

const pgPool = createPostgresPool({
    host: PGHOST,
    user: PGUSER,
    password: PGPASSWORD,
    database: PGDB,
    port: PGPORT,
});

await ensureProductsTableAndData(pgPool);

// APP CONFIG
const PORT = process.env.PORT || 5000;

async function start() {
    await connectWithRetry(redisClient);
    const app = createApp({ redisClient, pgPool });
    app.listen(PORT, () => {
        console.log(`Server Running at http://localhost:${PORT}`);
    });
}

start();
