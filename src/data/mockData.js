/**
 * Временное In-Memory хранилище 3 сущностей Asana Task Manager
 */

let projects = [
  {
    id: 1,
    name: 'Разработка корпоративного портала',
    description: 'Создание внутренней системы управления ресурсами для сотрудников компании.',
    color: '#4f46e5',
    deadline: '2026-12-31T23:59:59.000Z',
    createdAt: '2026-01-10T08:00:00.000Z'
  },
  {
    id: 2,
    name: 'Мобильное приложение (iOS/Android)',
    description: 'Разработка клиентского приложения на React Native.',
    color: '#10b981',
    deadline: '2026-11-15T18:00:00.000Z',
    createdAt: '2026-02-01T09:30:00.000Z'
  },
  {
    id: 3,
    name: 'Модернизация серверной инфраструктуры',
    description: 'Переход на микросервисную архитектуру и настройка CI/CD в Kubernetes.',
    color: '#f59e0b',
    deadline: '2026-10-30T20:00:00.000Z',
    createdAt: '2026-02-15T12:00:00.000Z'
  }
];

let users = [
  {
    id: 1,
    name: 'Алексей Смирнов',
    email: 'alexey.smirnov@asana.team',
    role: 'admin',
    createdAt: '2026-01-01T10:00:00.000Z'
  },
  {
    id: 2,
    name: 'Мария Иванова',
    email: 'maria.ivanova@asana.team',
    role: 'manager',
    createdAt: '2026-01-05T11:00:00.000Z'
  },
  {
    id: 3,
    name: 'Дмитрий Кузнецов',
    email: 'dmitry.kuznetsov@asana.team',
    role: 'developer',
    createdAt: '2026-01-12T14:20:00.000Z'
  }
];

let tasks = [
  {
    id: 1,
    title: 'Спроектировать реляционную модель базы данных',
    description: 'Описать схемы таблиц, индексы и ограничения целостности.',
    status: 'done',
    priority: 'high',
    estimatedHours: 12,
    projectId: 1,
    assigneeId: 1,
    createdAt: '2026-01-11T10:00:00.000Z',
    updatedAt: '2026-01-15T16:00:00.000Z'
  },
  {
    id: 2,
    title: 'Реализовать JWT аутентификацию',
    description: 'Настроить выдачу токенов, роуты входа и сброса пароля.',
    status: 'in_progress',
    priority: 'urgent',
    estimatedHours: 16,
    projectId: 1,
    assigneeId: 3,
    createdAt: '2026-01-16T09:00:00.000Z',
    updatedAt: '2026-01-18T11:30:00.000Z'
  },
  {
    id: 3,
    title: 'Создать UI-кит мобильного приложения',
    description: 'Разработать компоненты кнопок, инпутов и карточек в Figma.',
    status: 'review',
    priority: 'medium',
    estimatedHours: 20,
    projectId: 2,
    assigneeId: 2,
    createdAt: '2026-02-02T10:15:00.000Z',
    updatedAt: '2026-02-05T17:45:00.000Z'
  }
];

let nextProjectId = 4;
let nextUserId = 4;
let nextTaskId = 4;

module.exports = {
  projects,
  users,
  tasks,
  counters: {
    getNextProjectId: () => nextProjectId++,
    getNextUserId: () => nextUserId++,
    getNextTaskId: () => nextTaskId++
  }
};