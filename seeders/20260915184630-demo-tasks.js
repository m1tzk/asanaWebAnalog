'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Add seed commands here.
     *
     * Example:
     * await queryInterface.bulkInsert('People', [{
     *   name: 'John Doe',
     *   isBetaMember: false
     * }], {});
    */
   await queryInterface.bulkInsert('Tasks', [
      {
        title: 'Разработать архитектуру базы данных',
        description: 'Спроектировать реляционную модель PostgreSQL и подключить Sequelize ORM.',
        status: 'done',
        priority: 'high',
        assignee: 'Алексей Смирнов',
        estimatedHours: 8,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        title: 'Создать эндпоинты аутентификации JWT',
        description: 'Реализовать регистрацию, логин и валидацию токенов безопасности.',
        status: 'in_progress',
        priority: 'urgent',
        assignee: 'Мария Иванова',
        estimatedHours: 12,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        title: 'Настроить CI/CD пайплайн в репозитории',
        description: 'Автоматизировать запуск тестов и деплой на тестовый сервер.',
        status: 'backlog',
        priority: 'medium',
        assignee: 'Дмитрий Кузнецов',
        estimatedHours: 6,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  async down (queryInterface, Sequelize) {
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */
    await queryInterface.bulkDelete('Tasks', null, {});
  }
};
