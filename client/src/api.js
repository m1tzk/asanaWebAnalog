import axios from 'axios';

// Базовый экземпляр для запросов к API задач
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Отдельный экземпляр для аутентификации
export const authApi = axios.create({
  baseURL: import.meta.env.VITE_AUTH_URL || 'http://localhost:3000/auth',
  headers: {
    'Content-Type': 'application/json'
  }
});

/**
 * Request Interceptor (Перехватчик запросов):
 * Считывает сохраненный токен из localStorage и прикрепляет его к заголовку Authorization
 */
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Response Interceptor (Перехватчик ответов):
 * Централизованно перехватывает ошибки ответа сервера
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn('Сессия истекла или токен недействителен.');
      // При необходимости: localStorage.removeItem('token');
    }
    return Promise.reject(error);
  }
);

// ============================================================================
// ЭКСПОРТ МЕТОДОВ API
// ============================================================================

// 1. Получение задач с пагинацией и фильтрами (GET)
export const fetchTasksApi = ({ page = 1, limit = 6, status = 'all', priority = 'all', search = '', signal }) => {
  const params = { page, limit };
  if (status !== 'all') params.status = status;
  if (priority !== 'all') params.priority = priority;
  if (search.trim()) params.search = search.trim();

  return api.get('/tasks', { params, signal });
};

// 2. Создание новой задачи (POST)
export const createTaskApi = (taskData) => api.post('/tasks', taskData);

// 3. Полное или частичное обновление задачи (PUT / PATCH)
export const updateTaskApi = (id, taskData) => api.put(`/tasks/${id}`, taskData);
export const patchTaskApi = (id, partialData) => api.patch(`/tasks/${id}`, partialData);

// 4. Удаление задачи по ID (DELETE)
export const deleteTaskApi = (id) => api.delete(`/tasks/${id}`);

// 5. Вход в систему (POST)
export const loginApi = (credentials) => authApi.post('/login', credentials);