const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { User } = require('../models');
const authenticateToken = require('../middleware/auth');

const SALT_ROUNDS = 10;

/**
 * @route   POST /auth/register
 * @desc    Регистрация нового пользователя
 */
router.post('/register', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Поля "email" и "password" обязательны для заполнения.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Пароль должен содержать не менее 6 символов.'
      });
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'Пользователь с таким email уже существует.'
      });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const newUser = await User.create({
      email,
      passwordHash
    });

    return res.status(201).json({
      success: true,
      message: 'Пользователь успешно зарегистрирован.',
      user: {
        id: newUser.id,
        email: newUser.email,
        createdAt: newUser.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /auth/login
 * @desc    Вход в систему и получение JWT
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Укажите email и пароль для входа.'
      });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Неверный email или пароль.'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Неверный email или пароль.'
      });
    }

    const tokenPayload = {
      id: user.id,
      email: user.email
    };

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '1h'
    });

    return res.status(200).json({
      success: true,
      message: 'Аутентификация успешна.',
      token,
      user: {
        id: user.id,
        email: user.email
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /auth/profile
 * @desc    Получение профиля текущего аутентифицированного пользователя
 * @access  Protected (Требует валидный JWT)
 */
router.get('/profile', authenticateToken, async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'email', 'createdAt', 'updatedAt'] 
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Пользователь не найден.'
      });
    }

    return res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /auth/forgot-password
 * @desc    Инициация сброса пароля: генерация токена и имитация отправки email
 */
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Укажите email для восстановления пароля.'
      });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Пользователь с указанным email не зарегистрирован.'
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');

    const resetExpires = new Date(Date.now() + 15 * 60 * 1000);

    await user.update({
      resetPasswordToken: resetToken,
      resetPasswordExpires: resetExpires
    });

    console.log('------------------------------------------------------------');
    console.log(`📧 [EMAIL СЕРВИС] Письмо для восстановления пароля отправлено на: ${user.email}`);
    console.log(`🔑 Токен сброса: ${resetToken}`);
    console.log(`🔗 Ссылка для сброса: http://localhost:3000/auth/reset-password?token=${resetToken}`);
    console.log('------------------------------------------------------------');

    return res.status(200).json({
      success: true,
      message: 'Инструкция по сбросу пароля отправлена на email (токен выведен в консоль сервера).',
      debugToken: resetToken
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /auth/reset-password
 * @desc    Установка нового пароля по токену сброса
 */
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Необходимо передать токен сброса и новый пароль.'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Новый пароль должен содержать не менее 6 символов.'
      });
    }

    const user = await User.findOne({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: {
          [Op.gt]: new Date()
        }
      }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Токен сброса недействителен или срок его действия истек.'
      });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await user.update({
      passwordHash: newPasswordHash,
      resetPasswordToken: null,
      resetPasswordExpires: null
    });

    return res.status(200).json({
      success: true,
      message: 'Пароль успешно обновлен. Теперь вы можете войти с новым паролем.'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;