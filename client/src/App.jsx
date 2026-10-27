import React, { useState, useEffect } from 'react';
import { initialTasks } from './data/initialTasks';
import { useLocalStorage } from './hooks/useLocalStorage';
import { TaskForm } from './components/TaskForm';
import { TaskItem } from './components/TaskItem';
import { TaskFilter } from './components/TaskFilter';
import { TaskStats } from './components/TaskStats';
import './App.css';

export default function App() {
  // 1. Хранение массива задач в LocalStorage с начальными данными
  const [tasks, setTasks] = useLocalStorage('asana_tasks_v1', initialTasks);

  // 2. Состояния фильтрации, поиска и сортировки
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date-desc');

  // 3. Состояние редактируемой задачи (null — режим добавления)
  const [taskToEdit, setTaskToEdit] = useState(null);

  // 4. Побочный эффект: имитация асинхронной загрузки с сервера (1 секунда)
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);

    // Функция очистки при размонтировании
    return () => clearTimeout(timer);
  }, []);

  // 5. Побочный эффект: динамическое изменение заголовка вкладки браузера
  useEffect(() => {
    const pendingTasks = tasks.filter(t => t.status !== 'done').length;
    document.title = pendingTasks > 0 
      ? `(${pendingTasks}) Активных задач | Asana Clone` 
      : 'Все задачи выполнены! | Asana Clone';
  }, [tasks]);

  // 6. Побочный эффект: таймер автосохранения с debounce (500 мс)
  const [saveStatus, setSaveStatus] = useState('Все изменения сохранены');
  useEffect(() => {
    setSaveStatus('Сохранение...');
    const debounceTimer = setTimeout(() => {
      setSaveStatus('✓ Все данные синхронизированы с LocalStorage');
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [tasks]);

  // Обработчик создания и редактирования задачи
  const handleSaveTask = (taskData) => {
    if (taskToEdit) {
      // Обновление существующей задачи
      setTasks(prev => prev.map(t => t.id === taskData.id ? taskData : t));
      setTaskToEdit(null);
    } else {
      // Добавление новой задачи в начало списка
      setTasks(prev => [taskData, ...prev]);
    }
  };

  // Удаление задачи
  const handleDeleteTask = (taskId) => {
    if (window.confirm('Вы действительно хотите удалить эту задачу?')) {
      setTasks(prev => prev.filter(t => t.id !== taskId));
      if (taskToEdit && taskToEdit.id === taskId) {
        setTaskToEdit(null);
      }
    }
  };

  // Быстрое переключение статуса (Выполнено / В работе)
  const handleToggleStatus = (taskId) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          status: t.status === 'done' ? 'in_progress' : 'done'
        };
      }
      return t;
    }));
  };

  // Сброс хранилища до начального состояния
  const handleResetToDefault = () => {
    if (window.confirm('Сбросить список до демонстрационных данных?')) {
      setTasks(initialTasks);
      setTaskToEdit(null);
    }
  };

  // Вычисление отфильтрованного и отсортированного списка задач
  const filteredTasks = tasks
    .filter(task => {
      const matchesSearch = 
        task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.assignee.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    })
    .sort((a, b) => {
      if (sortBy === 'date-desc') return new Date(b.createdAt) - new Date(a.createdAt);
      if (sortBy === 'date-asc') return new Date(a.createdAt) - new Date(b.createdAt);
      if (sortBy === 'hours-desc') return b.estimatedHours - a.estimatedHours;
      if (sortBy === 'hours-asc') return a.estimatedHours - b.estimatedHours;
      return 0;
    });

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Загрузка рабочего пространства Asana...</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Шапка проекта */}
      <header className="app-header">
        <div className="header-brand">
          <h1>📌 Asana Task Manager</h1>
          <span className="sync-indicator">{saveStatus}</span>
        </div>
        <button className="btn btn-outline" onClick={handleResetToDefault}>
          Сброс до демо-данных
        </button>
      </header>

      {/* Аналитическая панель */}
      <TaskStats tasks={tasks} />

      {/* Основная рабочая область */}
      <div className="app-content-layout">
        <aside className="sidebar-form">
          <TaskForm 
            onSaveTask={handleSaveTask} 
            taskToEdit={taskToEdit} 
            onCancelEdit={() => setTaskToEdit(null)} 
          />
        </aside>

        <main className="main-tasks-area">
          <TaskFilter
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
            priorityFilter={priorityFilter}
            onPriorityChange={setPriorityFilter}
            sortBy={sortBy}
            onSortChange={setSortBy}
          />

          <div className="tasks-count-bar">
            <span>Найдено задач: <strong>{filteredTasks.length}</strong> из {tasks.length}</span>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="card empty-state">
              <h3>Задачи не найдены</h3>
              <p>Попробуйте скорректировать фильтры или добавить новую задачу через форму слева.</p>
            </div>
          ) : (
            <div className="tasks-grid">
              {filteredTasks.map(task => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onDelete={handleDeleteTask}
                  onEdit={setTaskToEdit}
                  onToggleStatus={handleToggleStatus}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}