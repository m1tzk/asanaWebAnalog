'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Task extends Model {
    static associate(models) {
      // Связи при необходимости
    }
  }

  Task.init(
    {
      title: {
        type: DataTypes.STRING(70),
        allowNull: false,
        validate: {
          notEmpty: { msg: 'Поле "title" не может быть пустым' },
          len: {
            args: [1, 70],
            msg: 'Название задачи не должно превышать 70 символов'
          }
        }
      },
      description: {
        type: DataTypes.STRING(200),
        allowNull: true,
        validate: {
          len: {
            args: [0, 200],
            msg: 'Описание задачи не должно превышать 200 символов'
          }
        }
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'backlog'
      },
      assignee: {
        type: DataTypes.STRING(40),
        allowNull: false,
        validate: {
          notEmpty: { msg: 'Поле "assignee" обязательно для заполнения' },
          len: {
            args: [1, 40],
            msg: 'Имя исполнителя не должно превышать 40 символов'
          }
        }
      },
      estimatedHours: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        validate: {
          min: { args: [0], msg: 'Оценка времени не может быть отрицательной' },
          max: { args: [400], msg: 'Оценка времени не может превышать 400 часов' }
        }
      },
      priority: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'medium'
      }
    },
    {
      sequelize,
      modelName: 'Task',
      tableName: 'Tasks',
      timestamps: true
    }
  );

  return Task;
};