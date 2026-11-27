const path = require('path');
const swaggerJSDoc = require('swagger-jsdoc');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Asana Task & Resource Management REST API',
    version: '1.0.0',
    description:
      'Интерактивная спецификация REST API для управления проектами, задачами и командой (Практическое занятие №2)',
    contact: {
      name: 'Студент-разработчик',
      email: 'ivanyermolitsk@gmail.com',
    },
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Локальный сервер разработки',
    },
  ],
  tags: [
    { name: 'Projects', description: 'Управление проектами и досками спринтов' },
    { name: 'Tasks', description: 'CRUD-операции над задачами команды' },
    { name: 'Users', description: 'Управление участниками команды' },
  ],
  components: {
    schemas: {
      Project: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          name: { type: 'string', example: 'Разработка корпоративного портала' },
          description: { type: 'string', example: 'Создание внутренней системы управления ресурсами' },
          color: { type: 'string', example: '#4f46e5' },
          deadline: { type: 'string', format: 'date-time', example: '2026-12-31T23:59:59.000Z' },
          createdAt: { type: 'string', format: 'date-time', example: '2026-01-10T08:00:00.000Z' },
        },
      },
      ProjectInput: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', example: 'Мобильное приложение' },
          description: { type: 'string', example: 'Клиент на React Native' },
          color: { type: 'string', example: '#10b981' },
          deadline: { type: 'string', format: 'date-time', example: '2026-11-15T18:00:00.000Z' },
        },
      },
      Task: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          title: { type: 'string', maxLength: 200, example: 'Настроить CI/CD' },
          description: { type: 'string', maxLength: 1000, example: 'Автоматизировать деплой на тестовый контур' },
          status: { type: 'string', enum: ['backlog', 'in_progress', 'review', 'done'], example: 'in_progress' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], example: 'urgent' },
          estimatedHours: { type: 'number', minimum: 0, maximum: 666, example: 8 },
          projectId: { type: 'integer', example: 1 },
          assigneeId: { type: 'integer', example: 2 },
          createdAt: { type: 'string', format: 'date-time', example: '2026-10-29T14:35:00.000Z' },
          updatedAt: { type: 'string', format: 'date-time', example: '2026-10-29T15:00:00.000Z' },
        },
      },
      TaskInput: {
        type: 'object',
        required: ['title', 'projectId'],
        properties: {
          title: { type: 'string', maxLength: 200, example: 'Настроить CI/CD' },
          description: { type: 'string', maxLength: 1000, example: 'Автоматизировать деплой на тестовый контур' },
          status: { type: 'string', enum: ['backlog', 'in_progress', 'review', 'done'], default: 'backlog' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
          estimatedHours: { type: 'number', minimum: 0, maximum: 666, example: 8 },
          projectId: { type: 'integer', example: 1 },
          assigneeId: { type: 'integer', example: 2 },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          name: { type: 'string', example: 'Сергей Васильев' },
          email: { type: 'string', format: 'email', example: 'sergey.vasiliev@asana.team' },
          role: { type: 'string', example: 'developer' },
        },
      },
      UserInput: {
        type: 'object',
        required: ['name', 'email', 'role'],
        properties: {
          name: { type: 'string', example: 'Сергей Васильев' },
          email: { type: 'string', format: 'email', example: 'sergey.vasiliev@asana.team' },
          role: { type: 'string', example: 'developer' },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: { type: 'string', example: 'Описание ошибки' },
        },
      },
    },
  },
};

const options = {
  swaggerDefinition,
  apis: [
    path.join(__dirname, 'routes/*.js').replace(/\\/g, '/'),
    path.join(__dirname, '../server.js').replace(/\\/g, '/'),
  ],
};

const swaggerSpec = swaggerJSDoc(options);

// Временная проверка: в консоли при запуске должны появиться ваши маршруты
console.log('Swagger загрузил маршруты:', Object.keys(swaggerSpec.paths));

module.exports = swaggerSpec;