const express = require('express');
const router = express.Router();
let { projects, tasks, counters } = require('../data/mockData');

// GET /api/v1/projects — Список проектов с поиском и сортировкой
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
router.get('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ success: false, error: 'ID проекта должен быть числом.' });

  const project = projects.find(p => p.id === id);
  if (!project) return res.status(404).json({ success: false, error: `Проект с ID ${id} не найден.` });

  res.status(200).json({ success: true, data: project });
});

// GET /api/v1/projects/:id/tasks — Вложенный ресурс: задачи проекта
router.get('/:id/tasks', (req, res) => {
  const projectId = parseInt(req.params.id, 10);
  if (isNaN(projectId)) return res.status(400).json({ success: false, error: 'ID проекта должен быть числом.' });

  const projectExists = projects.some(p => p.id === projectId);
  if (!projectExists) return res.status(404).json({ success: false, error: `Проект с ID ${projectId} не найден.` });

  const projectTasks = tasks.filter(t => t.projectId === projectId);
  res.status(200).json({ success: true, count: projectTasks.length, data: projectTasks });
});

// POST /api/v1/projects — Создание проекта
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
router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ success: false, error: 'ID должен быть числом.' });

  const idx = projects.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).json({ success: false, error: `Проект ID ${id} не найден.` });

  const deleted = projects.splice(idx, 1)[0];
  res.status(200).json({ success: true, message: `Проект «${deleted.name}» успешно удален.`, data: deleted });
});

module.exports = router;