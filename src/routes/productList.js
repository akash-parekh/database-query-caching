import { Router } from "express";
import { asyncWrapper } from "../middleware/asyncWrapper.js";
import { validateBody } from "../middleware/validateBody.js";
import {
    productSchema,
    productUpdateSchema,
} from "../schemas/productSchema.js";
import { ka } from "zod/locales";

export const productListRouter = ({ pgPool, redisClient }) => {
    const router = Router();

    const cacheSet = async (key, value, expirationInSeconds = 3600) => {
        await redisClient.setEx(
            key,
            expirationInSeconds,
            JSON.stringify(value),
        );
    };

    const cacheGet = async (key) => {
        const data = await redisClient.get(key);
        return data ? JSON.parse(data) : null;
    };

    const invalidateProductCache = async (id) => {
        await Promise.all([
            redisClient.del(`products:${id}`),
            redisClient.del("products:all"),
        ]);
    };

    router.get(
        "/",
        asyncWrapper(async (req, res) => {
            const cacheKey = "products:all";
            try {
                const cached = await cacheGet(cacheKey);
                if (cached) {
                    console.log("Cache Hit: All Products");
                    return res.json(cached);
                }
                console.log("Cache Miss: All Products");
                const result = await pgPool.query(
                    "SELECT * FROM products ORDER BY id ASC",
                );
                const products = result.rows;
                await cacheSet(cacheKey, products);
                res.json(products);
            } catch (err) {
                console.error("Error fetching products: ", err);
                res.status(500).json({ error: "Internal Server Error" });
            }
        }),
    );

    router.get(
        "/:id",
        asyncWrapper(async (req, res) => {
            // validate id as integer to avoid SQL errors / injection
            const id = parseInt(req.params.id, 10);
            if (Number.isNaN(id)) {
                return res.status(400).json({ error: "Invalid product id" });
            }

            const cacheKey = `products:${id}`;
            try {
                const cached = await cacheGet(cacheKey);
                if (cached) {
                    console.log(`Cache Hit: ${id}`);
                    return res.json(cached);
                }
                console.log(`Cache Miss: ${id}`);

                // Use parameterized query to prevent SQL injection and type issues
                const result = await pgPool.query(
                    "SELECT * FROM products WHERE id = $1 ORDER BY id ASC",
                    [id],
                );
                const products = result.rows;
                if (products.length === 0) {
                    return res.status(404).json({ error: "Product Not Found" });
                }

                const product = products[0];
                await cacheSet(cacheKey, product);
                res.json(product);
            } catch (err) {
                console.error("Error fetching product: ", err);
                res.status(500).json({ error: "Internal Server Error" });
            }
        }),
    );

    router.post(
        "/addProduct",
        validateBody(productSchema),
        asyncWrapper(async (req, res) => {
            const productData = req.validatedBody;
            const queryText = `INSERT INTO products (name, description, quantity, price, category) VALUES ($1, $2, $3, $4, $5) RETURNING *`;
            const queryValues = [
                productData.name,
                productData.description,
                productData.quantity,
                productData.price,
                productData.category,
            ];
            const result = await pgPool.query(queryText, queryValues);
            const createdProduct = result.rows[0];

            // Cache the newly created product and invalidate the cached product list
            await cacheSet(`products:${createdProduct.id}`, createdProduct);
            await invalidateProductCache(createdProduct.id);

            res.status(201).json({
                message: "Product created",
                product: createdProduct,
            });
        }),
    );

    router.put(
        "/updateProduct/:id",
        validateBody(productUpdateSchema),
        asyncWrapper(async (req, res) => {
            const { id } = req.params;
            const updates = req.validatedBody;

            if (!id) {
                return res.status(400).json({ error: "Invalid product id" });
            }

            // Ensure at least one field is provided
            const keys = Object.keys(updates);
            if (keys.length === 0) {
                return res
                    .status(400)
                    .json({ error: "No fields provided to update" });
            }

            // Build dynamic SQL query
            // Example result: "UPDATE products SET name=$1, price=$2 WHERE id=$3"
            const setClauses = keys.map((key, i) => `${key} = $${i + 1}`);
            const values = Object.values(updates);
            const queryText = `
                UPDATE products
                SET ${setClauses.join(", ")}
                WHERE id = $${keys.length + 1}
                RETURNING *;
                `;

            try {
                const { rows } = await pgPool.query(queryText, [...values, id]);

                if (rows.length === 0) {
                    return res.status(200).json({
                        message: "Product not found (already deleted)",
                    });
                }

                // Update cache for this product and invalidate product list cache
                await invalidateProductCache(id);
                await cacheSet(`products:${id}`, rows[0]);

                res.status(200).json({
                    message: "Product updated successfully",
                    product: rows[0],
                });
            } catch (err) {
                console.error("Error updating product:", err);
                res.status(500).json({ error: "Database error" });
            }
        }),
    );

    router.delete(
        "/deleteProduct/:id",
        asyncWrapper(async (req, res) => {
            const id = parseInt(req.params.id, 10);
            if (Number.isNaN(id) || id <= 0) {
                return res.status(400).json({ error: "Invalid product id" });
            }
            const queryText = "DELETE FROM products WHERE id = $1 RETURNING *";
            try {
                const { rows } = await pgPool.query(queryText, [id]);
                if (rows.length === 0) {
                    return res.status(404).json({ error: "Product not found" });
                }
                await invalidateProductCache(id);
                res.status(200).json({
                    message: "Product deleted successfully",
                    deleted: rows[0],
                });
            } catch (err) {
                console.error("❌ Error deleting product:", {
                    id,
                    message: err.message,
                    stack: err.stack,
                });
                return res.status(500).json({ error: "Database error" });
            }
        }),
    );

    return router;
};
