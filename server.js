/**
 * ============================================================================
 * Сервер управления задачами и ресурсами команды (Asana Clone)
 * Совмещает REST API (Лабораторная работа) и SSR на EJS (Практическое занятие №1)
 * ============================================================================
 */

const express = require('express');
const path = require('path');

// Инициализация Express-приложения
const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================================
// 1. НАСТРОЙКА VIEW ENGINE (EJS) И СИСТЕМНЫХ MIDDLEWARE
// ============================================================================

// Указываем EJS в качестве шаблонизатора
app.set('view engine', 'ejs');

// Указываем путь к папке с шаблонами
app.set('views', path.join(__dirname, 'views'));

// Middleware для отдачи статических файлов (CSS, картинки, шрифты)
app.use(express.static(path.join(__dirname, 'public')));

// Middleware для парсинга данных обычных HTML-форм (application/x-www-form-urlencoded)
app.use(express.urlencoded({ extended: true }));

// Middleware для парсинга JSON-тел запросов (REST API)
app.use(express.json());

// ============================================================================
// 2. КАСТОМНЫЕ MIDDLEWARE
// ============================================================================

/**
 * 1. Логирующее middleware: выводит метод, URL, статус и время выполнения запроса (в мс)
 */
app.use((req, res, next) => {
  const start = Date.now();
  const timestamp = new Date().toISOString();

  // Отслеживаем завершение ответа клиенту
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${timestamp}] ${req.method} ${req.originalUrl} | Статус: ${res.statusCode} | Время: ${duration}мс`);
  });

  next();
});

/**
 * 2. Middleware для имитации авторизации:
 * Проверяет query-параметр ?auth=1. 
 * Если есть — пользователь считается авторизованным Team Lead, иначе — Гостем.
 */
app.use((req, res, next) => {
  if (req.query.auth === '1') {
    req.user = {
      isAuthenticated: true,
      name: 'Алексей Смирнов',
      role: 'Team Lead'
    };
  } else {
    req.user = {
      isAuthenticated: false,
      name: 'Гость',
      role: 'Guest'
    };
  }

  // Делаем данные пользователя и текущий URL глобально доступными для всех EJS-шаблонов
  res.locals.currentUser = req.user;
  res.locals.currentUrl = req.originalUrl;

  next();
});

/**
 * 3. Middleware для защиты маршрутов (Route Guard):
 * Не пускает неавторизованных пользователей к закрытым действиям (например, созданию задач).
 */
const requireAuth = (req, res, next) => {
  if (req.user && req.user.isAuthenticated) {
    return next();
  }
  // Если не авторизован — редирект на главную страницу с флагом предупреждения
  return res.redirect('/?needAuth=true');
};

// ============================================================================
// 3. БАЗА ДАННЫХ В ПАМЯТИ (In-Memory Array)
// ============================================================================

let tasks = [
  {
    id: 1,
    title: 'Разработать архитектуру базы данных',
    description: 'Спроектировать реляционную модель для пользователей, проектов и спринтов.',
    status: 'done',
    priority: 'high',
    assignee: 'Алексей Смирнов',
    estimatedHours: 8,
    createdAt: '2025-02-01',
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
    createdAt: '2025-02-03',
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
    createdAt: '2025-02-04',
    updatedAt: '2025-02-04T11:00:00.000Z'
  }
];

let nextId = 4;

const ALLOWED_STATUSES = ['backlog', 'in_progress', 'review', 'done'];
const ALLOWED_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

// ============================================================================
// 4. МАРШРУТЫ ГЕНЕРАЦИИ СТРАНИЦ (SSR НА EJS - ПРАКТИЧЕСКОЕ ЗАНЯТИЕ №1)
// ============================================================================

/**
 * @route   GET /
 * @desc    Главная страница: отображение списка задач и канбан-доски
 */
app.get('/', (req, res) => {
  const { status, needAuth } = req.query;
  let filteredTasks = [...tasks];

  if (status && status !== 'all') {
    filteredTasks = filteredTasks.filter(t => t.status.toLowerCase() === status.toLowerCase());
  }

  res.render('index', {
    title: 'Канбан-доска задач',
    tasks: filteredTasks,
    selectedStatus: status || 'all',
    needAuthWarning: needAuth === 'true'
  });
});

/**
 * @route   GET /add
 * @desc    Форма добавления новой задачи (Защищена middleware requireAuth)
 */
app.get('/add', requireAuth, (req, res) => {
  res.render('add', {
    title: 'Постановка новой задачи',
    error: null
  });
});

/**
 * @route   POST /add
 * @desc    Обработка отправки формы добавления новой задачи
 */
app.post('/add', requireAuth, (req, res) => {
  const { title, description, status, priority, assignee, estimatedHours } = req.body;

  // Проверка обязательных полей
  if (!title || !assignee) {
    return res.status(400).render('add', {
      title: 'Постановка новой задачи',
      error: 'Пожалуйста, заполните обязательные поля: Название и Исполнитель.'
    });
  }

  const newTask = {
    id: nextId++,
    title: title.trim(),
    description: description ? description.trim() : '',
    status: status || 'backlog',
    priority: priority || 'medium',
    assignee: assignee.trim(),
    estimatedHours: Number(estimatedHours) >= 0 ? Number(estimatedHours) : 0,
    createdAt: new Date().toISOString().split('T')[0],
    updatedAt: new Date().toISOString()
  };

  tasks.push(newTask);

  // Редирект на главную страницу с сохранением флага авторизации
  res.redirect('/?auth=1');
});

/**
 * @route   GET /item/:id
 * @desc    Детальная страница конкретной задачи по её ID
 */
app.get('/item/:id', (req, res, next) => {
  const taskId = parseInt(req.params.id, 10);

  if (isNaN(taskId)) {
    return next(); // Передаем управление дальше в 404
  }

  const task = tasks.find(t => t.id === taskId);

  if (!task) {
    return next(); // Передаем управление дальше в 404
  }

  res.render('item', {
    title: `Задача #${task.id}: ${task.title}`,
    task
  });
});

