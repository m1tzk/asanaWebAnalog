const express = require('express');
const router = express.Router();
let { tasks, projects, users, counters } = require('../data/mockData');

const ALLOWED_STATUSES = ['backlog', 'in_progress', 'review', 'done'];
const ALLOWED_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

// GET /api/v1/tasks — Список задач с фильтрацией, пагинацией и сортировкой
/**
 * @swagger
 * /api/v1/tasks:
 *   get:
 *     summary: Список задач с фильтрацией и сортировкой
 *     tags: [Tasks]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [backlog, in_progress, review, done]
 *         description: Фильтр по статусу
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *         description: Фильтр по приоритету
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: integer
 *         description: Фильтр по ID проекта
 *       - in: query
 *         name: assigneeId
 *         schema:
 *           type: integer
 *         description: Фильтр по ID исполнителя
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Поиск по заголовку и описанию
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *         description: Поле сортировки
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Направление сортировки
 *     responses:
 *       200:
 *         description: Отфильтрованный список задач
 *       500:
 *         description: Внутренняя ошибка сервера
 */
router.get('/', (req, res) => {
  let result = [...tasks];
  const { status, priority, projectId, assigneeId, search, sortBy, order = 'desc' } = req.query;

  if (status) result = result.filter(t => t.status === status.toLowerCase());
  if (priority) result = result.filter(t => t.priority === priority.toLowerCase());
  if (projectId) result = result.filter(t => t.projectId === parseInt(projectId, 10));
  if (assigneeId) result = result.filter(t => t.assigneeId === parseInt(assigneeId, 10));

  if (search) {
    const q = search.toLowerCase();
    result = result.filter(t => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
  }

  if (sortBy) {
    result.sort((a, b) => {
      if (a[sortBy] < b[sortBy]) return order === 'asc' ? -1 : 1;
      if (a[sortBy] > b[sortBy]) return order === 'asc' ? 1 : -1;
      return 0;
    });
  }

  res.status(200).json({ success: true, count: result.length, data: result });
});

// GET /api/v1/tasks/:id — Получение задачи по ID
/**
 * @swagger
 * /api/v1/tasks/{id}:
 *   get:
 *     summary: Получение задачи по ID (с проектом и исполнителем)
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Объект задачи
 *       400:
 *         description: ID должен быть числом
 *       404:
 *         description: Задача не найдена
 */
router.get('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ success: false, error: 'ID должен быть числом.' });

  const task = tasks.find(t => t.id === id);
  if (!task) return res.status(404).json({ success: false, error: `Задача с ID ${id} не найдена.` });

  // Обогащаем данными о проекте и исполнителе
  const project = projects.find(p => p.id === task.projectId);
  const assignee = users.find(u => u.id === task.assigneeId);

  res.status(200).json({ success: true, data: { ...task, project, assignee } });
});

// POST /api/v1/tasks — Создание новой задачи (с проверкой верхних границ)
/**
 * @swagger
 * /api/v1/tasks:
 *   post:
 *     summary: Создание новой задачи (лимит 200/1000/666)
 *     tags: [Tasks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 200
 *                 example: Настроить CI/CD
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *                 example: Автоматизировать деплой на тестовый контур
 *               status:
 *                 type: string
 *                 enum: [backlog, in_progress, review, done]
 *                 default: backlog
 *                 example: in_progress
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *                 default: medium
 *                 example: urgent
 *               estimatedHours:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 666
 *                 default: 0
 *                 example: 8
 *               projectId:
 *                 type: integer
 *                 default: 1
 *                 example: 1
 *               assigneeId:
 *                 type: integer
 *                 default: 1
 *                 example: 2
 *     responses:
 *       201:
 *         description: Задача успешно создана
 *       400:
 *         description: Ошибка валидации или превышение лимитов (title, description, hours 0-666, status, priority)
 */
router.post('/', (req, res) => {
  const { title, description, status, priority, estimatedHours, projectId, assigneeId } = req.body;

  if (!title || typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ success: false, error: 'Поле "title" обязательно к заполнению.' });
  }
  if (title.trim().length > 200) {
    return res.status(400).json({ success: false, error: 'Название задачи не должно превышать 200 символов.' });
  }
  if (description && description.trim().length > 1000) {
    return res.status(400).json({ success: false, error: 'Описание задачи не должно превышать 1000 символов.' });
  }

  const hours = Number(estimatedHours) || 0;
  if (hours < 0 || hours > 666) {
    return res.status(400).json({ success: false, error: 'Оценка времени должна быть в диапазоне от 0 до 666 часов.' });
  }

  const taskStatus = status ? status.toLowerCase() : 'backlog';
  if (!ALLOWED_STATUSES.includes(taskStatus)) {
    return res.status(400).json({ success: false, error: `Недопустимый статус. Разрешено: ${ALLOWED_STATUSES.join(', ')}` });
  }

  const taskPriority = priority ? priority.toLowerCase() : 'medium';
  if (!ALLOWED_PRIORITIES.includes(taskPriority)) {
    return res.status(400).json({ success: false, error: `Недопустимый приоритет. Разрешено: ${ALLOWED_PRIORITIES.join(', ')}` });
  }

  const newTask = {
    id: counters.getNextTaskId(),
    title: title.trim(),
    description: description ? description.trim() : '',
    status: taskStatus,
    priority: taskPriority,
    estimatedHours: hours,
    projectId: projectId ? parseInt(projectId, 10) : 1,
    assigneeId: assigneeId ? parseInt(assigneeId, 10) : 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  tasks.push(newTask);
  res.status(201).json({ success: true, message: 'Задача успешно создана.', data: newTask });
});

