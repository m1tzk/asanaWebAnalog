require('dotenv').config();
const express = require('express');
const { Op } = require('sequelize');
const { sequelize, Task } = require('./models');

const authRoutes = require('./routes/auth');
const authenticateToken = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

const cors = require('cors');

app.use(express.json());

app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
  next();
});

app.use('/auth', authRoutes);

// Разрешаем кросс-доменные запросы с порта клиентского приложения
app.use(cors({
  origin: 'http://localhost:5173', // Порт Vite по умолчанию
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.get('/api/tasks', async (req, res, next) => {
  try {
    const { status, priority, assignee, search } = req.query;
    const whereConditions = {};

    if (status) whereConditions.status = status.toLowerCase();
    if (priority) whereConditions.priority = priority.toLowerCase();
    if (assignee) whereConditions.assignee = { [Op.iLike]: `%${assignee}%` };
    if (search) {
      whereConditions[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const tasks = await Task.findAll({
      where: whereConditions,
      order: [['createdAt', 'DESC']]
    });

    return res.status(200).json({ success: true, count: tasks.length, data: tasks });
  } catch (error) {
    next(error);
  }
});

app.get('/api/tasks/:id', async (req, res, next) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    if (isNaN(taskId)) return res.status(400).json({ success: false, error: 'ID должен быть числом.' });

    const task = await Task.findByPk(taskId);
    if (!task) return res.status(404).json({ success: false, error: `Задача ID ${taskId} не найдена.` });

    return res.status(200).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

app.post('/api/tasks', authenticateToken, async (req, res, next) => {
  try {
    const { title, description, status, priority, assignee, estimatedHours } = req.body;

    if (!title || typeof title !== 'string' || title.trim() === '') {
      return res.status(400).json({ success: false, error: 'Поле "title" обязательно к заполнению.' });
    }

    const newTask = await Task.create({
      title: title.trim(),
      description: description ? description.trim() : null,
      status: status || 'backlog',
      priority: priority || 'medium',
      assignee: assignee ? assignee.trim() : req.user.email, 
      estimatedHours: Number(estimatedHours) || 0,
      userId: req.user.id
    });

    return res.status(201).json({ success: true, message: 'Задача создана.', data: newTask });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/tasks/:id', authenticateToken, async (req, res, next) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    if (isNaN(taskId)) return res.status(400).json({ success: false, error: 'ID должен быть числом.' });

    const deletedCount = await Task.destroy({ where: { id: taskId } });
    if (deletedCount === 0) {
      return res.status(404).json({ success: false, error: `Задача с ID ${taskId} не найдена.` });
    }

    return res.status(200).json({ success: true, message: `Задача ID ${taskId} удалена.` });
  } catch (error) {
    next(error);
  }
});

app.use((req, res, next) => {
  res.status(404).json({ success: false, error: `Маршрут ${req.method} ${req.originalUrl} не найден.` });
});

app.use((err, req, res, next) => {
  console.error('Ошибка сервера:', err);

  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    return res.status(400).json({ success: false, error: err.errors.map(e => e.message).join(', ') });
  }

  return res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера.' });
});

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Подключение к PostgreSQL успешно установлено!');

    app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`🚀 Сервер Asana Task Manager запущен на порту: ${PORT}`);
      console.log(`🔑 Аутентификация: http://localhost:${PORT}/auth/login`);
      console.log(`=======================================================`);
    });
  } catch (error) {
    console.error('❌ Ошибка запуска сервера:', error.message);
    process.exit(1);
  }
};

startServer();
// curl -X POST http://localhost:3000/api/tasks \
//   -H "Content-Type: application/json" \
//   -d '{
//     "title": "Интеграция с почтовым сервисом",
//     "description": "Отправка уведомлений исполнителям при назначении задачи",
//     "status": "backlog",
//     "priority": "high",
//     "assignee": "Анна Смирнова",
//     "estimatedHours": 5
//   }'