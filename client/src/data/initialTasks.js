export const initialTasks = [
  {
    id: 'task-1',
    title: 'Спроектировать реляционную схему базы данных',
    description: 'Разработать таблицы Users, Tasks и связи между ними в PostgreSQL.',
    status: 'done',
    priority: 'high',
    assignee: 'Алексей Смирнов',
    estimatedHours: 8,
    createdAt: '2026-03-01T10:00:00.000Z'
  },
  {
    id: 'task-2',
    title: 'Реализовать аутентификацию с использованием JWT',
    description: 'Настроить выдачу токенов, хеширование паролей bcrypt и middleware auth.',
    status: 'in_progress',
    priority: 'urgent',
    assignee: 'Мария Иванова',
    estimatedHours: 12,
    createdAt: '2026-03-02T11:30:00.000Z'
  },
  {
    id: 'task-3',
    title: 'Интеграция клиентского интерфейса на React с API',
    description: 'Создать модули управления состоянием, формы задач и фильтрацию спринта.',
    status: 'backlog',
    priority: 'medium',
    assignee: 'Дмитрий Кузнецов',
    estimatedHours: 16,
    createdAt: '2026-03-03T14:15:00.000Z'
  }
];