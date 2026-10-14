import { useState, useEffect } from 'react';

/**
 * Кастомный хук для синхронизации локального состояния с LocalStorage
 * @param {string} key - Ключ в хранилище LocalStorage
 * @param {any} initialValue - Значение по умолчанию, если ключ пуст
 */
export function useLocalStorage(key, initialValue) {
  // 1. Ленивая инициализация состояния (выполняется строго 1 раз при монтировании)
  const [value, setValue] = useState(() => {
    try {
      const storedItem = localStorage.getItem(key);
      if (storedItem !== null) {
        return JSON.parse(storedItem);
      }
      // Если передана функция инициализации — вызываем ее, иначе берем значение
      return typeof initialValue === 'function' ? initialValue() : initialValue;
    } catch (error) {
      console.error(`Ошибка чтения LocalStorage по ключу "${key}":`, error);
      return typeof initialValue === 'function' ? initialValue() : initialValue;
    }
  });

  // 2. Эффект сохранения: записывает данные при каждом изменении ключа или значения
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Ошибка записи в LocalStorage по ключу "${key}":`, error);
    }
  }, [key, value]);

  return [value, setValue];
}