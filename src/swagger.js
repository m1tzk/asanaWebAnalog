const swaggerJSDoc = require('swagger-jsdoc');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Asana Task & Resource Management REST API',
    version: '1.0.0',
    description: 'Интерактивная спецификация REST API для управления проектами, задачами и командой (Практическое занятие №2)',
    contact: {
      name: 'Студент-разработчик',
      email: 'student@asana.team'
    }
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Локальный сервер разработки'
    }
  ],
  tags: [
    { name: 'Projects', description: 'Управление проектами и досками спринтов' },
    { name: 'Tasks', description: 'CRUD-операции над задачами команды' },
    { name: 'Users', description: 'Управление участниками команды' }
  ]
};

const options = {
  swaggerDefinition,
  apis: ['./src/routes/*.js', './server.js']
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;