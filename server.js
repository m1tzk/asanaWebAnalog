require('dotenv').config(); 
const express = require('express');
const { Op } = require('sequelize'); 
const { sequelize, Task } = require('./models'); 

const app = express();
const PORT = process.env.PORT || 3000;


app.use(express.json());

// log
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
  next();
});

// enums
const ALLOWED_STATUSES = ['backlog', 'in_progress', 'review', 'done'];
const ALLOWED_PRIORITIES = ['low', 'medium', 'high', 'urgent'];


/**
 * @route   GET /api/tasks
 * @desc    Получение списка задач с фильтрацией и поиском из PostgreSQL
 * @query   status, priority, assignee, search
 */
app.get('/api/tasks', async (req, res, next) => {
  try {
    const { status, priority, assignee, search } = req.query;
    const whereConditions = {};

    if (status) {
      whereConditions.status = status.toLowerCase();
    }

    if (priority) {
      whereConditions.priority = priority.toLowerCase();
    }

    if (assignee) {
      whereConditions.assignee = { [Op.iLike]: `%${assignee}%` };
    }

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

    return res.status(200).json({
      success: true,
      count: tasks.length,
      data: tasks
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/tasks/:id
 * @desc    Получение одной задачи по первичному ключу (Primary Key)
 */
app.get('/api/tasks/:id', async (req, res, next) => {
  try {
    const taskId = parseInt(req.params.id, 10);

    if (isNaN(taskId)) {
      return res.status(400).json({
        success: false,
        error: 'Идентификатор задачи должен быть целым числом.'
      });
    }

    const task = await Task.findByPk(taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: `Задача с ID ${taskId} не найдена в базе данных.`
      });
    }

    return res.status(200).json({
      success: true,
      data: task
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/tasks
 * @desc    Создание новой задачи в PostgreSQL
 */
app.post('/api/tasks', async (req, res, next) => {
  try {
    const { title, description, status, priority, assignee, estimatedHours } = req.body;

    if (!title || typeof title !== 'string' || title.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Поле "title" обязательно для заполнения и не может быть пустым.'
      });
    }

    if (!assignee || typeof assignee !== 'string' || assignee.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Поле "assignee" (ответственный) обязательно для заполнения.'
      });
    }

    const taskStatus = status || 'backlog';
    if (!ALLOWED_STATUSES.includes(taskStatus)) {
      return res.status(400).json({
        success: false,
        error: `Недопустимый статус "${taskStatus}". Разрешено: ${ALLOWED_STATUSES.join(', ')}.`
      });
    }

    const taskPriority = priority || 'medium';
    if (!ALLOWED_PRIORITIES.includes(taskPriority)) {
      return res.status(400).json({
        success: false,
        error: `Недопустимый приоритет "${taskPriority}". Разрешено: ${ALLOWED_PRIORITIES.join(', ')}.`
      });
    }

    const newTask = await Task.create({
      title: title.trim(),
      description: description ? description.trim() : null,
      status: taskStatus,
      priority: taskPriority,
      assignee: assignee.trim(),
      estimatedHours: Number(estimatedHours) >= 0 ? Number(estimatedHours) : 0
    });

    return res.status(201).json({
      success: true,
      message: 'Задача успешно сохранена в базе данных.',
      data: newTask
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/tasks/:id
 * @desc    Полное обновление задачи в PostgreSQL
 */
app.put('/api/tasks/:id', async (req, res, next) => {
  try {
    const taskId = parseInt(req.params.id, 10);

    if (isNaN(taskId)) {
      return res.status(400).json({
        success: false,
        error: 'Идентификатор задачи должен быть числом.'
      });
    }

    const task = await Task.findByPk(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        error: `Задача с ID ${taskId} не найдена.`
      });
    }

    const { title, description, status, priority, assignee, estimatedHours } = req.body;

    if (!title || !assignee || !status || !priority) {
      return res.status(400).json({
        success: false,
        error: 'Для полного обновления (PUT) необходимо передать title, assignee, status, priority.'
      });
    }

    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Недопустимый статус. Разрешено: ${ALLOWED_STATUSES.join(', ')}.`
      });
    }

    if (!ALLOWED_PRIORITIES.includes(priority)) {
      return res.status(400).json({
        success: false,
        error: `Недопустимый приоритет. Разрешено: ${ALLOWED_PRIORITIES.join(', ')}.`
      });
    }

    await task.update({
      title: title.trim(),
      description: description !== undefined ? description.trim() : null,
      status,
      priority,
      assignee: assignee.trim(),
      estimatedHours: Number(estimatedHours) >= 0 ? Number(estimatedHours) : 0
    });

    return res.status(200).json({
      success: true,
      message: `Задача с ID ${taskId} успешно обновлена.`,
      data: task
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   DELETE /api/tasks/:id
 * @desc    Удаление задачи из PostgreSQL
 */
app.delete('/api/tasks/:id', async (req, res, next) => {
  try {
    const taskId = parseInt(req.params.id, 10);

    if (isNaN(taskId)) {
      return res.status(400).json({
        success: false,
        error: 'Идентификатор должен быть числом.'
      });
    }

    const deletedCount = await Task.destroy({
      where: { id: taskId }
    });

    if (deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: `Невозможно удалить: задача с ID ${taskId} не найдена в базе данных.`
      });
    }

    return res.status(200).json({
      success: true,
      message: `Задача с ID ${taskId} успешно удалена из базы данных.`
    });
  } catch (error) {
    next(error);
  }
});


app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: `Запрошенный маршрут ${req.method} ${req.originalUrl} не найден.`
  });
});

app.use((err, req, res, next) => {
  console.error('Ошибка в обработке запроса:', err);

  // Ошибки валидации самого Sequelize
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      success: false,
      error: err.errors.map(e => e.message).join(', ')
    });
  }

  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: 'Невалидный JSON синтаксис в теле запроса.'
    });
  }

  return res.status(500).json({
    success: false,
    error: 'Внутренняя ошибка сервера (Database/Internal Error).'
  });
});


const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Успешное подключение к базе данных PostgreSQL через Sequelize!');

    app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`🚀 Сервер Asana Task Manager (Sequelize) слушает порт: ${PORT}`);
      console.log(`🔗 REST API: http://localhost:${PORT}/api/tasks`);
      console.log(`=======================================================`);
    });
  } catch (error) {
    console.error('❌ Не удалось подключиться к базе данных:', error.message);
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