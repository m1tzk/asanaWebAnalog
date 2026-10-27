import React from 'react';

export function TaskStats({ tasks }) {
  const total = tasks.length;
  const doneCount = tasks.filter(t => t.status === 'done').length;
  const inProgressCount = tasks.filter(t => t.status === 'in_progress').length;
  const totalHours = tasks.reduce((sum, t) => sum + Number(t.estimatedHours || 0), 0);
  const completionPercentage = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  return (
    <div className="stats-grid">
      <div className="stat-card">
        <span className="stat-label">Всего задач</span>
        <span className="stat-value">{total}</span>
      </div>
      <div className="stat-card">
        <span className="stat-label">В работе</span>
        <span className="stat-value text-info">{inProgressCount}</span>
      </div>
      <div className="stat-card">
        <span className="stat-label">Завершено</span>
        <span className="stat-value text-success">{doneCount} ({completionPercentage}%)</span>
      </div>
      <div className="stat-card">
        <span className="stat-label">Трудозатраты</span>
        <span className="stat-value">{totalHours} ч.</span>
      </div>
    </div>
  );
}