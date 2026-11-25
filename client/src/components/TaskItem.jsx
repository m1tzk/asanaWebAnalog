import React from 'react';

export function TaskItem({ task, onDelete, onEdit, onToggleStatus }) {
  const isDone = task.status === 'done';

  return (
    <div className={`task-card ${isDone ? 'task-card-done' : ''}`}>
      <div className="task-header">
        <div className="task-badges">
          <span className={`badge badge-status-${task.status || 'backlog'}`}>
            {task.status || 'backlog'}
          </span>
          <span className={`badge badge-priority-${task.priority}`}>
            {task.priority}
          </span>
        </div>
        <span className="task-id">#{String(task.id)}</span>
      </div>

      <h4 className="task-title">{task.title}</h4>
      <p className="task-description">{task.description || 'Описание отсутствует.'}</p>

      <div className="task-meta">
        <span>👤 {task.assignee}</span>
        <span>⏱ {task.estimatedHours} ч.</span>
      </div>

      <div className="task-footer">
        <button
          className={`btn-action ${isDone ? 'btn-reopen' : 'btn-complete'}`}
          onClick={() => onToggleStatus(task.id)}
          title={isDone ? 'Вернуть в работу' : 'Завершить задачу'}
        >
          {isDone ? '↩ В работу' : '✓ Завершить'}
        </button>
        <button 
          className="btn-action btn-edit" 
          onClick={() => onEdit(task)}
        >
          ✎ Изменить
        </button>
        <button 
          className="btn-action btn-delete" 
          onClick={() => onDelete(task.id)}
        >
          🗑 Удалить
        </button>
      </div>
    </div>
  );
}