import React, { useState, useEffect } from 'react';

export function TaskForm({ onSaveTask, taskToEdit, onCancelEdit }) {
  // Локальное состояние полей формы
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignee, setAssignee] = useState('');
  const [estimatedHours, setEstimatedHours] = useState(4);
  const [status, setStatus] = useState('backlog');
  const [priority, setPriority] = useState('medium');
  const [error, setError] = useState('');

  // Если передан taskToEdit — заполняем поля для редактирования
  useEffect(() => {
    if (taskToEdit) {
      setTitle(taskToEdit.title);
      setDescription(taskToEdit.description || '');
      setAssignee(taskToEdit.assignee);
      setEstimatedHours(taskToEdit.estimatedHours);
      setStatus(taskToEdit.status);
      setPriority(taskToEdit.priority);
      setError('');
    } else {
      // Сброс формы
      setTitle('');
      setDescription('');
      setAssignee('');
      setEstimatedHours(4);
      setStatus('backlog');
      setPriority('medium');
      setError('');
    }
  }, [taskToEdit]);

  const handleSubmit = (e) => {
    e.preventDefault();

    // 1. Валидация обязательных полей
    if (!title.trim()) {
      setError('Название задачи обязательно к заполнению!');
      return;
    }
    if (!assignee.trim()) {
      setError('Укажите имя ответственного исполнителя!');
      return;
    }

    // 2. Валидация верхних границ
    if (title.trim().length > 200) {
      setError('Название задачи не должно превышать 200 символов!');
      return;
    }
    if (description.trim().length > 1000) {
      setError('Описание не должно превышать 1000 символов!');
      return;
    }
    if (assignee.trim().length > 100) {
      setError('Имя исполнителя не должно превышать 100 символов!');
      return;
    }
    const hours = Number(estimatedHours);
    if (hours < 0 || hours > 666) {
      setError('Оценка времени должна быть в диапазоне от 0 до 666 часов!');
      return;
    }

    // Формирование объекта задачи
    const payload = {
      id: taskToEdit ? taskToEdit.id : `task-${Date.now()}`,
      title: title.trim(),
      description: description.trim(),
      assignee: assignee.trim(),
      estimatedHours: hours,
      status,
      priority,
      createdAt: taskToEdit ? taskToEdit.createdAt : new Date().toISOString()
    };

    onSaveTask(payload);

    // Очистка при создании
    if (!taskToEdit) {
      setTitle('');
      setDescription('');
      setAssignee('');
      setEstimatedHours(4);
      setStatus('backlog');
      setPriority('medium');
      setError('');
    }
  };

  return (
    <div className="card form-container">
      <h3 className="section-title">
        {taskToEdit ? '✏️ Редактирование задачи' : '➕ Постановка новой задачи'}
      </h3>

      {error && <div className="error-banner">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">
            Название задачи (макс. 200 симв.) *
            <span className="char-counter">{title.length}/200</span>
          </label>
          <input
            type="text"
            className="form-input"
            maxLength={200}
            placeholder="Например: Спроектировать форму аутентификации"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">
            Техническое описание (макс. 1000 симв.)
            <span className="char-counter">{description.length}/1000</span>
          </label>
          <textarea
            className="form-textarea"
            rows="3"
            maxLength={1000}
            placeholder="Подробности задачи и критерии приёмки..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Исполнитель (макс. 100 симв.) *</label>
            <input
              type="text"
              className="form-input"
              maxLength={100}
              placeholder="Имя Фамилия"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Трудозатраты (0–666 ч.)</label>
            <input
              type="number"
              className="form-input"
              min={0}
              max={666}
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Статус задачи</label>
            <select 
              className="form-select" 
              value={status} 
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="backlog">Бэклог (Backlog)</option>
              <option value="in_progress">В работе (In Progress)</option>
              <option value="review">На ревью (Review)</option>
              <option value="done">Завершено (Done)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Приоритет</label>
            <select 
              className="form-select" 
              value={priority} 
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="low">Низкий (Low)</option>
              <option value="medium">Средний (Medium)</option>
              <option value="high">Высокий (High)</option>
              <option value="urgent">Срочный (Urgent)</option>
            </select>
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary">
            {taskToEdit ? 'Сохранить изменения' : 'Создать задачу'}
          </button>
          {taskToEdit && (
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={onCancelEdit}
            >
              Отмена
            </button>
          )}
        </div>
      </form>
    </div>
  );
}