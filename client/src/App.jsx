import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  fetchTasksApi,
  createTaskApi,
  updateTaskApi,
  patchTaskApi,
  deleteTaskApi
} from './api';
import { createSocket } from './socket';
import { TaskForm } from './components/TaskForm';
import { TaskItem } from './components/TaskItem';
import { TaskFilter } from './components/TaskFilter';
import { TaskStats } from './components/TaskStats';
import { RealtimeWorkspace } from './components/RealtimeWorkspace';
import './App.css';

export default function App() {
  // 1. Вкладки приложения и WebSocket-подключение
  const [activeTab, setActiveTab] = useState('tasks'); // 'tasks' | 'realtime'
  const [username, setUsername] = useState(
    () => localStorage.getItem('ws_username') || `Участник_${Math.floor(100 + Math.random() * 900)}`
  );
  const [usernameInput, setUsernameInput] = useState(username);
  const [socket, setSocket] = useState(null);
  const [isWsConnected, setIsWsConnected] = useState(false);

  // 2. Состояния данных и пагинации
  const [tasks, setTasks] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // 3. Асинхронные состояния загрузки и ошибок
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);

  // 4. Состояния фильтрации и поиска
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date-desc');
  const [taskToEdit, setTaskToEdit] = useState(null);

  const observerTarget = useRef(null);

  const showNotification = useCallback((message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  // ============================================================================
  // ПОДКЛЮЧЕНИЕ WEBSOCKET (SOCKET.IO) И REAL-TIME СИНХРОНИЗАЦИЯ ЗАДАЧ
  // ============================================================================

  useEffect(() => {
    if (!username.trim()) return;

    const newSocket = createSocket(username);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsWsConnected(true);
    });

    newSocket.on('disconnect', () => {
      setIsWsConnected(false);
    });

    newSocket.on('global_presence', (event) => {
      showNotification(`🔔 ${event.message}`, event.type === 'join' ? 'info' : 'danger');
    });

    // Синхронизация доски задач в реальном времени между окнами браузера
    newSocket.on('task:created', (newTask) => {
      setTasks((prev) => {
        if (prev.some((t) => t.id === newTask.id)) return prev;
        setTotalCount((c) => c + 1);
        return [newTask, ...prev];
      });
      showNotification(`⚡ Новая задача: «${newTask.title}»`, 'info');
    });

    newSocket.on('task:updated', (updatedTask) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))
      );
    });

    newSocket.on('task:deleted', ({ id, title }) => {
      setTasks((prev) => {
        const exists = prev.some((t) => t.id === id);
        if (exists) setTotalCount((c) => Math.max(0, c - 1));
        return prev.filter((t) => t.id !== id);
      });
      showNotification(`🗑 Задача «${title}» удалена другим пользователем`, 'info');
    });

    return () => {
      newSocket.disconnect();
    };
  }, [username, showNotification]);

  const handleChangeUsername = (e) => {
    e.preventDefault();
    const clean = usernameInput.trim();
    if (!clean) return;
    localStorage.setItem('ws_username', clean);
    setUsername(clean);
    showNotification(`Вы вошли в WebSocket как ${clean}`, 'success');
  };

  // ============================================================================
  // ЗАГРУЗКА ЗАДАЧ ИЗ MONGODB ATLAS
  // ============================================================================

  const loadTasks = useCallback(async (pageNum, isNewFilter = false) => {
    const controller = new AbortController();

    try {
      if (pageNum === 1) {
        setIsLoading(true);
        setError(null);
      } else {
        setIsFetchingMore(true);
      }

      const res = await fetchTasksApi({
        page: pageNum,
        limit: 6,
        status: statusFilter,
        priority: priorityFilter,
        search: searchTerm,
        signal: controller.signal
      });

      let tasksArray = [];
      if (Array.isArray(res.data?.data)) {
        tasksArray = res.data.data;
      } else if (Array.isArray(res.data)) {
        tasksArray = res.data;
      }

      const serverHasMore =
        res.data?.hasMore !== undefined
          ? Boolean(res.data.hasMore)
          : tasksArray.length === 6;

      const serverTotalCount = res.data?.totalItems ?? res.data?.count ?? tasksArray.length;

      setTasks((prev) => (isNewFilter || pageNum === 1 ? tasksArray : [...prev, ...tasksArray]));
      setHasMore(serverHasMore);
      setTotalCount(serverTotalCount);
      setError(null);
    } catch (err) {
      if (err.name !== 'CanceledError') {
        const errorMsg = err.response?.data?.error || err.message || 'Ошибка соединения с сервером';
        setError(errorMsg);
        showNotification(`Сбой загрузки данных: ${errorMsg}`, 'danger');
      }
    } finally {
      setIsLoading(false);
      setIsFetchingMore(false);
    }

    return () => controller.abort();
  }, [statusFilter, priorityFilter, searchTerm, showNotification]);

  useEffect(() => {
    setPage(1);
    loadTasks(1, true);
  }, [statusFilter, priorityFilter, searchTerm, loadTasks]);

  useEffect(() => {
    if (page > 1) {
      loadTasks(page, false);
    }
  }, [page, loadTasks]);

  // ============================================================================
  // БЕСКОНЕЧНАЯ ПРОКРУТКА (INFINITE SCROLL)
  // ============================================================================

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading && !isFetchingMore) {
          setPage((prev) => prev + 1);
        }
      },
      { threshold: 0.5 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) observer.observe(currentTarget);

    return () => {
      if (currentTarget) observer.unobserve(currentTarget);
    };
  }, [hasMore, isLoading, isFetchingMore]);

  // ============================================================================
  // ОПТИМИСТИЧНЫЕ CRUD-ОПЕРАЦИИ
  // ============================================================================

  const handleSaveTask = async (taskData) => {
    if (taskToEdit) {
      const previousTask = tasks.find((t) => t.id === taskData.id);

      setTasks((prev) => prev.map((t) => (t.id === taskData.id ? { ...t, ...taskData } : t)));
      setTaskToEdit(null);
      showNotification('Изменения сохранены локально...', 'info');

      try {
        const res = await updateTaskApi(taskData.id, taskData);
        setTasks((prev) => prev.map((t) => (t.id === taskData.id ? res.data.data : t)));
        showNotification('✓ Задача обновлена в MongoDB Atlas!', 'success');
      } catch (err) {
        setTasks((prev) => prev.map((t) => (t.id === taskData.id ? previousTask : t)));
        const msg = err.response?.data?.error || 'Не удалось обновить задачу.';
        showNotification(`Ошибка: ${msg}`, 'danger');
      }
    } else {
      const tempId = `temp-${Date.now()}`;
      const optimisticTask = {
        ...taskData,
        id: tempId,
        createdAt: new Date().toISOString()
      };

      setTasks((prev) => [optimisticTask, ...prev]);
      setTotalCount((prev) => prev + 1);
      showNotification('Сохранение задачи...', 'info');

      try {
        const res = await createTaskApi(taskData);
        const savedTask = res.data.data;

        setTasks((prev) => {
          // Если сокет task:created успел прийти раньше ответа HTTP — убираем дубликат
          const withoutDuplicate = prev.filter((t) => t.id !== savedTask.id);
          return withoutDuplicate.map((t) => (t.id === tempId ? savedTask : t));
        });
        showNotification('✓ Задача сохранена в MongoDB Atlas!', 'success');
      } catch (err) {
        setTasks((prev) => prev.filter((t) => t.id !== tempId));
        setTotalCount((prev) => Math.max(0, prev - 1));
        const msg = err.response?.data?.error || 'Сбой при создании задачи.';
        showNotification(`Ошибка: ${msg}`, 'danger');
      }
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Удалить эту задачу?')) return;

    const taskToDelete = tasks.find((t) => t.id === taskId);
    const originalIndex = tasks.findIndex((t) => t.id === taskId);

    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setTotalCount((prev) => Math.max(0, prev - 1));

    try {
      await deleteTaskApi(taskId);
      showNotification('✓ Задача удалена из MongoDB Atlas!', 'success');
    } catch (err) {
      setTasks((prev) => {
        const restored = [...prev];
        restored.splice(originalIndex, 0, taskToDelete);
        return restored;
      });
      setTotalCount((prev) => prev + 1);
      const msg = err.response?.data?.error || 'Не удалось удалить задачу.';
      showNotification(`Ошибка: ${msg}`, 'danger');
    }
  };

  const handleToggleStatus = async (taskId) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const previousStatus = task.status;
    const newStatus = previousStatus === 'done' ? 'in_progress' : 'done';

    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));

    try {
      await patchTaskApi(taskId, { status: newStatus });
    } catch (err) {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: previousStatus } : t)));
      showNotification('Не удалось изменить статус задачи.', 'danger');
    }
  };

  const sortedTasks = [...tasks].sort((a, b) => {
    if (sortBy === 'date-desc') return new Date(b.createdAt) - new Date(a.createdAt);
    if (sortBy === 'date-asc') return new Date(a.createdAt) - new Date(b.createdAt);
    if (sortBy === 'hours-desc') return b.estimatedHours - a.estimatedHours;
    if (sortBy === 'hours-asc') return a.estimatedHours - b.estimatedHours;
    return 0;
  });

  return (
    <div className="app-container">
      {notification && (
        <div className={`toast-notification toast-${notification.type}`}>
          {notification.message}
        </div>
      )}

      {/* Шапка */}
      <header className="app-header">
        <div className="header-brand">
          <h1>📌 Asana Task Manager (MongoDB + WebSocket)</h1>
          <p className="header-subtitle">
            Node.js + Express + MongoDB Atlas + Socket.IO Real-Time ·{' '}
            <span style={{ color: isWsConnected ? '#10b981' : '#ef4444', fontWeight: 600 }}>
              {isWsConnected ? '● WS Подключён' : '○ WS Отключён'}
            </span>
          </p>
        </div>

        {/* Имя пользователя для WebSocket-сессии */}
        <div className="auth-toolbar">
          <form onSubmit={handleChangeUsername} className="auth-quick-form">
            <input
              type="text"
              className="form-input-sm"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder="Ваше имя (WS)"
            />
            <button type="submit" className="btn btn-primary btn-sm">
              Сменить имя
            </button>
          </form>
        </div>
      </header>

      {/* Переключатель вкладок */}
      <nav className="app-tabs">
        <button
          type="button"
          className={`app-tab-btn ${activeTab === 'tasks' ? 'app-tab-active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          📋 Доска задач (Real-time Sync)
        </button>
        <button
          type="button"
          className={`app-tab-btn ${activeTab === 'realtime' ? 'app-tab-active' : ''}`}
          onClick={() => setActiveTab('realtime')}
        >
          💬 Командный чат и голосования (Socket.IO)
        </button>
      </nav>

      {activeTab === 'realtime' ? (
        <RealtimeWorkspace
          socket={socket}
          isWsConnected={isWsConnected}
          username={username}
        />
      ) : (
        <>
          <TaskStats tasks={tasks} />

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
                <span>
                  Загружено задач: <strong>{tasks.length}</strong> (из {totalCount} в MongoDB Atlas)
                </span>
              </div>

              {isLoading && (
                <div className="loading-screen">
                  <div className="spinner"></div>
                  <p>Загрузка данных с сервера...</p>
                </div>
              )}

              {error && !isLoading && (
                <div className="card error-state">
                  <h3>⚠️ Не удалось связаться с сервером</h3>
                  <p>{error}</p>
                  <button className="btn btn-primary" onClick={() => loadTasks(1, true)}>
                    Повторить попытку (Retry)
                  </button>
                </div>
              )}

              {!isLoading && !error && tasks.length === 0 ? (
                <div className="card empty-state">
                  <h3>Задачи не найдены</h3>
                  <p>Попробуйте скорректировать фильтры или добавить задачу через форму слева.</p>
                </div>
              ) : (
                <div className="tasks-grid">
                  {sortedTasks.map((task) => (
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

              {isFetchingMore && (
                <div className="fetching-more-spinner">
                  <div className="spinner-small"></div>
                  <span>Подгрузка следующих задач...</span>
                </div>
              )}

              <div ref={observerTarget} style={{ height: '20px', margin: '10px 0' }}></div>

              {!hasMore && tasks.length > 0 && (
                <div className="all-loaded-message">
                  ✓ Все задачи из базы данных успешно загружены
                </div>
              )}
            </main>
          </div>
        </>
      )}
    </div>
  );
}