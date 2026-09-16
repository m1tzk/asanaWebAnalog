'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Task extends Model {
    static associate(models) {
      
    }
  }

  Task.init(
    {
      title: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: { msg: 'Поле "title" не может быть пустым' }
        }
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'backlog'
      },
      assignee: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: { msg: 'Поле "assignee" обязательно для заполнения' }
        }
      },
      estimatedHours: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
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