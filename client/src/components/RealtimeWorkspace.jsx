import React, { useEffect, useRef, useState } from 'react';

const ROOMS = ['general', 'sprint-planning', 'frontend', 'backend'];

export function RealtimeWorkspace({ socket, isWsConnected, username }) {
  const [room, setRoom] = useState('general');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [typingUsers, setTypingUsers] = useState([]);

  // Состояние для опросов в реальном времени
  const [polls, setPolls] = useState([]);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);

  const typingTimeoutRef = useRef(null);
  const chatEndRef = useRef(null);

  const joinRoom = (targetRoom) => {
    if (!socket || !isWsConnected) return;
    setRoom(targetRoom);
    setTypingUsers([]);

    socket.emit('join_room', targetRoom, (res) => {
      if (res?.status === 'ok') {
        setMessages(res.history || []);
        setPolls(res.polls || []);
      }
    });
  };

  useEffect(() => {
    if (!socket || !isWsConnected) return;

    joinRoom(room);

    const onRoomUsers = (users) => setOnlineUsers(users);

    const onChatMessage = (msg) => {
      setMessages((prev) => [...prev, { ...msg, isSystem: false }]);
    };

    const onSystemNotification = (notif) => {
      setMessages((prev) => [
        ...prev,
        {
          _id: `${Date.now()}-${Math.random()}`,
          text: notif.text,
          createdAt: notif.createdAt,
          isSystem: true
        }
      ]);
    };

    const onUserTyping = ({ username: typingUser, isTyping }) => {
      setTypingUsers((prev) => {
        if (isTyping) {
          return prev.includes(typingUser) ? prev : [...prev, typingUser];
        }
        return prev.filter((u) => u !== typingUser);
      });
    };

    const onPollCreated = (newPoll) => {
      setPolls((prev) => [newPoll, ...prev]);
    };

    const onPollUpdated = (updatedPoll) => {
      setPolls((prev) =>
        prev.map((p) => (p._id === updatedPoll._id ? updatedPoll : p))
      );
    };

    socket.on('room_users', onRoomUsers);
    socket.on('chat_message', onChatMessage);
    socket.on('system_notification', onSystemNotification);
    socket.on('user_typing', onUserTyping);
    socket.on('poll_created', onPollCreated);
    socket.on('poll_updated', onPollUpdated);

    return () => {
      socket.off('room_users', onRoomUsers);
      socket.off('chat_message', onChatMessage);
      socket.off('system_notification', onSystemNotification);
      socket.off('user_typing', onUserTyping);
      socket.off('poll_created', onPollCreated);
      socket.off('poll_updated', onPollUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, isWsConnected]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!text.trim() || !socket) return;

    socket.emit('chat_message', { room, text }, (ack) => {
      if (ack?.status === 'ok') {
        setText('');
        socket.emit('typing', { room, isTyping: false });
      }
    });
  };

  const handleTypingChange = (e) => {
    setText(e.target.value);
    if (!socket) return;

    socket.emit('typing', { room, isTyping: true });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing', { room, isTyping: false });
    }, 1500);
  };

  const handleCreatePoll = (e) => {
    e.preventDefault();
    const validOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
    if (!pollQuestion.trim() || validOptions.length < 2 || !socket) return;

    socket.emit(
      'create_poll',
      { room, question: pollQuestion, options: validOptions },
      (ack) => {
        if (ack?.status === 'ok') {
          setPollQuestion('');
          setPollOptions(['', '']);
        }
      }
    );
  };

  const handleVote = (pollId, optionId) => {
    socket?.emit('vote_poll', { pollId, optionId });
  };

  if (!isWsConnected) {
    return (
      <div className="card error-state">
        <h3>WebSocket не подключён</h3>
        <p>Укажите имя участника в шапке страницы и нажмите «Подключиться».</p>
      </div>
    );
  }

  return (
    <div className="ws-workspace-grid">
      {/* Левая колонка: Комнаты и список онлайн */}
      <aside className="card ws-sidebar">
        <h3 className="section-title">📂 Каналы проекта</h3>
        <div className="ws-rooms-list">
          {ROOMS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => joinRoom(r)}
              className={`ws-room-btn ${room === r ? 'ws-room-btn-active' : ''}`}
            >
              # {r}
            </button>
          ))}
        </div>

        <h4 className="ws-users-title">👥 В комнате ({onlineUsers.length})</h4>
        <ul className="ws-users-list">
          {onlineUsers.map((u) => (
            <li key={u}>
              <span className="ws-dot-online" /> {u} {u === username ? '(вы)' : ''}
            </li>
          ))}
        </ul>
      </aside>

      {/* Центр: Чат комнаты */}
      <section className="card ws-chat-panel">
        <div className="ws-chat-header">
          <strong>💬 Канал #{room}</strong>
          <span className="ws-status-badge">● WebSocket активен</span>
        </div>

        <div className="ws-messages-box">
          {messages.map((m) =>
            m.isSystem ? (
              <div key={m._id} className="ws-system-msg">
                {m.text}
              </div>
            ) : (
              <div
                key={m._id}
                className={`ws-msg-item ${m.sender === username ? 'ws-msg-own' : ''}`}
              >
                <div className="ws-msg-meta">
                  <strong>{m.sender}</strong>
                  <span>{new Date(m.createdAt).toLocaleTimeString()}</span>
                </div>
                <div className="ws-msg-text">{m.text}</div>
              </div>
            )
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="ws-typing-indicator">
          {typingUsers.length > 0 && `${typingUsers.join(', ')} печатает...`}
        </div>

        <form onSubmit={handleSendMessage} className="ws-chat-form">
          <input
            type="text"
            className="form-input"
            value={text}
            onChange={handleTypingChange}
            placeholder={`Написать сообщение в #${room}...`}
          />
          <button type="submit" className="btn btn-primary">
            Отправить
          </button>
        </form>
      </section>

      {/* Правая колонка: Голосования / опросы в реальном времени */}
      <aside className="card ws-polls-panel">
        <h3 className="section-title">📊 Опросы в реальном времени</h3>

        <form onSubmit={handleCreatePoll} className="ws-poll-form">
          <input
            type="text"
            className="form-input"
            placeholder="Вопрос команде (напр., приоритет фичи)"
            value={pollQuestion}
            onChange={(e) => setPollQuestion(e.target.value)}
          />
          {pollOptions.map((opt, idx) => (
            <input
              key={idx}
              type="text"
              className="form-input"
              placeholder={`Вариант ${idx + 1}`}
              value={opt}
              onChange={(e) => {
                const updated = [...pollOptions];
                updated[idx] = e.target.value;
                setPollOptions(updated);
              }}
            />
          ))}
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setPollOptions([...pollOptions, ''])}
            >
              + Вариант
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Запустить опрос
            </button>
          </div>
        </form>

        <div className="ws-polls-list">
          {polls.length === 0 && (
            <p className="ws-empty-polls">В этом канале пока нет опросов.</p>
          )}
          {polls.map((poll) => {
            const totalVotes = poll.options.reduce((sum, o) => sum + o.votes, 0);
            return (
              <div key={poll._id} className="ws-poll-card">
                <div className="ws-poll-question">{poll.question}</div>
                <div className="ws-poll-author">
                  Автор: {poll.createdBy} · Всего голосов: {totalVotes}
                </div>
                {poll.options.map((opt) => {
                  const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
                  const votedByMe = opt.voters.includes(username);
                  return (
                    <button
                      key={opt._id}
                      type="button"
                      onClick={() => handleVote(poll._id, opt._id)}
                      className={`ws-poll-option ${votedByMe ? 'ws-poll-option-voted' : ''}`}
                    >
                      <div className="ws-poll-option-bar" style={{ width: `${pct}%` }} />
                      <span className="ws-poll-option-label">
                        {opt.text} — <strong>{opt.votes}</strong> ({pct}%)
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}