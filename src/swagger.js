const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
require("dotenv").config();

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Zeaper API',
      version: process.env.FRONTEND_VERSION,
      description: 'Api documentation for Zeaper',
    },
  },

  apis: ['./src/routes/**.js'], // Path to your API routes
  
};

const specs = swaggerJsdoc(options);

module.exports = {
  specs,
  swaggerUi,
};