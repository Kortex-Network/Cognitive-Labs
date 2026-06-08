const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Stellar Cognitive-Labs Platform API',
      version: '1.0.0',
      description: 'API for managing Decentralized Identifiers (LABSs) and Verifiable Credentials on the Stellar blockchain',
      contact: {
        name: 'API Support',
        url: 'https://github.com/elizabetheonoja-art/Decentralized-Identity-LABS-',
      },
    },
    servers: [
      {
        url: 'http://localhost:3001/api/v1',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },

  },
  apis: ['./src/routes/**/*.js', './src/server.js'], // paths to files containing OpenAPI annotations
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
