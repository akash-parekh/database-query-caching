import { Router } from "express";
import { asyncWrapper } from "../middleware/asyncWrapper.js";
import { validateBody } from "../middleware/validateBody.js";
import { productSchema } from "../schemas/productSchema.js";

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
            await redisClient.del("products:all");

            res.status(201).json({
                message: "Product created",
                product: createdProduct,
            });
        }),
    );

    return router;
};
