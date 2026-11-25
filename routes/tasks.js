const express = require('express');
const router = express.Router();
const Task = require('../models/Task');

// Вспомогательная функция для отправки WebSocket-события из REST-маршрута
function emitTaskEvent(req, eventName, payload) {
  const io = req.app.get('io');
  if (io) {
    io.emit(eventName, payload);
  }
}

// ============================================================================
// 1. БАЗОВЫЕ CRUD-ОПЕРАЦИИ НАД ЗАДАЧАМИ
// ============================================================================

/**
 * @route   GET /api/tasks
 * @desc    Получение списка задач с фильтрацией, поиском, сортировкой и пагинацией
 */
router.get('/', async (req, res, next) => {
  try {
    const {
      status,
      priority,
      assignee,
      tag,
      search,
      sortBy = 'createdAt',
      order = 'desc',
      page,
      limit
    } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (assignee) filter.assignee = { $regex: assignee, $options: 'i' };
    if (tag) filter.tags = tag;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const sortOrder = order === 'asc' ? 1 : -1;

    // Если клиент (React) передал параметры пагинации page & limit
    if (page && limit) {
      const pageNum = Math.max(1, parseInt(page, 10));
      const limitNum = Math.max(1, parseInt(limit, 10));

      const [totalItems, tasks] = await Promise.all([
        Task.countDocuments(filter),
        Task.find(filter)
          .sort({ [sortBy]: sortOrder })
          .skip((pageNum - 1) * limitNum)
          .limit(limitNum)
      ]);

      return res.status(200).json({
        success: true,
        count: tasks.length,
        totalItems,
        hasMore: pageNum * limitNum < totalItems,
        data: tasks
      });
    }

    // Стандартный ответ без пагинации (обратная совместимость с ЛР №6)
    const tasks = await Task.find(filter).sort({ [sortBy]: sortOrder });
    res.status(200).json({
      success: true,
      count: tasks.length,
      totalItems: tasks.length,
      hasMore: false,
      data: tasks
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   GET /api/tasks/:id
 */
router.get('/:id', async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Задача с указанным ID не найдена' });
    }
    res.status(200).json({ success: true, data: task });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   POST /api/tasks
 */
router.post('/', async (req, res, next) => {
  try {
    // Исключаем временные клиентские поля (например, id: "task-171...")
    const { id, _id, createdAt, updatedAt, ...cleanBody } = req.body;
    const newTask = await Task.create(cleanBody);

    emitTaskEvent(req, 'task:created', newTask);

    res.status(201).json({
      success: true,
      message: 'Задача успешно сохранена в MongoDB Atlas',
      data: newTask
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   PUT /api/tasks/:id
 */
router.put('/:id', async (req, res, next) => {
  try {
    const { id, _id, createdAt, updatedAt, ...cleanBody } = req.body;
    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      cleanBody,
      { new: true, runValidators: true }
    );

    if (!updatedTask) {
      return res.status(404).json({ success: false, error: 'Задача не найдена' });
    }

    emitTaskEvent(req, 'task:updated', updatedTask);

    res.status(200).json({
      success: true,
      message: 'Задача полностью обновлена',
      data: updatedTask
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   PATCH /api/tasks/:id
 */
router.patch('/:id', async (req, res, next) => {
  try {
    const { id, _id, ...cleanBody } = req.body;
    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      { $set: cleanBody },
      { new: true, runValidators: true }
    );

    if (!updatedTask) {
      return res.status(404).json({ success: false, error: 'Задача не найдена' });
    }

    emitTaskEvent(req, 'task:updated', updatedTask);

    res.status(200).json({
      success: true,
      message: 'Задача частично обновлена',
      data: updatedTask
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   DELETE /api/tasks/:id
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const deletedTask = await Task.findByIdAndDelete(req.params.id);

    if (!deletedTask) {
      return res.status(404).json({ success: false, error: 'Задача не найдена' });
    }

    emitTaskEvent(req, 'task:deleted', { id: deletedTask.id, title: deletedTask.title });

    res.status(200).json({
      success: true,
      message: `Задача «${deletedTask.title}» и все ее вложенные данные успешно удалены`,
      data: deletedTask
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// 2. ОПЕРАЦИИ С ВЛОЖЕННЫМИ СТРУКТУРАМИ (SUBDOCUMENTS & ARRAYS)
// ============================================================================

router.post('/:id/subtasks', async (req, res, next) => {
  try {
    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, error: 'Поле title подзадачи обязательно' });
    }

    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      { $push: { subtasks: { title: title.trim(), isCompleted: false } } },
      { new: true, runValidators: true }
    );

    if (!updatedTask) {
      return res.status(404).json({ success: false, error: 'Задача не найдена' });
    }

    emitTaskEvent(req, 'task:updated', updatedTask);

    res.status(201).json({
      success: true,
      message: 'Подзадача успешно добавлена в документ задачи',
      data: updatedTask
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/subtasks/:subtaskId', async (req, res, next) => {
  try {
    const { isCompleted } = req.body;
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ success: false, error: 'Задача не найдена' });
    }

    const subtask = task.subtasks.id(req.params.subtaskId);
    if (!subtask) {
      return res.status(404).json({ success: false, error: 'Подзадача с данным ID не найдена' });
    }

    if (isCompleted !== undefined) {
      subtask.isCompleted = isCompleted;
      subtask.completedAt = isCompleted ? new Date() : null;
    }

    await task.save();
    emitTaskEvent(req, 'task:updated', task);

    res.status(200).json({
      success: true,
      message: 'Статус подзадачи обновлен внутри документа',
      data: task
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/subtasks/:subtaskId', async (req, res, next) => {
  try {
    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      { $pull: { subtasks: { _id: req.params.subtaskId } } },
      { new: true }
    );

    if (!updatedTask) {
      return res.status(404).json({ success: false, error: 'Задача не найдена' });
    }

    emitTaskEvent(req, 'task:updated', updatedTask);

    res.status(200).json({
      success: true,
      message: 'Подзадача удалена из массива документа',
      data: updatedTask
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/comments', async (req, res, next) => {
  try {
    const { author, text } = req.body;
    if (!author || !text) {
      return res.status(400).json({ success: false, error: 'Поля author и text обязательны' });
    }

    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      { $push: { comments: { author: author.trim(), text: text.trim() } } },
      { new: true, runValidators: true }
    );

    if (!updatedTask) {
      return res.status(404).json({ success: false, error: 'Задача не найдена' });
    }

    emitTaskEvent(req, 'task:updated', updatedTask);

    res.status(201).json({
      success: true,
      message: 'Комментарий добавлен в задачу',
      data: updatedTask
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;