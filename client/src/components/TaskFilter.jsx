import React from 'react';

export function TaskFilter({ 
  searchTerm, 
  onSearchChange, 
  statusFilter, 
  onStatusChange, 
  priorityFilter, 
  onPriorityChange,
  sortBy,
  onSortChange 
}) {
  return (
    <div className="filter-card">
      <div className="search-box">
        <input
          type="text"
          className="form-input"
          placeholder="🔍 Поиск задач по названию или описанию..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="filter-controls">
        <select 
          className="form-select" 
          value={statusFilter} 
          onChange={(e) => onStatusChange(e.target.value)}
        >
          <option value="all">Все статусы</option>
          <option value="backlog">Бэклог</option>
          <option value="in_progress">В работе</option>
          <option value="review">На ревью</option>
          <option value="done">Завершено</option>
        </select>

        <select 
          className="form-select" 
          value={priorityFilter} 
          onChange={(e) => onPriorityChange(e.target.value)}
        >
          <option value="all">Все приоритеты</option>
          <option value="low">Низкий (Low)</option>
          <option value="medium">Средний (Medium)</option>
          <option value="high">Высокий (High)</option>
          <option value="urgent">Срочный (Urgent)</option>
        </select>

        <select 
          className="form-select" 
          value={sortBy} 
          onChange={(e) => onSortChange(e.target.value)}
        >
          <option value="date-desc">Сначала новые</option>
          <option value="date-asc">Сначала старые</option>
          <option value="hours-desc">По трудозатратам (убывание)</option>
          <option value="hours-asc">По трудозатратам (возрастание)</option>
        </select>
      </div>
    </div>
  );
}