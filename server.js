/**
 * ============================================================================
 * ПРАКТИЧЕСКОЕ ЗАНЯТИЕ №2: ПРОЕКТИРОВАНИЕ И РЕАЛИЗАЦИЯ REST API
 * Ветка репозитория: pz22
 * ============================================================================
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./src/swagger');

// Подключение роутеров ресурсов API v1
const projectRoutes = require('./src/routes/projects');
const taskRoutes = require('./src/routes/tasks');
const userRoutes = require('./src/routes/users');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================================
// 1. СИСТЕМНЫЕ MIDDLEWARE И ФАЙЛОВЫЙ ЛОГГЕР С АВТОВОССТАНОВЛЕНИЕМ
// ============================================================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const logsDir = path.join(__dirname, 'logs');
const logFilePath = path.join(logsDir, 'server.log');

const writeToLogFile = (logEntry) => {
  try {
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    fs.appendFile(logFilePath, logEntry + '\n', (err) => {
      if (err) console.error('Ошибка логирования:', err.message);
    });
  } catch (e) {
    console.error('Сбой проверки логов:', e.message);
  }
};

app.use((req, res, next) => {
  const start = Date.now();
  const timestamp = new Date().toISOString();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const line = `[${timestamp}] ${req.method} ${req.originalUrl} | Status: ${res.statusCode} | Time: ${duration}ms`;
    console.log(line);
    writeToLogFile(line);
  });

  next();
});

// ============================================================================
// 2. ИНТЕРАКТИВНАЯ ДОКУМЕНТАЦИЯ SWAGGER UI
// ============================================================================

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'Asana REST API Documentation (Swagger)'
}));

// ============================================================================
// 3. ПОДКЛЮЧЕНИЕ МАРШРУТОВ REST API (v1)
// ============================================================================

app.use('/api/v1/projects', projectRoutes);
app.use('/api/v1/tasks', taskRoutes);
app.use('/api/v1/users', userRoutes);

// Корневой редирект на документацию
app.get('/', (req, res) => {
  res.redirect('/api/docs');
});

// ============================================================================
// 4. ЦЕНТРАЛИЗОВАННАЯ ОБРАБОТКА ОШИБОК
// ============================================================================

// 404 Fallback
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Эндпоинт ${req.method} ${req.originalUrl} не существует в спецификации API.`
  });
});

// 500 Error Handler
app.use((err, req, res, next) => {
  console.error('Ошибка сервера:', err.stack);
  res.status(500).json({
    success: false,
    error: 'Внутренняя ошибка сервера (Internal Server Error).'
  });
});

// ============================================================================
// 5. ЗАПУСК СЕРВЕРА
// ============================================================================

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 REST API Asana Task Manager запущен на порту: ${PORT}`);
  console.log(`📖 Swagger UI документация: http://localhost:${PORT}/api/docs`);
  console.log(`🔗 Базовый префикс API:     http://localhost:${PORT}/api/v1`);
  console.log(`=======================================================`);
});