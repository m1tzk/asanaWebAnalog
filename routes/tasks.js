const express = require('express');
const router = express.Router();
const Task = require('../models/Task');

// ============================================================================
// 1. БАЗОВЫЕ CRUD-ОПЕРАЦИИ НАД ЗАДАЧАМИ
// ============================================================================

/**
 * @route   GET /api/tasks
 * @desc    Получение списка задач с фильтрацией, поиском по тегам и сортировкой
 */
router.get('/', async (req, res, next) => {
  try {
    const { status, priority, assignee, tag, search, sortBy = 'createdAt', order = 'desc' } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (assignee) filter.assignee = { $regex: assignee, $options: 'i' };
    
    // Поиск по вхождению в массив тегов
    if (tag) filter.tags = tag;

    // Полнотекстовый поиск по названию или описанию
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const sortOrder = order === 'asc' ? 1 : -1;
    const tasks = await Task.find(filter).sort({ [sortBy]: sortOrder });

    res.status(200).json({
      success: true,
      count: tasks.length,
      data: tasks
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   GET /api/tasks/:id
 * @desc    Получение одной задачи со всеми вложенными подзадачами и комментариями
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
 * @desc    Создание новой задачи (с возможностью сразу передать подзадачи и теги)
 */
router.post('/', async (req, res, next) => {
  try {
    const newTask = await Task.create(req.body);

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
 * @desc    Полное обновление задачи
 */
router.put('/:id', async (req, res, next) => {
  try {
    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true } // new: true возвращает обновленный документ
    );

    if (!updatedTask) {
      return res.status(404).json({ success: false, error: 'Задача не найдена' });
    }

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
 * @desc    Частичное обновление задачи
 */
router.patch('/:id', async (req, res, next) => {
  try {
    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!updatedTask) {
      return res.status(404).json({ success: false, error: 'Задача не найдена' });
    }

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
 * @desc    Удаление задачи (и всех ее вложенных подзадач и комментариев)
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const deletedTask = await Task.findByIdAndDelete(req.params.id);

    if (!deletedTask) {
      return res.status(404).json({ success: false, error: 'Задача не найдена' });
    }

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

/**
 * @route   POST /api/tasks/:id/subtasks
 * @desc    Добавление подзадачи во вложенный массив ($push)
 */
router.post('/:id/subtasks', async (req, res, next) => {
  try {
    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, error: 'Поле title подзадачи обязательно' });
    }

    // Оператор $push атомарно добавляет элемент во вложенный массив MongoDB
    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          subtasks: { title: title.trim(), isCompleted: false }
        }
      },
      { new: true, runValidators: true }
    );

    if (!updatedTask) {
      return res.status(404).json({ success: false, error: 'Задача не найдена' });
    }

    res.status(201).json({
      success: true,
      message: 'Подзадача успешно добавлена в документ задачи',
      data: updatedTask
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   PATCH /api/tasks/:id/subtasks/:subtaskId
 * @desc    Обновление элемента внутри массива (переключение выполнения подзадачи)
 */
router.patch('/:id/subtasks/:subtaskId', async (req, res, next) => {
  try {
    const { isCompleted } = req.body;
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ success: false, error: 'Задача не найдена' });
    }

    // Поиск конкретного субдокумента по его уникальному ObjectId
    const subtask = task.subtasks.id(req.params.subtaskId);
    if (!subtask) {
      return res.status(404).json({ success: false, error: 'Подзадача с данным ID не найдена' });
    }

    // Обновление состояния субдокумента
    if (isCompleted !== undefined) {
      subtask.isCompleted = isCompleted;
      subtask.completedAt = isCompleted ? new Date() : null;
    }

    await task.save();

    res.status(200).json({
      success: true,
      message: 'Статус подзадачи обновлен внутри документа',
      data: task
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   DELETE /api/tasks/:id/subtasks/:subtaskId
 * @desc    Удаление подзадачи из вложенного массива ($pull)
 */
router.delete('/:id/subtasks/:subtaskId', async (req, res, next) => {
  try {
    // Оператор $pull удаляет элементы из массива, соответствующие условию
    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      {
        $pull: { subtasks: { _id: req.params.subtaskId } }
      },
      { new: true }
    );

    if (!updatedTask) {
      return res.status(404).json({ success: false, error: 'Задача не найдена' });
    }

    res.status(200).json({
      success: true,
      message: 'Подзадача удалена из массива документа',
      data: updatedTask
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   POST /api/tasks/:id/comments
 * @desc    Добавление комментария в ленту обсуждения задачи
 */
router.post('/:id/comments', async (req, res, next) => {
  try {
    const { author, text } = req.body;
    if (!author || !text) {
      return res.status(400).json({ success: false, error: 'Поля author и text обязательны' });
    }

    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          comments: { author: author.trim(), text: text.trim() }
        }
      },
      { new: true, runValidators: true }
    );

    if (!updatedTask) {
      return res.status(404).json({ success: false, error: 'Задача не найдена' });
    }

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