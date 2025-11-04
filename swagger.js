import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Product API with Redis Caching",
            version: "1.0.0",
            description: "API documentation for Product API with Redis caching",
        },
        servers: [
            {
                url: "http://localhost:5000",
                description: "Development server",
            },
        ],
    },
    apis: ["./src/routes/*.js"],
};

export const swaggerSpec = swaggerJSDoc(options);

export const swaggerDocs = (app) => {
    app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    console.log("Swagger docs available at http://localhost:5000/docs");
};
