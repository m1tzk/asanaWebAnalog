import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  fetchTasksApi, 
  createTaskApi, 
  updateTaskApi, 
  patchTaskApi, 
  deleteTaskApi,
  loginApi 
} from './api';
import { TaskForm } from './components/TaskForm';
import { TaskItem } from './components/TaskItem';
import { TaskFilter } from './components/TaskFilter';
import { TaskStats } from './components/TaskStats';
import './App.css';

export default function App() {
  // 1. Состояния данных и пагинации
  const [tasks, setTasks] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // 2. Асинхронные состояния загрузки и ошибок
  const [isLoading, setIsLoading] = useState(true); // Первичная загрузка
  const [isFetchingMore, setIsFetchingMore] = useState(false); // Подгрузка следующей страницы
  const [error, setError] = useState(null); // Ошибка сетевого запроса
  const [notification, setNotification] = useState(null); // Тост-уведомление (для отката)

  // 3. Состояния фильтрации и поиска
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date-desc');
  const [taskToEdit, setTaskToEdit] = useState(null);

  // 4. Состояние авторизации
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [authEmail, setAuthEmail] = useState('lead@asana.team');
  const [authPassword, setAuthPassword] = useState('strongPassword123');

  // Реф для маркерного элемента Infinite Scroll
  const observerTarget = useRef(null);

  // Вспомогательная функция показа всплывающего уведомления (Toast)
  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // ============================================================================
  // ЗАГРУЗКА ДАННЫХ С СЕРВЕРА С ПОДДЕРЖКОЙ ABORTCONTROLLER (БЕЗОПАСНАЯ ВЕРСИЯ)
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

      // --- ИСПРАВЛЕНИЕ ПРИЧИНЫ №2 (БЕЗОПАСНЫЙ РАЗБОР ОТВЕТА) ---
      
      // 1. Гарантируем, что tasksArray ВСЕГДА будет массивом (даже если сервер вернул странный ответ)
      let tasksArray = [];
      if (Array.isArray(res.data?.data)) {
        // Формат { success: true, data: [...] }
        tasksArray = res.data.data;
      } else if (Array.isArray(res.data)) {
        // Формат, если сервер вернул массив напрямую [...]
        tasksArray = res.data;
      }

      // 2. Безопасное определение наличия следующих страниц
      // Если сервер не прислал hasMore, считаем, что страниц больше нет, если пришло меньше лимита (6)
      const serverHasMore = res.data?.hasMore !== undefined 
        ? Boolean(res.data.hasMore) 
        : tasksArray.length === 6;

      // 3. Безопасное получение общего числа задач (totalItems или count или длина массива)
      const serverTotalCount = res.data?.totalItems ?? res.data?.count ?? tasksArray.length;

      // 4. Обновление состояния (теперь tasks ни при каких условиях не станет undefined)
      setTasks(prev => (isNewFilter || pageNum === 1 ? tasksArray : [...prev, ...tasksArray]));
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
  }, [statusFilter, priorityFilter, searchTerm]);

  // Сброс страницы и перезагрузка при смене фильтров
  useEffect(() => {
    setPage(1);
    loadTasks(1, true);
  }, [statusFilter, priorityFilter, searchTerm, loadTasks]);

  // Загрузка следующей страницы при инкременте page
  useEffect(() => {
    if (page > 1) {
      loadTasks(page, false);
    }
  }, [page, loadTasks]);

  // ============================================================================
  // БЕСКОНЕЧНАЯ ПРОКРУТКА (INFINITE SCROLL ЧЕРЕЗ INTERSECTION OBSERVER)
  // ============================================================================

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // Если маркер внизу страницы виден, есть еще страницы и нет активного запроса
        if (entries[0].isIntersecting && hasMore && !isLoading && !isFetchingMore) {
          setPage(prev => prev + 1);
        }
      },
      { threshold: 0.5 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) observer.unobserve(currentTarget);
    };
  }, [hasMore, isLoading, isFetchingMore]);

  // ============================================================================
  // ОПТИМИСТИЧНЫЕ CRUD-ОПЕРАЦИИ
  // ============================================================================

  /**
   * 1. СОЗДАНИЕ И РЕДАКТИРОВАНИЕ С ОПТИМИСТИЧНЫМ ОБНОВЛЕНИЕМ
   */
  const handleSaveTask = async (taskData) => {
    if (taskToEdit) {
      // --- РЕДАКТИРОВАНИЕ (PUT/PATCH) ---
      const previousTask = tasks.find(t => t.id === taskData.id);
      
      // Шаг 1: Оптимистично обновляем задачу в локальном UI
      setTasks(prev => prev.map(t => t.id === taskData.id ? { ...t, ...taskData } : t));
      setTaskToEdit(null);
      showNotification('Изменения сохранены локально...', 'info');

      try {
        // Шаг 2: Отправляем запрос на сервер
        const res = await updateTaskApi(taskData.id, taskData);
        // Шаг 3: Синхронизируем с ответом сервера
        setTasks(prev => prev.map(t => t.id === taskData.id ? res.data.data : t));
        showNotification('✓ Задача успешно обновлена на сервере!', 'success');
      } catch (err) {
        // Шаг 4: ОТКАТ при ошибке
        setTasks(prev => prev.map(t => t.id === taskData.id ? previousTask : t));
        const msg = err.response?.data?.error || 'Не удалось обновить задачу. Изменения откатаны.';
        showNotification(`Ошибка: ${msg}`, 'danger');
      }
    } else {
      // --- СОЗДАНИЕ (POST) ---
      const tempId = `temp-${Date.now()}`;
      const optimisticTask = {
        ...taskData,
        id: tempId,
        createdAt: new Date().toISOString()
      };

      // Шаг 1: Мгновенно добавляем в список с временным ID
      setTasks(prev => [optimisticTask, ...prev]);
      setTotalCount(prev => prev + 1);
      showNotification('Задача добавлена в интерфейс...', 'info');

      try {
        // Шаг 2: Отправка на сервер
        const res = await createTaskApi(taskData);
        const savedTask = res.data.data;

        // Шаг 3: Заменяем временный ID реальным из базы данных
        setTasks(prev => prev.map(t => t.id === tempId ? savedTask : t));
        showNotification('✓ Задача успешно зафиксирована в PostgreSQL!', 'success');
      } catch (err) {
        // Шаг 4: ОТКАТ — удаляем временную карточку
        setTasks(prev => prev.filter(t => t.id !== tempId));
        setTotalCount(prev => Math.max(0, prev - 1));
        const msg = err.response?.data?.error || 'Сбой при создании задачи. Действие отменено.';
        showNotification(`Ошибка: ${msg}`, 'danger');
      }
    }
  };

  /**
   * 2. УДАЛЕНИЕ С ОПТИМИСТИЧНЫМ ОБНОВЛЕНИЕМ (DELETE)
   */
  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Удалить эту задачу?')) return;

    // Сохраняем удаляемую задачу и её индекс для возможного отката
    const taskToDelete = tasks.find(t => t.id === taskId);
    const originalIndex = tasks.findIndex(t => t.id === taskId);

    // Шаг 1: Мгновенно убираем из списка
    setTasks(prev => prev.filter(t => t.id !== taskId));
    setTotalCount(prev => Math.max(0, prev - 1));
    showNotification('Задача удалена из интерфейса...', 'info');

    try {
      // Шаг 2: Запрос на сервер
      await deleteTaskApi(taskId);
      showNotification('✓ Задача удалена из базы данных!', 'success');
    } catch (err) {
      // Шаг 3: ОТКАТ — возвращаем задачу на её исходную позицию
      setTasks(prev => {
        const restored = [...prev];
        restored.splice(originalIndex, 0, taskToDelete);
        return restored;
      });
      setTotalCount(prev => prev + 1);
      const msg = err.response?.data?.error || 'Не удалось удалить задачу на сервере. Карточка восстановлена.';
      showNotification(`Ошибка: ${msg}`, 'danger');
    }
  };

  /**
   * 3. ПЕРЕКЛЮЧЕНИЕ СТАТУСА С ОПТИМИСТИЧНЫМ PATCH
   */
  const handleToggleStatus = async (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const previousStatus = task.status;
    const newStatus = previousStatus === 'done' ? 'in_progress' : 'done';

    // Шаг 1: Оптимистичное обновление
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));

    try {
      // Шаг 2: Отправка PATCH
      await patchTaskApi(taskId, { status: newStatus });
    } catch (err) {
      // Шаг 3: ОТКАТ
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: previousStatus } : t));
      showNotification('Не удалось изменить статус задачи на сервере.', 'danger');
    }
  };

  // ============================================================================
  // АВТОРИЗАЦИЯ (ВХОД ДЛЯ ПОЛУЧЕНИЯ ТОКЕНА)
  // ============================================================================

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await loginApi({ email: authEmail, password: authPassword });
      const receivedToken = res.data.token;
      setToken(receivedToken);
      localStorage.setItem('token', receivedToken);
      showNotification('✓ Авторизация успешна! JWT токен сохранен.', 'success');
      loadTasks(1, true);
    } catch (err) {
      showNotification('Ошибка входа: проверьте email и пароль.', 'danger');
    }
  };

  const handleLogout = () => {
    setToken('');
    localStorage.removeItem('token');
    showNotification('Вы вышли из системы.', 'info');
  };

  // Локальная сортировка загруженных задач
  const sortedTasks = [...tasks].sort((a, b) => {
    if (sortBy === 'date-desc') return new Date(b.createdAt) - new Date(a.createdAt);
    if (sortBy === 'date-asc') return new Date(a.createdAt) - new Date(b.createdAt);
    if (sortBy === 'hours-desc') return b.estimatedHours - a.estimatedHours;
    if (sortBy === 'hours-asc') return a.estimatedHours - b.estimatedHours;
    return 0;
  });

  return (
    <div className="app-container">
      {/* Всплывающие Toast-уведомления */}
      {notification && (
        <div className={`toast-notification toast-${notification.type}`}>
          {notification.message}
        </div>
      )}

      {/* Верхняя шапка */}
      <header className="app-header">
        <div className="header-brand">
          <h1>📌 Asana Task Manager (Full-Stack REST Client)</h1>
          <p className="header-subtitle">Интеграция с сервером Node.js + Express + PostgreSQL</p>
        </div>

        {/* Панель быстрой аутентификации */}
        <div className="auth-toolbar">
          {token ? (
            <div className="auth-user-badge">
              <span>🔑 Токен активен</span>
              <button className="btn btn-outline btn-sm" onClick={handleLogout}>Выйти</button>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="auth-quick-form">
              <input 
                type="email" 
                className="form-input-sm" 
                value={authEmail} 
                onChange={e => setAuthEmail(e.target.value)} 
                placeholder="Email" 
              />
              <input 
                type="password" 
                className="form-input-sm" 
                value={authPassword} 
                onChange={e => setAuthPassword(e.target.value)} 
                placeholder="Пароль" 
              />
              <button type="submit" className="btn btn-primary btn-sm">Войти</button>
            </form>
          )}
        </div>
      </header>

      {/* Аналитическая панель */}
      <TaskStats tasks={tasks} />

      {/* Основной контент */}
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
            <span>Загружено задач: <strong>{tasks.length}</strong> (из {totalCount} в PostgreSQL)</span>
          </div>

          {/* Состояние первичной загрузки */}
          {isLoading && (
            <div className="loading-screen">
              <div className="spinner"></div>
              <p>Загрузка данных с сервера...</p>
            </div>
          )}

          {/* Состояние критической сетевой ошибки */}
          {error && !isLoading && (
            <div className="card error-state">
              <h3>⚠️ Не удалось связаться с сервером</h3>
              <p>{error}</p>
              <button className="btn btn-primary" onClick={() => loadTasks(1, true)}>
                Повторить попытку (Retry)
              </button>
            </div>
          )}

          {/* Список задач */}
          {!isLoading && !error && tasks.length === 0 ? (
            <div className="card empty-state">
              <h3>Задачи не найдены</h3>
              <p>Попробуйте скорректировать фильтры или добавить задачу через форму слева.</p>
            </div>
          ) : (
            <div className="tasks-grid">
              {sortedTasks.map(task => (
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

          {/* Индикатор подгрузки следующей страницы (Infinite Scroll) */}
          {isFetchingMore && (
            <div className="fetching-more-spinner">
              <div className="spinner-small"></div>
              <span>Подгрузка следующих задач...</span>
            </div>
          )}

          {/* Невидимый маркер для срабатывания IntersectionObserver */}
          <div ref={observerTarget} style={{ height: '20px', margin: '10px 0' }}></div>

          {!hasMore && tasks.length > 0 && (
            <div className="all-loaded-message">
              ✓ Все задачи из базы данных успешно загружены
            </div>
          )}
        </main>
      </div>
    </div>
  );
}