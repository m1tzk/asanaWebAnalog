# Используем легковесный LTS-образ Node.js на базе Alpine Linux
FROM node:20-alpine

# Рабочая директория внутри контейнера
WORKDIR /app

# Копируем файлы зависимостей отдельно для кэширования слоя npm ci
COPY package*.json ./

# Устанавливаем только production-зависимости
RUN npm ci --omit=dev

# Копируем исходный код сервера (server.js, models/, routes/, socket/)
COPY . .

# Создаём директорию для логов (точка монтирования volume)
RUN mkdir -p /app/logs

# Документируем порт, который слушает Express и Socket.IO
EXPOSE 3000

# Команда запуска сервера
CMD ["node", "server.js"]