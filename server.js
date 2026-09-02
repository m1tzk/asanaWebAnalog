const express = require('express');

// init
const app = express();
const PORT = process.env.PORT || 3000;

// sys middlew
app.use(express.json());

// logger middlew
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
  next();
});

// данные 
let tasks = [
  {
    id: 1,
    title: 'Разработать архитектуру базы данных',
    description: 'Спроектировать реляционную модель для пользователей, проектов и спринтов.',
    status: 'done',
    priority: 'high',
    assignee: 'Алексей Смирнов',
    estimatedHours: 8,
    createdAt: '2025-02-01T10:00:00.000Z',
    updatedAt: '2025-02-02T14:30:00.000Z'
  },
  {
    id: 2,
    title: 'Создать эндпоинты аутентификации JWT',
    description: 'Реализовать регистрацию, логин и генерацию Access/Refresh токенов.',
    status: 'in_progress',
    priority: 'urgent',
    assignee: 'Мария Иванова',
    estimatedHours: 12,
    createdAt: '2025-02-03T09:15:00.000Z',
    updatedAt: '2025-02-03T09:15:00.000Z'
  },
  {
    id: 3,
    title: 'Верстка канбан-доски в клиентском приложении',
    description: 'Реализовать Drag-and-Drop карточек с задачами между колонками статусов.',
    status: 'backlog',
    priority: 'medium',
    assignee: 'Дмитрий Кузнецов',
    estimatedHours: 16,
    createdAt: '2025-02-04T11:00:00.000Z',
    updatedAt: '2025-02-04T11:00:00.000Z'
  }
];

let nextId = 4;

const ALLOWED_STATUSES = ['backlog', 'in_progress', 'review', 'done'];
const ALLOWED_PRIORITIES = ['low', 'medium', 'high', 'urgent'];


// маршрутизация (crud endpoints)
/**
 * @route   GET /api/tasks
 * @desc    Получение списка задач с возможностью фильтрации по query-параметрам
 * @query   status, priority, assignee, search
 */
app.get('/api/tasks', (req, res) => {
  let result = [...tasks];
  const { status, priority, assignee, search } = req.query;

  if (status) {
    result = result.filter(t => t.status.toLowerCase() === status.toLowerCase());
  }

  if (priority) {
    result = result.filter(t => t.priority.toLowerCase() === priority.toLowerCase());
  }

  if (assignee) {
    result = result.filter(t => t.assignee.toLowerCase().includes(assignee.toLowerCase()));
  }

  if (search) {
    const q = search.toLowerCase();
    result = result.filter(t => 
      t.title.toLowerCase().includes(q) || 
      (t.description && t.description.toLowerCase().includes(q))
    );
  }

  return res.status(200).json({
    success: true,
    count: result.length,
    data: result
  });
});

/**
 * @route   GET /api/tasks/:id
 * @desc    Получение одной конкретной задачи по её уникальному идентификатору
 */
app.get('/api/tasks/:id', (req, res) => {
  const taskId = parseInt(req.params.id, 10);

  if (isNaN(taskId)) {
    return res.status(400).json({
      success: false,
      error: 'Некорректный формат ID. Идентификатор должен быть целым числом.'
    });
  }

  const task = tasks.find(t => t.id === taskId);

  if (!task) {
    return res.status(404).json({
      success: false,
      error: `Задача с ID ${taskId} не найдена в системе.`
    });
  }

  return res.status(200).json({
    success: true,
    data: task
  });
});

/**
 * @route   POST /api/tasks
 * @desc    Создание новой задачи
 */
