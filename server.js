/**
 * ============================================================================
 * ЛАБОРАТОРНАЯ РАБОТА №6: REST API НА БАЗЕ MONGODB ATLAS & MONGOOSE
 * Ветка репозитория: 26
 * ============================================================================
 */

require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); // Принудительно используем Google DNS для SRV/TXT записей
const express = require('express');
const mongoose = require('mongoose');

const taskRoutes = require('./routes/tasks');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================================
// 1. СИСТЕМНЫЕ MIDDLEWARE
// ============================================================================

app.use(express.json());

// Логирующее middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
  next();
});

// ============================================================================
// 2. ПОДКЛЮЧЕНИЕ МАРШРУТОВ
// ============================================================================

app.use('/api/tasks', taskRoutes);

// Корневой проверочный маршрут
app.get('/', (req, res) => {
  res.json({
    message: 'Asana Task Manager API (MongoDB Atlas Edition) активен.',
    endpoints: '/api/tasks'
  });
});

// ============================================================================
// 3. ОБРАБОТКА ОШИБОК
// ============================================================================

// 404 Fallback
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Маршрут ${req.method} ${req.originalUrl} не найден на сервере`
  });
});

// Глобальный перехватчик ошибок (с поддержкой валидации Mongoose и неверных ObjectId)
app.use((err, req, res, next) => {
  console.error('Ошибка сервера:', err.message);

  // Ошибка валидации Mongoose (ValidationError)
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    return res.status(400).json({
      success: false,
      error: messages.join(', ')
    });
  }

  // Ошибка неверного формата ObjectId (CastError)
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    return res.status(400).json({
      success: false,
      error: `Некорректный идентификатор ObjectId: "${err.value}"`
    });
  }

  res.status(500).json({
    success: false,
    error: 'Внутренняя ошибка сервера (Database/Internal Error)'
  });
});

// ============================================================================
// 4. ПОДКЛЮЧЕНИЕ К MONGODB ATLAS И ЗАПУСК СЕРВЕРА
// ============================================================================

const startServer = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
      throw new Error('Переменная MONGO_URI не задана в файле .env');
    }

    console.log('⏳ Подключение к облачному кластеру MongoDB Atlas...');
    await mongoose.connect(mongoUri);

    console.log('✅ Успешное подключение к MongoDB Atlas!');
    app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`🚀 Сервер запущен на порту: ${PORT}`);
      console.log(`🔗 Базовый URL API: http://localhost:${PORT}/api/tasks`);
      console.log(`=======================================================`);
    });
  } catch (err) {
    console.error('❌ Ошибка подключения к базе данных MongoDB:', err.message);
    process.exit(1);
  }
};

startServer();