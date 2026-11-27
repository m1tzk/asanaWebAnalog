/**
 * ============================================================================
 * ЛАБОРАТОРНАЯ РАБОТА №7: REAL-TIME НА БАЗЕ WEBSOCKET (SOCKET.IO) + MONGODB
 * Ветка репозитория: 27
 * ============================================================================
 */

require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Server } = require('socket.io');

const taskRoutes = require('./routes/tasks');
const initSocket = require('./socket/socketHandler');

const app = express();
const PORT = process.env.PORT || 3000;


app.use(cors()); 
app.use(express.json());

// Создаём папку logs при старте (если ещё не существует)
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}
const logFilePath = path.join(logsDir, 'server.log');

// Логирующее middleware (вывод в консоль + сохранение в файл внутри volume)
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${req.method} ${req.originalUrl}\n`;
  console.log(logEntry.trim());

  fs.appendFile(logFilePath, logEntry, (err) => {
    if (err) console.error('Ошибка записи лога:', err.message);
  });

  next();
});

app.use('/api/tasks', taskRoutes);

app.get('/', (req, res) => {
  res.json({
    message: 'Asana Task Manager API (MongoDB Atlas + Socket.IO Real-Time) активен.',
    endpoints: '/api/tasks'
  });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
  },
  maxHttpBufferSize: 1e6 
});

app.set('io', io);
initSocket(io);


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

const startServer = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('Переменная MONGO_URI не задана в файле .env');
    }

    console.log('⏳ Подключение к облачному кластеру MongoDB Atlas...');
    await mongoose.connect(mongoUri, {
      family: 4
    });
    console.log('✅ Успешное подключение к MongoDB Atlas!');

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