/**
 * @route   GET /trigger-error
 * @desc    Тестовый маршрут для демонстрации работы страницы 500 (Internal Server Error)
 */
app.get('/trigger-error', (req, res, next) => {
  next(new Error('Тестовое критическое исключение: ошибка подключения к серверу ресурсов!'));
});

// ============================================================================
// 5. МАРШРУТИЗАЦИЯ REST API (CRUD ENDPOINTS - СОХРАНЕНО ИЗ ЛАБОРАТОРНОЙ)
// ============================================================================

/**
 * @route   GET /api/tasks
 * @desc    Получение списка задач с возможностью фильтрации по query-параметрам
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
 * @desc    Создание новой задачи через REST API
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
    createdAt: new Date().toISOString().split('T')[0],
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
 * @desc    Частичное обновление задачи
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

// ============================================================================
// 6. ОБРАБОТКА ОШИБОК (ДЛЯ СТРАНИЦ EJS И ДЛЯ REST API)
// ============================================================================

// Middleware для перехвата ненайденных маршрутов (404 Fallback)
app.use((req, res, next) => {
  // Если запрос предназначался для API — возвращаем JSON
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({
      success: false,
      error: `Запрошенный API маршрут ${req.method} ${req.originalUrl} не существует.`
    });
  }

  // Для запросов браузера рендерим шаблон 404.ejs
  res.status(404).render('404', {
    title: '404 - Страница не найдена',
    url: req.originalUrl
  });
});

// Глобальный обработчик внутренних ошибок (500 Error Handler)
app.use((err, req, res, next) => {
  console.error('Непредвиденная внутренняя ошибка сервера:', err.stack);

  // Ошибка синтаксиса JSON в теле запроса
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: 'Невалидный JSON синтаксис в теле запроса.'
    });
  }

  // Если ошибка произошла при вызове API — отдаем JSON
  if (req.originalUrl.startsWith('/api')) {
    return res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера (Internal Server Error).'
    });
  }

  // Для браузера рендерим страницу ошибки 500.ejs
  res.status(500).render('500', {
    title: '500 - Внутренняя ошибка сервера',
    errorMessage: err.message || 'Произошла непредвиденная ошибка при обработке запроса.'
  });
});

// ============================================================================
// 7. ЗАПУСК СЕРВЕРА
// ============================================================================

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Сервер Asana Task Manager запущен на порту: ${PORT}`);
  console.log(`🖥  Главная страница (EJS): http://localhost:${PORT}/`);
  console.log(`🔐 Имитация Team Lead:     http://localhost:${PORT}/?auth=1`);
  console.log(`🔗 Базовый URL REST API:    http://localhost:${PORT}/api/tasks`);
  console.log(`=======================================================`);
});