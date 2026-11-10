const mongoose = require('mongoose');

// 1. Схема вложенного документа подзадачи (Subtask)
const subtaskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Название подзадачи обязательно'],
    trim: true,
    maxlength: [200, 'Название подзадачи не должно превышать 200 символов']
  },
  isCompleted: {
    type: Boolean,
    default: false
  },
  completedAt: {
    type: Date,
    default: null
  }
});

// 2. Схема вложенного документа комментария (Comment)
const commentSchema = new mongoose.Schema({
  author: {
    type: String,
    required: [true, 'Автор комментария обязателен'],
    trim: true,
    maxlength: [100, 'Имя автора не должно превышать 100 символов']
  },
  text: {
    type: String,
    required: [true, 'Текст комментария обязателен'],
    trim: true,
    maxlength: [1000, 'Текст комментария не должен превышать 1000 символов']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// 3. Основная схема задачи (Task Schema)
const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Поле "title" обязательно к заполнению'],
      trim: true,
      maxlength: [200, 'Название задачи не должно превышать 200 символов']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Описание задачи не должно превышать 1000 символов'],
      default: ''
    },
    status: {
      type: String,
      enum: {
        values: ['backlog', 'in_progress', 'review', 'done'],
        message: 'Недопустимый статус задачи'
      },
      default: 'backlog'
    },
    priority: {
      type: String,
      enum: {
        values: ['low', 'medium', 'high', 'urgent'],
        message: 'Недопустимый приоритет задачи'
      },
      default: 'medium'
    },
    assignee: {
      type: String,
      required: [true, 'Исполнитель задачи обязателен'],
      trim: true,
      maxlength: [100, 'Имя исполнителя не должно превышать 100 символов']
    },
    estimatedHours: {
      type: Number,
      min: [0, 'Трудозатраты не могут быть меньше 0'],
      max: [666, 'Трудозатраты не могут превышать 666 часов'],
      default: 0
    },
    // Массив строк для меток/тегов
    tags: {
      type: [String],
      default: []
    },
    // Вложенный массив документов подзадач
    subtasks: [subtaskSchema],
    // Вложенный массив документов комментариев
    comments: [commentSchema]
  },
  {
    timestamps: true // Автоматически добавляет createdAt и updatedAt
  }
);

// Индекс для ускорения фильтрации по статусу и исполнителю
taskSchema.index({ status: 1, assignee: 1 });

// Статический метод модели: поиск срочных незавершенных задач
taskSchema.statics.findUrgent = function () {
  return this.find({ priority: 'urgent', status: { $ne: 'done' } });
};

// Метод экземпляра: переключение выполнения подзадачи
taskSchema.methods.toggleSubtask = function (subtaskId) {
  const subtask = this.subtasks.id(subtaskId);
  if (!subtask) return null;
  subtask.isCompleted = !subtask.isCompleted;
  subtask.completedAt = subtask.isCompleted ? new Date() : null;
  return this.save();
};

const Task = mongoose.model('Task', taskSchema);

module.exports = Task;