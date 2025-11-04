import { Router } from "express";
import { asyncWrapper } from "../middleware/asyncWrapper.js";
import { validateBody } from "../middleware/validateBody.js";
import {
    productSchema,
    productUpdateSchema,
} from "../schemas/productSchema.js";

/**
 * @swagger
 * tags:
 *   name: Products
 *   description: Product management and caching endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     ProductInput:
 *       type: object
 *       required:
 *         - name
 *         - description
 *         - quantity
 *         - price
 *         - category
 *       properties:
 *         name:
 *           type: string
 *           example: "Laptop"
 *         description:
 *           type: string
 *           example: "15-inch display, 8GB RAM"
 *         quantity:
 *           type: integer
 *           example: 10
 *         price:
 *           type: number
 *           format: float
 *           example: 999.99
 *         category:
 *           type: string
 *           example: "Electronics"
 *
 *     Product:
 *       allOf:
 *         - $ref: '#/components/schemas/ProductInput'
 *         - type: object
 *           properties:
 *             id:
 *               type: integer
 *               example: 1
 *             created_at:
 *               type: string
 *               format: date-time
 *               example: "2025-11-05T08:30:00Z"
 *             updated_at:
 *               type: string
 *               format: date-time
 *               example: "2025-11-05T08:30:00Z"
 *
 *   responses:
 *     NotFound:
 *       description: Product not found
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               error:
 *                 type: string
 *                 example: "Product not found"
 *     ValidationError:
 *       description: Invalid input provided
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               error:
 *                 type: string
 *                 example: "Invalid product data"
 *     ServerError:
 *       description: Internal server error
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               error:
 *                 type: string
 *                 example: "Database error"
 */

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

    /**
     * @swagger
     * /products:
     *   get:
     *     summary: Get all products
     *     tags: [Products]
     *     responses:
     *       200:
     *         description: List of all products
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 $ref: '#/components/schemas/Product'
     *       500:
     *         $ref: '#/components/responses/ServerError'
     */
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

    /**
     * @swagger
     * /products/{id}:
     *   get:
     *     summary: Get a specific product by ID
     *     tags: [Products]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: integer
     *         description: The product ID
     *     responses:
     *       200:
     *         description: Product found
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Product'
     *       400:
     *         $ref: '#/components/responses/ValidationError'
     *       404:
     *         $ref: '#/components/responses/NotFound'
     *       500:
     *         $ref: '#/components/responses/ServerError'
     */
    router.get(
        "/:id",
        asyncWrapper(async (req, res) => {
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

                const result = await pgPool.query(
                    "SELECT * FROM products WHERE id = $1",
                    [id],
                );
                if (result.rows.length === 0) {
                    return res.status(404).json({ error: "Product not found" });
                }

                const product = result.rows[0];
                await cacheSet(cacheKey, product);
                res.json(product);
            } catch (err) {
                console.error("Error fetching product:", err);
                res.status(500).json({ error: "Internal Server Error" });
            }
        }),
    );

    /**
     * @swagger
     * /products:
     *   post:
     *     summary: Create a new product
     *     tags: [Products]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/ProductInput'
     *     responses:
     *       201:
     *         description: Product created successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message:
     *                   type: string
     *                 product:
     *                   $ref: '#/components/schemas/Product'
     *       400:
     *         $ref: '#/components/responses/ValidationError'
     *       500:
     *         $ref: '#/components/responses/ServerError'
     */
    router.post(
        "/",
        validateBody(productSchema),
        asyncWrapper(async (req, res) => {
            const productData = req.validatedBody;
            const queryText = `
      INSERT INTO products (name, description, quantity, price, category)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
            const queryValues = [
                productData.name,
                productData.description,
                productData.quantity,
                productData.price,
                productData.category,
            ];
            const result = await pgPool.query(queryText, queryValues);
            const createdProduct = result.rows[0];

            await cacheSet(`products:${createdProduct.id}`, createdProduct);
            await invalidateProductCache(createdProduct.id);

            res.status(201).json({
                message: "Product created",
                product: createdProduct,
            });
        }),
    );

    /**
     * @swagger
     * /products/{id}:
     *   put:
     *     summary: Update an existing product
     *     tags: [Products]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: integer
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/ProductInput'
     *     responses:
     *       200:
     *         description: Product updated successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message:
     *                   type: string
     *                 product:
     *                   $ref: '#/components/schemas/Product'
     *       400:
     *         $ref: '#/components/responses/ValidationError'
     *       404:
     *         $ref: '#/components/responses/NotFound'
     *       500:
     *         $ref: '#/components/responses/ServerError'
     */
    router.put(
        "/:id",
        validateBody(productUpdateSchema),
        asyncWrapper(async (req, res) => {
            const { id } = req.params;
            const updates = req.validatedBody;

            if (!id)
                return res.status(400).json({ error: "Invalid product id" });
            const keys = Object.keys(updates);
            if (keys.length === 0)
                return res
                    .status(400)
                    .json({ error: "No fields provided to update" });

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
                    return res.status(404).json({ error: "Product not found" });
                }

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

    /**
     * @swagger
     * /products/{id}:
     *   delete:
     *     summary: Delete a product
     *     tags: [Products]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: integer
     *     responses:
     *       200:
     *         description: Product deleted successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message:
     *                   type: string
     *                 deleted:
     *                   $ref: '#/components/schemas/Product'
     *       404:
     *         $ref: '#/components/responses/NotFound'
     *       500:
     *         $ref: '#/components/responses/ServerError'
     */
    router.delete(
        "/:id",
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
                console.error("Error deleting product:", err);
                res.status(500).json({ error: "Database error" });
            }
        }),
    );

    return router;
};