app.post('/api/tasks', (req, res) => {
  const { title, description, status, priority, assignee, estimatedHours } = req.body;

  if (!title || typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({
      success: false,
      error: 'Поле "title" обязательно для заполнения и должно быть непустой строкой.'
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
      error: `Недопустимый статус "${taskStatus}". Разрешенные значения: ${ALLOWED_STATUSES.join(', ')}.`
    });
  }

  const taskPriority = priority || 'medium';
  if (!ALLOWED_PRIORITIES.includes(taskPriority)) {
    return res.status(400).json({
      success: false,
      error: `Недопустимый приоритет "${taskPriority}". Разрешенные значения: ${ALLOWED_PRIORITIES.join(', ')}.`
    });
  }

  const newTask = {
    id: nextId++,
    title: title.trim(),
    description: description ? description.trim() : '',
    status: taskStatus,
    priority: taskPriority,
    assignee: assignee.trim(),
    estimatedHours: Number(estimatedHours) >= 0 ? Number(estimatedHours) : 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  tasks.push(newTask);

  return res.status(201).json({
    success: true,
    message: 'Задача успешно создана.',
    data: newTask
  });
});

/**
 * @route   PUT /api/tasks/:id
 * @desc    Полное обновление существующей задачи (Idempotent Update)
 */
app.put('/api/tasks/:id', (req, res) => {
  const taskId = parseInt(req.params.id, 10);

  if (isNaN(taskId)) {
    return res.status(400).json({
      success: false,
      error: 'Идентификатор задачи должен быть числом.'
    });
  }

  const taskIndex = tasks.findIndex(t => t.id === taskId);

  if (taskIndex === -1) {
    return res.status(404).json({
      success: false,
      error: `Задача с идентификатором ${taskId} не найдена.`
    });
  }

  const { title, description, status, priority, assignee, estimatedHours } = req.body;

  if (!title || !assignee || !status || !priority) {
    return res.status(400).json({
      success: false,
      error: 'Для полного обновления (PUT) необходимо передать все обязательные поля: title, assignee, status, priority.'
    });
  }

  if (!ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      error: `Статус "${status}" некорректен. Допустимо: ${ALLOWED_STATUSES.join(', ')}.`
    });
  }

  if (!ALLOWED_PRIORITIES.includes(priority)) {
    return res.status(400).json({
      success: false,
      error: `Приоритет "${priority}" некорректен. Допустимо: ${ALLOWED_PRIORITIES.join(', ')}.`
    });
  }

  const updatedTask = {
    id: taskId,
    title: title.trim(),
    description: description !== undefined ? description.trim() : '',
    status,
    priority,
    assignee: assignee.trim(),
    estimatedHours: Number(estimatedHours) >= 0 ? Number(estimatedHours) : 0,
    createdAt: tasks[taskIndex].createdAt,
    updatedAt: new Date().toISOString()
  };

  tasks[taskIndex] = updatedTask;

  return res.status(200).json({
    success: true,
    message: `Задача с ID ${taskId} успешно обновлена.`,
    data: updatedTask
  });
});

/**
 * @route   PATCH /api/tasks/:id
 * @desc    Частичное обновление задачи (например, изменение только статуса или исполнителя)
 */
app.patch('/api/tasks/:id', (req, res) => {
  const taskId = parseInt(req.params.id, 10);

  if (isNaN(taskId)) {
    return res.status(400).json({
      success: false,
      error: 'ID задачи должен быть числовым.'
    });
  }

  const task = tasks.find(t => t.id === taskId);

  if (!task) {
    return res.status(404).json({
      success: false,
      error: `Задача с ID ${taskId} не найдена.`
    });
  }

  const { title, description, status, priority, assignee, estimatedHours } = req.body;

  if (status && !ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      error: `Неверный статус. Допустимые варианты: ${ALLOWED_STATUSES.join(', ')}.`
    });
  }

  if (priority && !ALLOWED_PRIORITIES.includes(priority)) {
    return res.status(400).json({
      success: false,
      error: `Неверный приоритет. Допустимые варианты: ${ALLOWED_PRIORITIES.join(', ')}.`
    });
  }

  if (title !== undefined) task.title = title.trim();
  if (description !== undefined) task.description = description.trim();
  if (status !== undefined) task.status = status;
  if (priority !== undefined) task.priority = priority;
  if (assignee !== undefined) task.assignee = assignee.trim();
  if (estimatedHours !== undefined) task.estimatedHours = Number(estimatedHours);
  task.updatedAt = new Date().toISOString();

  return res.status(200).json({
    success: true,
    message: `Задача ID ${taskId} частично обновлена.`,
    data: task
  });
});

/**
 * @route   DELETE /api/tasks/:id
 * @desc    Удаление задачи по идентификатору
 */
app.delete('/api/tasks/:id', (req, res) => {
  const taskId = parseInt(req.params.id, 10);

  if (isNaN(taskId)) {
    return res.status(400).json({
      success: false,
      error: 'Идентификатор задачи должен быть числом.'
    });
  }

  const taskIndex = tasks.findIndex(t => t.id === taskId);

  if (taskIndex === -1) {
    return res.status(404).json({
      success: false,
      error: `Невозможно удалить: задача с ID ${taskId} не найдена.`
    });
  }

  const deletedTask = tasks.splice(taskIndex, 1)[0];

  return res.status(200).json({
    success: true,
    message: `Задача ID ${taskId} («${deletedTask.title}») успешно удалена.`,
    data: deletedTask
  });
});

// обработка маршрутов
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: `Запрошенный маршрут ${req.method} ${req.originalUrl} не существует на сервере.`
  });
});

// обработчик ошибок express
app.use((err, req, res, next) => {
  console.error('Непредвиденная внутренняя ошибка сервера:', err.stack);

  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: 'Невалидный JSON синтаксис в теле запроса.'
    });
  }

  return res.status(500).json({
    success: false,
    error: 'Внутренняя ошибка сервера (Internal Server Error). Пожалуйста, повторите попытку позже.'
  });
});

// запуск
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`Сервер Asana Task Manager запущен на порту: ${PORT}`);
  console.log(`Базовый URL API: http://localhost:${PORT}/api/tasks`);
  console.log(`Режим разработки (Nodemon активен)`);
  console.log(`=======================================================`);
});

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