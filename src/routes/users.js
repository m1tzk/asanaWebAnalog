const express = require('express');
const router = express.Router();
let { users, counters } = require('../data/mockData');

const ALLOWED_ROLES = ['admin', 'manager', 'developer', 'designer'];

// GET /api/v1/users — Список всех участников
/**
 * @swagger
 * /api/v1/users:
 *   get:
 *     summary: Список всех участников команды
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [admin, manager, developer, designer]
 *         description: Фильтр по роли участника
 *     responses:
 *       200:
 *         description: Список участников успешно получен
 *       500:
 *         description: Внутренняя ошибка сервера
 */
router.get('/', (req, res) => {
  const { role } = req.query;
  let result = [...users];

  if (role) {
    result = result.filter(u => u.role.toLowerCase() === role.toLowerCase());
  }

  res.status(200).json({ success: true, count: result.length, data: result });
});

// GET /api/v1/users/:id — Получение участника по ID
/**
 * @swagger
 * /api/v1/users/{id}:
 *   get:
 *     summary: Получение участника по ID
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Профиль участника
 *       400:
 *         description: ID пользователя должен быть числом
 *       404:
 *         description: Пользователь не найден
 */
router.get('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ success: false, error: 'ID пользователя должен быть числом.' });

  const user = users.find(u => u.id === id);
  if (!user) return res.status(404).json({ success: false, error: `Пользователь с ID ${id} не найден.` });

  res.status(200).json({ success: true, data: user });
});

// POST /api/v1/users — Добавление участника
/**
 * @swagger
 * /api/v1/users:
 *   post:
 *     summary: Добавление участника команды (уникальный email)
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *                 example: Сергей Васильев
 *               email:
 *                 type: string
 *                 format: email
 *                 example: sergey.vasiliev@asana.team
 *               role:
 *                 type: string
 *                 enum: [admin, manager, developer, designer]
 *                 default: developer
 *                 example: developer
 *     responses:
 *       201:
 *         description: Участник успешно добавлен
 *       400:
 *         description: Ошибка валидации (name, email, role)
 *       409:
 *         description: Пользователь с таким email уже существует
 */
router.post('/', (req, res) => {
  const { name, email, role } = req.body;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ success: false, error: 'Поле "name" обязательно.' });
  }
  if (name.trim().length > 100) {
    return res.status(400).json({ success: false, error: 'Имя не должно превышать 100 символов.' });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, error: 'Некорректный формат адреса email.' });
  }

  // Проверка уникальности
  if (users.some(u => u.email.toLowerCase() === email.toLowerCase().trim())) {
    return res.status(409).json({ success: false, error: 'Пользователь с таким email уже существует.' });
  }

  const userRole = role ? role.toLowerCase() : 'developer';
  if (!ALLOWED_ROLES.includes(userRole)) {
    return res.status(400).json({ success: false, error: `Роль должна быть одной из: ${ALLOWED_ROLES.join(', ')}` });
  }

  const newUser = {
    id: counters.getNextUserId(),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    role: userRole,
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  res.status(201).json({ success: true, message: 'Участник успешно добавлен.', data: newUser });
});

// PUT /api/v1/users/:id — Полное обновление
/**
 * @swagger
 * /api/v1/users/{id}:
 *   put:
 *     summary: Полное обновление профиля участника
 *     tags: [Users]
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
 *               - email
 *               - role
 *             properties:
 *               name:
 *                 type: string
 *                 example: Сергей Васильев
 *               email:
 *                 type: string
 *                 format: email
 *                 example: sergey.vasiliev@asana.team
 *               role:
 *                 type: string
 *                 enum: [admin, manager, developer, designer]
 *                 example: manager
 *     responses:
 *       200:
 *         description: Данные пользователя обновлены
 *       400:
 *         description: Некорректный ID или не указаны name, email, role
 *       404:
 *         description: Пользователь не найден
 */
router.put('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ success: false, error: 'ID должен быть числом.' });

  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return res.status(404).json({ success: false, error: `Пользователь ID ${id} не найден.` });

  const { name, email, role } = req.body;
  if (!name || !email || !role) {
    return res.status(400).json({ success: false, error: 'Обязательны все поля: name, email, role.' });
  }

  users[idx] = {
    id,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    role: role.toLowerCase(),
    createdAt: users[idx].createdAt
  };

  res.status(200).json({ success: true, message: 'Данные пользователя обновлены.', data: users[idx] });
});

// PATCH /api/v1/users/:id — Частичное обновление
/**
 * @swagger
 * /api/v1/users/{id}:
 *   patch:
 *     summary: Частичное обновление профиля (смена имени или роли)
 *     tags: [Users]
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
 *               role:
 *                 type: string
 *                 enum: [admin, manager, developer, designer]
 *                 example: admin
 *     responses:
 *       200:
 *         description: Профиль участника частично изменен
 *       400:
 *         description: Некорректный ID или недопустимая роль
 *       404:
 *         description: Пользователь не найден
 */
router.patch('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ success: false, error: 'ID должен быть числом.' });

  const user = users.find(u => u.id === id);
  if (!user) return res.status(404).json({ success: false, error: `Пользователь ID ${id} не найден.` });

  const { name, role } = req.body;
  if (name !== undefined) user.name = name.trim();
  if (role !== undefined) {
    if (!ALLOWED_ROLES.includes(role.toLowerCase())) {
      return res.status(400).json({ success: false, error: `Недопустимая роль. Варианты: ${ALLOWED_ROLES.join(', ')}` });
    }
    user.role = role.toLowerCase();
  }

  res.status(200).json({ success: true, message: 'Профиль участника частично изменен.', data: user });
});

// DELETE /api/v1/users/:id — Удаление участника
/**
 * @swagger
 * /api/v1/users/{id}:
 *   delete:
 *     summary: Удаление участника
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Пользователь удален
 *       400:
 *         description: ID должен быть числом
 *       404:
 *         description: Пользователь не найден
 */
router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ success: false, error: 'ID должен быть числом.' });

  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return res.status(404).json({ success: false, error: `Пользователь ID ${id} не найден.` });

  const deleted = users.splice(idx, 1)[0];
  res.status(200).json({ success: true, message: `Пользователь ${deleted.name} удален.`, data: deleted });
});

module.exports = router;