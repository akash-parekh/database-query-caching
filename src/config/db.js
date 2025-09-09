import { Pool } from "pg";

export const createPostgresPool = (config) => {
    return new Pool(config);
};
