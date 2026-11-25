const ChatMessage = require('../models/ChatMessage');
const Poll = require('../models/Poll');

// Хранилище активных подключений: socket.id -> { username, room }
const onlineUsers = new Map();

function getUsersInRoom(room) {
  const users = [];
  for (const user of onlineUsers.values()) {
    if (user.room === room) {
      users.push(user.username);
    }
  }
  return [...new Set(users)];
}

module.exports = function initSocket(io) {
  // Получаем имя пользователя из handshake при подключении
  io.use((socket, next) => {
    const username = socket.handshake.auth?.username?.trim();
    if (!username) {
      return next(new Error('Имя пользователя обязательно для WebSocket-подключения'));
    }
    socket.username = username;
    next();
  });

  io.on('connection', (socket) => {
    console.log(`🟢 [WS] Подключён: ${socket.username} (${socket.id})`);

    // Уведомляем остальных подключённых пользователей о новом участнике онлайн
    socket.broadcast.emit('global_presence', {
      type: 'join',
      username: socket.username,
      message: `${socket.username} подключился(ась) к рабочему пространству`
    });

    // 1. Вход в комнату (канал проекта: #general, #sprint-planning, #frontend, #backend)
    socket.on('join_room', async (roomName, callback) => {
      try {
        const previous = onlineUsers.get(socket.id);
        if (previous?.room && previous.room !== roomName) {
          socket.leave(previous.room);
          onlineUsers.set(socket.id, { username: socket.username, room: roomName });
          io.to(previous.room).emit('room_users', getUsersInRoom(previous.room));
          socket.to(previous.room).emit('system_notification', {
            text: `${socket.username} перешёл(а) из канала #${previous.room}`,
            createdAt: new Date()
          });
        } else {
          onlineUsers.set(socket.id, { username: socket.username, room: roomName });
        }

        socket.join(roomName);

        // Загружаем историю сообщений и опросы из MongoDB Atlas
        const [history, polls] = await Promise.all([
          ChatMessage.find({ room: roomName }).sort({ createdAt: -1 }).limit(50).lean(),
          Poll.find({ room: roomName }).sort({ createdAt: -1 }).limit(15).lean()
        ]);

        // Уведомляем других участников комнаты
        socket.to(roomName).emit('system_notification', {
          text: `${socket.username} вошёл(а) в канал #${roomName}`,
          createdAt: new Date()
        });

        // Обновляем список пользователей в комнате у всех
        io.to(roomName).emit('room_users', getUsersInRoom(roomName));

        if (typeof callback === 'function') {
          callback({
            status: 'ok',
            history: history.reverse(),
            polls
          });
        }
      } catch (err) {
        console.error('Ошибка join_room:', err.message);
        callback?.({ status: 'error', message: 'Ошибка при входе в комнату' });
      }
    });

    // 2. Отправка сообщения в чат комнаты с сохранением в MongoDB
    socket.on('chat_message', async ({ room, text }, callback) => {
      try {
        if (!room || !text?.trim()) return;

        const savedMessage = await ChatMessage.create({
          room,
          sender: socket.username,
          text: text.trim()
        });

        io.to(room).emit('chat_message', savedMessage);
        callback?.({ status: 'ok', id: savedMessage._id });
      } catch (err) {
        console.error('Ошибка chat_message:', err.message);
        callback?.({ status: 'error', message: 'Не удалось сохранить сообщение' });
      }
    });

    // 3. Индикатор "печатает..." (broadcast внутри комнаты без записи в БД)
    socket.on('typing', ({ room, isTyping }) => {
      if (!room) return;
      socket.to(room).emit('user_typing', {
        username: socket.username,
        isTyping: Boolean(isTyping)
      });
    });

    // 4. Создание голосования/опроса в реальном времени (Часть 3 ТЗ)
    socket.on('create_poll', async ({ room, question, options }, callback) => {
      try {
        const cleanOptions = (options || []).map((o) => o.trim()).filter(Boolean);
        if (!room || !question?.trim() || cleanOptions.length < 2) {
          return callback?.({ status: 'error', message: 'Введите вопрос и минимум 2 варианта ответа' });
        }

        const newPoll = await Poll.create({
          room,
          question: question.trim(),
          createdBy: socket.username,
          options: cleanOptions.map((text) => ({ text, votes: 0, voters: [] }))
        });

        io.to(room).emit('poll_created', newPoll);
        io.to(room).emit('system_notification', {
          text: `${socket.username} создал(а) опрос: «${newPoll.question}»`,
          createdAt: new Date()
        });

        callback?.({ status: 'ok', poll: newPoll });
      } catch (err) {
        console.error('Ошибка create_poll:', err.message);
        callback?.({ status: 'error', message: 'Ошибка создания опроса' });
      }
    });

    // 5. Голосование в опросе в реальном времени
    socket.on('vote_poll', async ({ pollId, optionId }, callback) => {
      try {
        const poll = await Poll.findById(pollId);
        if (!poll) {
          return callback?.({ status: 'error', message: 'Опрос не найден' });
        }

        // Снимаем предыдущий голос пользователя в этом опросе (чтобы можно было переголосовать)
        poll.options.forEach((opt) => {
          const idx = opt.voters.indexOf(socket.username);
          if (idx !== -1) {
            opt.voters.splice(idx, 1);
            opt.votes = opt.voters.length;
          }
        });

        const selectedOption = poll.options.id(optionId);
        if (!selectedOption) {
          return callback?.({ status: 'error', message: 'Вариант не найден' });
        }

        selectedOption.voters.push(socket.username);
        selectedOption.votes = selectedOption.voters.length;

        await poll.save();

        // Мгновенно обновляем результаты у всех в этой комнате
        io.to(poll.room).emit('poll_updated', poll);
        callback?.({ status: 'ok' });
      } catch (err) {
        console.error('Ошибка vote_poll:', err.message);
        callback?.({ status: 'error', message: 'Ошибка голосования' });
      }
    });

    // 6. Разрыв соединения (уведомление об отключении)
    socket.on('disconnect', (reason) => {
      const user = onlineUsers.get(socket.id);
      if (user) {
        onlineUsers.delete(socket.id);
        io.to(user.room).emit('room_users', getUsersInRoom(user.room));
        socket.to(user.room).emit('system_notification', {
          text: `${user.username} отключился(ась)`,
          createdAt: new Date()
        });
      }

      socket.broadcast.emit('global_presence', {
        type: 'leave',
        username: socket.username,
        message: `${socket.username} вышел(а) из системы`
      });

      console.log(`🔴 [WS] Отключён: ${socket.username} (${reason})`);
    });
  });
};