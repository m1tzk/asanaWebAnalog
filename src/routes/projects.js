const express = require('express');
const router = express.Router();
let { projects, tasks, counters } = require('../data/mockData');

// GET /api/v1/projects — Список проектов с поиском и сортировкой
/**
 * @swagger
 * /api/v1/projects:
 *   get:
 *     summary: Список проектов с поиском и сортировкой
 *     tags: [Projects]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Поиск по названию и описанию
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, createdAt]
 *         description: Поле сортировки
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *         description: Направление сортировки
 *     responses:
 *       200:
 *         description: Список проектов успешно получен
 *       500:
 *         description: Внутренняя ошибка сервера
 */
router.get('/', (req, res) => {
  let result = [...projects];
  const { search, sortBy, order = 'asc' } = req.query;

  if (search) {
    const q = search.toLowerCase();
    result = result.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
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

// GET /api/v1/projects/:id — Детали проекта
/**
 * @swagger
 * /api/v1/projects/{id}:
 *   get:
 *     summary: Получение проекта по ID
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID проекта
 *     responses:
 *       200:
 *         description: Детали проекта
 *       400:
 *         description: ID проекта должен быть числом
 *       404:
 *         description: Проект не найден
 */
router.get('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ success: false, error: 'ID проекта должен быть числом.' });

  const project = projects.find(p => p.id === id);
  if (!project) return res.status(404).json({ success: false, error: `Проект с ID ${id} не найден.` });

  res.status(200).json({ success: true, data: project });
});

// GET /api/v1/projects/:id/tasks — Вложенный ресурс: задачи проекта
/**
 * @swagger
 * /api/v1/projects/{id}/tasks:
 *   get:
 *     summary: Все задачи выбранного проекта
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID проекта
 *     responses:
 *       200:
 *         description: Список задач проекта
 *       400:
 *         description: ID проекта должен быть числом
 *       404:
 *         description: Проект не найден
 */
router.get('/:id/tasks', (req, res) => {
  const projectId = parseInt(req.params.id, 10);
  if (isNaN(projectId)) return res.status(400).json({ success: false, error: 'ID проекта должен быть числом.' });

  const projectExists = projects.some(p => p.id === projectId);
  if (!projectExists) return res.status(404).json({ success: false, error: `Проект с ID ${projectId} не найден.` });

  const projectTasks = tasks.filter(t => t.projectId === projectId);
  res.status(200).json({ success: true, count: projectTasks.length, data: projectTasks });
});

// POST /api/v1/projects — Создание проекта
/**
 * @swagger
 * /api/v1/projects:
 *   post:
 *     summary: Создание нового проекта
 *     tags: [Projects]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 200
 *                 example: Мобильное приложение
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *                 example: Клиент на React Native
 *               color:
 *                 type: string
 *                 example: '#10b981'
 *               deadline:
 *                 type: string
 *                 format: date-time
 *                 example: '2026-11-15T18:00:00.000Z'
 *     responses:
 *       201:
 *         description: Проект успешно создан
 *       400:
 *         description: Ошибка валидации полей
 */
router.post('/', (req, res) => {
  const { name, description, color, deadline } = req.body;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ success: false, error: 'Поле "name" обязательно к заполнению.' });
  }
  if (name.trim().length > 200) {
    return res.status(400).json({ success: false, error: 'Название проекта не должно превышать 200 символов.' });
  }
  if (description && description.trim().length > 1000) {
    return res.status(400).json({ success: false, error: 'Описание проекта не должно превышать 1000 символов.' });
  }

  const newProject = {
    id: counters.getNextProjectId(),
    name: name.trim(),
    description: description ? description.trim() : '',
    color: color && /^#[0-9A-Fa-f]{6}$/.test(color) ? color : '#4f46e5',
    deadline: deadline || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    createdAt: new Date().toISOString()
  };

  projects.push(newProject);
  res.status(201).json({ success: true, message: 'Проект успешно создан.', data: newProject });
});

// PUT /api/v1/projects/:id — Полное обновление проекта
/**
 * @swagger
 * /api/v1/projects/{id}:
 *   put:
 *     summary: Полное обновление проекта
 *     tags: [Projects]
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
 *               - name
 *               - deadline
 *             properties:
 *               name:
 *                 type: string
 *                 example: Обновленный портал
 *               description:
 *                 type: string
 *                 example: Новое описание проекта
 *               color:
 *                 type: string
 *                 example: '#4f46e5'
 *               deadline:
 *                 type: string
 *                 format: date-time
 *                 example: '2026-12-31T23:59:59.000Z'
 *     responses:
 *       200:
 *         description: Проект обновлен
 *       400:
 *         description: Некорректный ID или не заполнены name и deadline
 *       404:
 *         description: Проект не найден
 */
router.put('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ success: false, error: 'ID должен быть числом.' });

  const idx = projects.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).json({ success: false, error: `Проект ID ${id} не найден.` });

  const { name, description, color, deadline } = req.body;
  if (!name || !deadline) {
    return res.status(400).json({ success: false, error: 'Для полного обновления (PUT) обязательны поля: name, deadline.' });
  }

  projects[idx] = {
    id,
    name: name.trim(),
    description: description ? description.trim() : '',
    color: color || projects[idx].color,
    deadline,
    createdAt: projects[idx].createdAt
  };

  res.status(200).json({ success: true, message: 'Проект обновлен.', data: projects[idx] });
});

// PATCH /api/v1/projects/:id — Частичное обновление проекта
/**
 * @swagger
 * /api/v1/projects/{id}:
 *   patch:
 *     summary: Частичное обновление проекта
 *     tags: [Projects]
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
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 200
 *               description:
 *                 type: string
 *               color:
 *                 type: string
 *                 example: '#ef4444'
 *               deadline:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Проект частично обновлен
 *       400:
 *         description: Ошибка валидации
 *       404:
 *         description: Проект не найден
 */
router.patch('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ success: false, error: 'ID должен быть числом.' });

  const project = projects.find(p => p.id === id);
  if (!project) return res.status(404).json({ success: false, error: `Проект ID ${id} не найден.` });

  const { name, description, color, deadline } = req.body;
  if (name !== undefined) {
    if (name.trim().length === 0 || name.trim().length > 200) {
      return res.status(400).json({ success: false, error: 'Длина name должна быть от 1 до 200 символов.' });
    }
    project.name = name.trim();
  }
  if (description !== undefined) project.description = description.trim();
  if (color !== undefined) project.color = color;
  if (deadline !== undefined) project.deadline = deadline;

  res.status(200).json({ success: true, message: 'Проект частично обновлен.', data: project });
});

// DELETE /api/v1/projects/:id — Удаление проекта
/**
 * @swagger
 * /api/v1/projects/{id}:
 *   delete:
 *     summary: Удаление проекта
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Проект успешно удален
 *       400:
 *         description: ID должен быть числом
 *       404:
 *         description: Проект не найден
 */
router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ success: false, error: 'ID должен быть числом.' });

  const idx = projects.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).json({ success: false, error: `Проект ID ${id} не найден.` });

  const deleted = projects.splice(idx, 1)[0];
  res.status(200).json({ success: true, message: `Проект «${deleted.name}» успешно удален.`, data: deleted });
});

module.exports = router;