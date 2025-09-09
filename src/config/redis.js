import { createClient } from "redis";

export const createRedisClient = ({ host, port }) => {
    const client = createClient({
        socket: {
            host,
            port,
        },
    });
    client.on("error", (err) => console.error("Redis Client Error", err));
    return client;
};

export const connectWithRetry = async (client, retries = 3, delay = 1000) => {
    for (let i = 1; i <= retries; i++) {
        try {
            await client.connect();
            console.log("Connected to Redis");
            return;
        } catch (err) {
            console.error(`Failed to connect to Redis (attempt: ${i}): `, err);
            if (i <= retries) {
                const backoff = delay * i;
                console.log(`Retrying in ${backoff} ms....`);
                await new Promise((resolve) => setTimeout(resolve, backoff));
            } else {
                console.error(
                    `Could not conenct to Redis after multiple attempts.`,
                );
                throw err;
            }
        }
    }
};