// PUT /api/v1/tasks/:id — Полное обновление
/**
 * @swagger
 * /api/v1/tasks/{id}:
 *   put:
 *     summary: Полное обновление задачи
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - status
 *               - priority
 *             properties:
 *               title:
 *                 type: string
 *                 example: Обновленная задача
 *               description:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [backlog, in_progress, review, done]
 *                 example: review
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *                 example: high
 *               estimatedHours:
 *                 type: number
 *                 example: 12
 *               projectId:
 *                 type: integer
 *                 example: 1
 *               assigneeId:
 *                 type: integer
 *                 example: 2
 *     responses:
 *       200:
 *         description: Задача полностью обновлена
 *       400:
 *         description: Некорректный ID или отсутствуют обязательные поля (title, status, priority)
 *       404:
 *         description: Задача не найдена
 */
router.put('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ success: false, error: 'ID должен быть числом.' });

  const idx = tasks.findIndex(t => t.id === id);
  if (idx === -1) return res.status(404).json({ success: false, error: `Задача ID ${id} не найдена.` });

  const { title, description, status, priority, estimatedHours, projectId, assigneeId } = req.body;
  if (!title || !status || !priority) {
    return res.status(400).json({ success: false, error: 'Для PUT обязательны: title, status, priority.' });
  }

  tasks[idx] = {
    id,
    title: title.trim(),
    description: description ? description.trim() : '',
    status: status.toLowerCase(),
    priority: priority.toLowerCase(),
    estimatedHours: Number(estimatedHours) || 0,
    projectId: projectId ? parseInt(projectId, 10) : tasks[idx].projectId,
    assigneeId: assigneeId ? parseInt(assigneeId, 10) : tasks[idx].assigneeId,
    createdAt: tasks[idx].createdAt,
    updatedAt: new Date().toISOString()
  };

  res.status(200).json({ success: true, message: 'Задача полностью обновлена.', data: tasks[idx] });
});

// PATCH /api/v1/tasks/:id — Частичное обновление
/**
 * @swagger
 * /api/v1/tasks/{id}:
 *   patch:
 *     summary: Частичное обновление задачи (статус, часы и др.)
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 200
 *               description:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [backlog, in_progress, review, done]
 *                 example: done
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *               estimatedHours:
 *                 type: number
 *               projectId:
 *                 type: integer
 *               assigneeId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Задача частично обновлена
 *       400:
 *         description: Ошибка валидации
 *       404:
 *         description: Задача не найдена
 */
router.patch('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ success: false, error: 'ID должен быть числом.' });

  const task = tasks.find(t => t.id === id);
  if (!task) return res.status(404).json({ success: false, error: `Задача ID ${id} не найдена.` });

  const { title, description, status, priority, estimatedHours, projectId, assigneeId } = req.body;

  if (title !== undefined) {
    if (title.trim().length === 0 || title.trim().length > 200) {
      return res.status(400).json({ success: false, error: 'Длина title должна быть от 1 до 200 символов.' });
    }
    task.title = title.trim();
  }
  if (description !== undefined) task.description = description.trim();
  if (status !== undefined) task.status = status.toLowerCase();
  if (priority !== undefined) task.priority = priority.toLowerCase();
  if (estimatedHours !== undefined) task.estimatedHours = Number(estimatedHours);
  if (projectId !== undefined) task.projectId = parseInt(projectId, 10);
  if (assigneeId !== undefined) task.assigneeId = parseInt(assigneeId, 10);
  task.updatedAt = new Date().toISOString();

  res.status(200).json({ success: true, message: 'Задача частично обновлена.', data: task });
});

// DELETE /api/v1/tasks/:id — Удаление задачи
/**
 * @swagger
 * /api/v1/tasks/{id}:
 *   delete:
 *     summary: Удаление задачи
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Задача удалена
 *       400:
 *         description: ID должен быть числом
 *       404:
 *         description: Задача не найдена
 */
router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ success: false, error: 'ID должен быть числом.' });

  const idx = tasks.findIndex(t => t.id === id);
  if (idx === -1) return res.status(404).json({ success: false, error: `Задача ID ${id} не найдена.` });

  const deleted = tasks.splice(idx, 1)[0];
  res.status(200).json({ success: true, message: `Задача «${deleted.title}» удалена.`, data: deleted });
});

module.exports = router;