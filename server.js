/**
 * ============================================================================
 * ПРАКТИЧЕСКОЕ ЗАНЯТИЕ №1: MIDDLEWARE, EJS И ФАЙЛОВОЕ ЛОГИРОВАНИЕ
 * Базируется на структуре Лабораторной работы №3 (PostgreSQL + Sequelize)
 * ============================================================================
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');
const { sequelize, Task } = require('./models');

// Роутер аутентификации и JWT middleware из Лаб. 3
const authRoutes = require('./routes/auth');
const authenticateToken = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================================
// 1. ИНИЦИАЛИЗАЦИЯ СИСТЕМЫ ФАЙЛОВОГО ЛОГИРОВАНИЯ
// ============================================================================

const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}
const logFilePath = path.join(logsDir, 'server.log');

// Вспомогательная функция безопасной дозаписи в файл
const writeToLogFile = (logEntry) => {
  fs.appendFile(logFilePath, logEntry + '\n', (err) => {
    if (err) console.error('Ошибка записи в файл логов:', err.message);
  });
};

// ============================================================================
// 2. НАСТРОЙКА VIEW ENGINE (EJS) И СИСТЕМНЫХ ПАРСЕРОВ
// ============================================================================

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Отдача статики (CSS, изображения)
app.use(express.static(path.join(__dirname, 'public')));

// Парсинг форм HTML (application/x-www-form-urlencoded)
app.use(express.urlencoded({ extended: true }));

// Парсинг JSON-тел запросов
app.use(express.json());

// ============================================================================
// 3. КАСТОМНЫЕ MIDDLEWARE
// ============================================================================

/**
 * 1. Логирующее middleware:
 * Измеряет время выполнения запроса, выводит в консоль и записывает в файл logs/server.log
 */
app.use((req, res, next) => {
  const start = Date.now();
  const timestamp = new Date().toISOString();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLine = `[${timestamp}] ${req.method} ${req.originalUrl} | Status: ${res.statusCode} | Duration: ${duration}ms | IP: ${req.ip}`;
    
    // Вывод в терминал
    console.log(logLine);
    
    // Запись в файл на сервере
    writeToLogFile(logLine);
  });

  next();
});

/**
 * 2. Middleware имитации авторизации для веб-интерфейса:
 * Проверяет наличие ?auth=1. Назначает req.user и пробрасывает объект в шаблоны.
 */
app.use((req, res, next) => {
  if (req.query.auth === '1') {
    req.user = {
      isAuthenticated: true,
      name: 'Алексей Смирнов',
      role: 'Team Lead',
      email: 'lead@asana.team'
    };
  } else {
    req.user = {
      isAuthenticated: false,
      name: 'Гость',
      role: 'Guest',
      email: null
    };
  }

  // Делаем пользователя глобально доступным во всех EJS шаблонах
  res.locals.currentUser = req.user;
  res.locals.currentUrl = req.originalUrl;

  next();
});

/**
 * 3. Локальный Guard для веб-маршрутов:
 * Защищает страницы создания задач от неавторизованных пользователей
 */
const requireWebAuth = (req, res, next) => {
  if (req.user && req.user.isAuthenticated) {
    return next();
  }
  return res.redirect('/?needAuth=true');
};

// ============================================================================
// 4. МАРШРУТЫ СЕРВЕРНОГО РЕНДЕРИНГА (SSR НА EJS + POSTGRESQL)
// ============================================================================

/**
 * Главная страница: список задач из PostgreSQL с фильтрацией
 */
