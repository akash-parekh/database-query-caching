import { z } from "zod";

export const productSchema = z.object({
    name: z
        .string({
            required_error: "name is required",
            invalid_type_error: "name must be a string",
        })
        .nonempty("name is required"),
    description: z
        .string({
            required_error: "description is required",
            invalid_type_error: "description must be a string",
        })
        .nonempty("description is required"),
    quantity: z.coerce.number().int().gt(0, "quantity must be > 0"),
    price: z.coerce.number().gt(0, "price must be > 0"),
    category: z
        .string({
            required_error: "category is required",
            invalid_type_error: "category must be a string",
        })
        .nonempty("category is required"),
});

export const productUpdateSchema = productSchema.partial();
