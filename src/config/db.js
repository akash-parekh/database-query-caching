import { Pool } from "pg";

export const createPostgresPool = (config) => {
    return new Pool(config);
};

/*
    ! DB SCHEMA FOR PRODUCTS TABLE
    * CREATE TABLE products (
    *   id SERIAL PRIMARY KEY,           -- Unique product ID
    *   name VARCHAR(150) NOT NULL,      -- Product name
    *   description TEXT,                -- Product details
    *   quantity INT DEFAULT 0,          -- Stock available
    *   price DECIMAL(10, 2) NOT NULL,   -- Price with two decimal places
    *   category VARCHAR(100),           -- Optional grouping field
    *   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- For cache invalidation
    *   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    *   );
*/

export const ensureProductsTableAndData = async (pgPool) => {
    const client = await pgPool.connect();
    try {
        // ! Checking if the table exists, if not create it
        await client.query(`
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                name VARCHAR(150) NOT NULL,
                description TEXT,
                quantity INT DEFAULT 0,
                price DECIMAL(10, 2) NOT NULL,
                category VARCHAR(100),
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`);
        // ! Count existing rows
        const { rows } = await client.query("SELECT COUNT(*) FROM products;");
        console.log("Existing products count:", rows);
        const count = parseInt(rows[0].count, 10);

        if (count < 5) {
            console.log("Less than 5 products found, inserting sample data...");
            await client.query(`
                INSERT INTO products (name, description, quantity, price, category)
                VALUES
                ('Laptop', '15-inch display, 8GB RAM, 512GB SSD', 20, 999.99, 'Electronics'),
                ('Wireless Mouse', 'Bluetooth mouse with ergonomic design', 50, 25.50, 'Accessories'),
                ('Office Chair', 'Adjustable height with lumbar support', 15, 120.00, 'Furniture'),
                ('Desk Lamp', 'LED lamp with adjustable brightness', 30, 45.00, 'Accessories'),
                ('Smartphone', '6.5-inch screen, 128GB storage', 40, 699.99, 'Electronics');
            `);
            console.log("Sample products inserted.");
        } else {
            console.log("Sufficient products exist, no sample data inserted.");
        }
    } catch (err) {
        console.error("Error creating products table:", err);
    }
};
