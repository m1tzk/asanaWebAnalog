/**
 * ============================================================================
 * ЛАБОРАТОРНАЯ РАБОТА №7: REAL-TIME НА БАЗЕ WEBSOCKET (SOCKET.IO) + MONGODB
 * Ветка репозитория: 27
 * ============================================================================
 */

require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Server } = require('socket.io');

const taskRoutes = require('./routes/tasks');
const initSocket = require('./socket/socketHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================================
// 1. СИСТЕМНЫЕ MIDDLEWARE
// ============================================================================

app.use(cors()); // Разрешаем запросы от React-клиента (http://localhost:5173)
app.use(express.json());

app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
  next();
});

// ============================================================================
// 2. ПОДКЛЮЧЕНИЕ МАРШРУТОВ И СОЗДАНИЕ HTTP + SOCKET.IO СЕРВЕРА
// ============================================================================

app.use('/api/tasks', taskRoutes);

app.get('/', (req, res) => {
  res.json({
    message: 'Asana Task Manager API (MongoDB Atlas + Socket.IO Real-Time) активен.',
    endpoints: '/api/tasks'
  });
});

// Оборачиваем Express в HTTP-сервер и прикрепляем Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
  },
  maxHttpBufferSize: 1e6 // Ограничение размера сообщения: 1 МБ
});

// Сохраняем экземпляр io в app, чтобы routes/tasks.js мог отправлять события
app.set('io', io);
initSocket(io);

// ============================================================================
// 3. ОБРАБОТКА ОШИБОК
// ============================================================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Маршрут ${req.method} ${req.originalUrl} не найден на сервере`
  });
});

app.use((err, req, res, next) => {
  console.error('Ошибка сервера:', err.message);

  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((val) => val.message);
    return res.status(400).json({ success: false, error: messages.join(', ') });
  }

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

    // Важно: запускаем server.listen (HTTP + WebSocket), а не app.listen
    server.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`🚀 Сервер (REST + Socket.IO) запущен на порту: ${PORT}`);
      console.log(`🔗 API задач: http://localhost:${PORT}/api/tasks`);
      console.log(`=======================================================`);
    });
  } catch (err) {
    console.error('❌ Ошибка подключения к базе данных MongoDB:', err.message);
    process.exit(1);
  }
};

startServer();