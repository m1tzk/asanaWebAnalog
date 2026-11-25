import axios from 'axios';


export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json'
  }
});


export const authApi = axios.create({
  baseURL: import.meta.env.VITE_AUTH_URL || 'http://localhost:3000/auth',
  headers: {
    'Content-Type': 'application/json'
  }
});


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


api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn('Сессия истекла или токен недействителен.');
    }
    return Promise.reject(error);
  }
);

export const fetchTasksApi = ({ page = 1, limit = 6, status = 'all', priority = 'all', search = '', signal }) => {
  const params = { page, limit };
  if (status !== 'all') params.status = status;
  if (priority !== 'all') params.priority = priority;
  if (search.trim()) params.search = search.trim();

  return api.get('/tasks', { params, signal });
};


// 2. Создание новой задачи (POST) — исключаем временный id, т.к. MongoDB генерирует _id/id сам
export const createTaskApi = (taskData) => {
  const { id, createdAt, ...payload } = taskData;
  return api.post('/tasks', payload);
};

export const updateTaskApi = (id, taskData) => api.put(`/tasks/${id}`, taskData);
export const patchTaskApi = (id, partialData) => api.patch(`/tasks/${id}`, partialData);

export const deleteTaskApi = (id) => api.delete(`/tasks/${id}`);

export const loginApi = (credentials) => authApi.post('/login', credentials);