app.get('/', async (req, res, next) => {
  try {
    const { status, needAuth } = req.query;
    const whereConditions = {};

    if (status && status !== 'all') {
      whereConditions.status = status.toLowerCase();
    }

    // Запрос задач из базы данных через Sequelize
    const tasks = await Task.findAll({
      where: whereConditions,
      order: [['createdAt', 'DESC']]
    });

    res.render('index', {
      title: 'Канбан-доска проектов',
      tasks,
      selectedStatus: status || 'all',
      needAuthWarning: needAuth === 'true'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Страница добавления новой задачи
 */
app.get('/add', requireWebAuth, (req, res) => {
  res.render('add', {
    title: 'Постановка новой задачи',
    error: null,
    formData: {} // Передаем пустой объект для формы
  });
});

/**
 * Обработка формы создания задачи (Сохранение в PostgreSQL)
 */
app.post('/add', requireWebAuth, async (req, res, next) => {
  try {
    const { title, description, status, priority, assignee, estimatedHours } = req.body;

    const trimmedTitle = (title || '').trim();
    const trimmedDescription = (description || '').trim();
    // 1. Если assignee пустой — подставляем имя текущего пользователя
    const finalAssignee = (assignee && assignee.trim() !== '') ? assignee.trim() : req.user.name;

    // 2. Если estimatedHours пустое — по умолчанию 1
    let hours;
    if (estimatedHours === undefined || estimatedHours === null || String(estimatedHours).trim() === '') {
      hours = 1;
    } else {
      hours = Number(estimatedHours);
    }

    // --- Валидация на стороне сервера ---
    if (!trimmedTitle) {
      return res.status(400).render('add', {
        title: 'Постановка новой задачи',
        error: 'Название задачи обязательно для заполнения.',
        formData: req.body
      });
    }

    if (trimmedTitle.length > 70) {
      return res.status(400).render('add', {
        title: 'Постановка новой задачи',
        error: 'Название задачи не должно превышать 70 символов.',
        formData: req.body
      });
    }

    if (trimmedDescription.length > 200) {
      return res.status(400).render('add', {
        title: 'Постановка новой задачи',
        error: 'Описание задачи не должно превышать 200 символов.',
        formData: req.body
      });
    }

    if (finalAssignee.length > 40) {
      return res.status(400).render('add', {
        title: 'Постановка новой задачи',
        error: 'Имя исполнителя не должно превышать 40 символов.',
        formData: req.body
      });
    }

    if (isNaN(hours) || hours < 0 || hours > 400) {
      return res.status(400).render('add', {
        title: 'Постановка новой задачи',
        error: 'Оценка времени должна быть неотрицательным числом и не превышать 400 часов.',
        formData: req.body
      });
    }

    // Сохранение задачи в PostgreSQL
    await Task.create({
      title: trimmedTitle,
      description: trimmedDescription || null,
      status: status || 'backlog',
      priority: priority || 'medium',
      assignee: finalAssignee,
      estimatedHours: hours
    });

    res.redirect('/?auth=1');
  } catch (error) {
    next(error);
  }
});

/**
 * Детальная карточка задачи по ID из PostgreSQL
 */
app.get('/item/:id', async (req, res, next) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    if (isNaN(taskId)) return next(); // Переход к 404

    const task = await Task.findByPk(taskId);
    if (!task) return next(); // Если в базе нет задачи с таким ID -> 404

    res.render('item', {
      title: `Задача #${task.id}: ${task.title}`,
      task
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Тестовый маршрут для проверки обработки ошибок (500)
 */
app.get('/trigger-error', (req, res, next) => {
  next(new Error('Тестовый критический сбой: ошибка обращения к пулу базы данных PostgreSQL!'));
});

// ============================================================================
// 5. REST API ЭНДПОИНТЫ (СОХРАНЕНЫ ИЗ ЛАБОРАТОРНЫХ 1-3)
// ============================================================================

// Маршруты аутентификации из Лаб. 3 (/auth/register, /auth/login, /auth/forgot-password и т.д.)
app.use('/auth', authRoutes);

// API получения задач
app.get('/api/tasks', async (req, res, next) => {
  try {
    const tasks = await Task.findAll({ order: [['createdAt', 'DESC']] });
    return res.status(200).json({ success: true, count: tasks.length, data: tasks });
  } catch (error) {
    next(error);
  }
});

app.get('/api/tasks/:id', async (req, res, next) => {
  try {
    const task = await Task.findByPk(req.params.id);
    if (!task) return res.status(404).json({ success: false, error: 'Задача не найдена' });
    return res.status(200).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

// app.post('/api/tasks', authenticateToken, async (req, res, next) => {
//   try {
//     const { title, description, status, priority, assignee, estimatedHours } = req.body;

//     // Проверка обязательного заголовка и лимита в 200 символов
//     if (!title || typeof title !== 'string' || title.trim() === '') {
//       return res.status(400).json({ success: false, error: 'Поле "title" обязательно к заполнению.' });
//     }
//     if (title.trim().length > 200) {
//       return res.status(400).json({ success: false, error: 'Длина поля "title" не может превышать 200 символов.' });
//     }

//     // Лимит описания в 1000 символов
//     if (description && description.trim().length > 1000) {
//       return res.status(400).json({ success: false, error: 'Длина поля "description" не может превышать 1000 символов.' });
//     }

//     // Лимит имени исполнителя в 100 символов
//     const taskAssignee = assignee && assignee.trim() !== '' ? assignee.trim() : req.user.email;
//     if (taskAssignee.length > 100) {
//       return res.status(400).json({ success: false, error: 'Длина поля "assignee" не может превышать 100 символов.' });
//     }

//     // Лимит времени до 666 часов
//     const hours = Number(estimatedHours) || 0;
//     if (hours < 0 || hours > 666) {
//       return res.status(400).json({ success: false, error: 'Поле "estimatedHours" должно быть в диапазоне от 0 до 666.' });
//     }

//     const newTask = await Task.create({
//       title: title.trim(),
//       description: description && description.trim() !== '' ? description.trim() : null,
//       status: status || 'backlog',
//       priority: priority || 'medium',
//       assignee: taskAssignee,
//       estimatedHours: hours
//     });

//     return res.status(201).json({ success: true, message: 'Задача создана.', data: newTask });
//   } catch (error) {
//     next(error);
//   }
// });

// ============================================================================
// 6. ОБРАБОТКА ОШИБОК (404 И 500) С ЗАПИСЬЮ СБОЕВ В ЛОГ-ФАЙЛ
// ============================================================================

// 404 Fallback Middleware
app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/auth')) {
    return res.status(404).json({
      success: false,
      error: `API эндпоинт ${req.method} ${req.originalUrl} не найден.`
    });
  }

  res.status(404).render('404', {
    title: '404 - Страница не найдена',
    url: req.originalUrl
  });
});

// Глобальный Error-handling Middleware (500)
app.use((err, req, res, next) => {
  const timestamp = new Date().toISOString();
  const errorLogLine = `[${timestamp}] 💥 ERROR: ${err.message}\nStack: ${err.stack}\n----------------------------------------`;
  
  console.error(errorLogLine);
  writeToLogFile(errorLogLine);

  if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/auth')) {
    return res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера (Internal Server Error).'
    });
  }

  res.status(500).render('500', {
    title: '500 - Ошибка сервера',
    errorMessage: err.message || 'Произошла непредвиденная системная ошибка.'
  });
});

// ============================================================================
// 7. ЗАПУСК СЕРВЕРА И ПОДКЛЮЧЕНИЕ К БАЗЕ ДАННЫХ
// ============================================================================

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Подключение к базе данных PostgreSQL успешно подтверждено!');

    app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`🚀 Сервер Asana Task Manager запущен на порту: ${PORT}`);
      console.log(`🖥  Веб-интерфейс (EJS):  http://localhost:${PORT}/`);
      console.log(`🔐 Вход Team Lead:       http://localhost:${PORT}/?auth=1`);
      console.log(`📝 Файл логов активен:   ${logFilePath}`);
      console.log(`=======================================================`);
    });
  } catch (error) {
    console.error('❌ Ошибка запуска сервера:', error.message);
    process.exit(1);
  }
};

startServer();