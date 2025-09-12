const swaggerJSDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Smart Booking API",
      version: "1.0.0",
      description: "API documentation for the Smart Booking system",
    },
    servers: [
      {
        url: "http://localhost:3000", // change if hosted elsewhere
      },
    ],
  },
  apis: ["./routes/*.js"], // Path to your route files with Swagger comments
};

const swaggerSpec = swaggerJSDoc(options);

const setupSwagger = (app) => {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
};

module.exports = setupSwagger;
