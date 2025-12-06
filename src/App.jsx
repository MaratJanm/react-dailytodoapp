import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';

const STORAGE_KEY = 'todo-app-tasks';
const THEME_KEY = 'todo-app-theme';

// Утилиты
const getTodayDate = () => new Date().toISOString().split('T')[0];

const daysBetween = (date1, date2) => {
  const diffTime = Math.abs(new Date(date2) - new Date(date1));
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

const findNumberInText = (text) => {
  const match = text.match(/\d+/);
  return match ? {
    number: parseInt(match[0], 10),
    start: match.index,
    end: match.index + match[0].length
  } : null;
};

const getDisplayText = (task) => {
  if (!task.isProgressive || !task.progressConfig) return task.text;
  
  const days = daysBetween(task.createdAt, getTodayDate());
  const currentNumber = task.progressConfig.originalNumber + (days * task.progressConfig.increment);
  const { start, end } = task.progressConfig.numberPosition;
  
  return task.text.substring(0, start) + currentNumber + task.text.substring(end);
};

// Загрузка задач из localStorage
const loadTasks = () => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  
  try {
    const parsed = JSON.parse(stored);
    const today = getTodayDate();
    
    return parsed.map(task => ({
      ...task,
      completed: task.lastResetDate === today ? task.completed : false,
      lastResetDate: today
    }));
  } catch (e) {
    console.error('Failed to parse tasks', e);
    return [];
  }
};

// Инициализация темы
const initTheme = () => {
  const savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme) return savedTheme;
  
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

function App() {
  const [tasks, setTasks] = useState(loadTasks);
  const [newTaskText, setNewTaskText] = useState('');
  const [isProgressive, setIsProgressive] = useState(false);
  const [increment, setIncrement] = useState(1);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [editIsProgressive, setEditIsProgressive] = useState(false);
  const [editIncrement, setEditIncrement] = useState(1);
  const [currentTheme, setCurrentTheme] = useState(initTheme);
  const fileInputRef = useRef(null);

  // Сохранение в localStorage при изменении задач
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  // Установка темы
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem(THEME_KEY, currentTheme);
  }, [currentTheme]);

  const toggleTheme = () => {
    setCurrentTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const addTask = useCallback(() => {
    const trimmed = newTaskText.trim();
    if (!trimmed) return;

    const numberInfo = findNumberInText(trimmed);
    const today = getTodayDate();

    const newTask = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      text: trimmed,
      completed: false,
      createdAt: today,
      lastResetDate: today,
      isProgressive: isProgressive && !!numberInfo,
      progressConfig: isProgressive && numberInfo ? {
        originalNumber: numberInfo.number,
        increment,
        numberPosition: { start: numberInfo.start, end: numberInfo.end }
      } : undefined
    };

    setTasks(prev => [...prev, newTask]);
    setNewTaskText('');
    setIsProgressive(false);
    setIncrement(1);
  }, [newTaskText, isProgressive, increment]);

  const toggleComplete = useCallback((id) => {
    setTasks(prev => prev.map(task => 
      task.id === id ? { ...task, completed: !task.completed } : task
    ));
  }, []);

  const deleteTask = useCallback((id) => {
    if (window.confirm('Удалить эту задачу?')) {
      setTasks(prev => prev.filter(task => task.id !== id));
    }
  }, []);

  const startEdit = useCallback((task) => {
    setEditingId(task.id);
    setEditText(task.text);
    setEditIsProgressive(task.isProgressive || false);
    setEditIncrement(task.progressConfig?.increment || 1);
  }, []);

  const saveEdit = useCallback(() => {
    const trimmed = editText.trim();
    if (!editingId || !trimmed) return;

    const numberInfo = findNumberInText(trimmed);
    const today = getTodayDate();

    setTasks(prev => prev.map(task => 
      task.id !== editingId ? task : {
        ...task,
        text: trimmed,
        createdAt: today,
        isProgressive: editIsProgressive && !!numberInfo,
        progressConfig: editIsProgressive && numberInfo ? {
          originalNumber: numberInfo.number,
          increment: editIncrement,
          numberPosition: { start: numberInfo.start, end: numberInfo.end }
        } : undefined
      }
    ));

    setEditingId(null);
    setEditText('');
  }, [editingId, editText, editIsProgressive, editIncrement]);

  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  const exportTasks = () => {
    const data = {
      version: 1,
      exportDate: new Date().toISOString(),
      tasks
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `todo-backup-${getTodayDate()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importTasks = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        
        if (data.tasks && Array.isArray(data.tasks)) {
          const confirmed = window.confirm(
            `Найдено ${data.tasks.length} задач. Заменить текущие задачи?`
          );
          
          if (confirmed) {
            const today = getTodayDate();
            const imported = data.tasks.map(task => ({
              ...task,
              completed: task.lastResetDate === today ? task.completed : false,
              lastResetDate: today
            }));
            setTasks(imported);
          }
        } else {
          alert('Неверный формат файла');
        }
      } catch (err) {
        alert('Ошибка чтения файла: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const hasNumberInNewTask = !!findNumberInText(newTaskText);
  const hasNumberInEditTask = !!findNumberInText(editText);

  return (
    <div className="container">
      <header className="header">
        <div className="header-left" />
        
        <div className="header-center">
          <h1 className="title">📋 Daily Todo</h1>
          <p className="subtitle">Ежедневные задачи автоматически обновляются каждый день</p>
        </div>
        
        <div className="header-right">
          <div className="header-controls">
            <div className="backup-buttons">
              <button onClick={exportTasks} className="backup-button" title="Экспорт">
                Экспорт
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="backup-button" title="Импорт">
                Импорт
              </button>
            </div>
            <div className="theme-switcher">
              <div className="theme-toggle-spacеr">
                <span style={{ visibility: 'hidden' }}>🌙</span>
              </div>
            </div>

            {/* Кнопка смены темы */}
            <div className="theme-switcher">
              <button
                className="theme-toggle"
                onClick={toggleTheme}
                title={`Переключить на ${currentTheme === 'dark' ? 'светлую' : 'тёмную'} тему`}
              >
                {currentTheme === 'dark' ? '☀️' : '🌙'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={importTasks}
        hidden
      />

      <div className="content">
        <div className="add-form">
          <input
            type="text"
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTask()}
            placeholder="Новая задача..."
            className="input"
          />
          
          {hasNumberInNewTask && (
            <div className="progressive-options">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={isProgressive}
                  onChange={(e) => setIsProgressive(e.target.checked)}
                  className="checkbox"
                />
                Прогрессирующая задача
              </label>
              
              {isProgressive && (
                <div className="increment-wrapper">
                  <span>Прирост в день:</span>
                  <input
                    type="number"
                    value={increment}
                    onChange={(e) => setIncrement(Number(e.target.value))}
                    className="increment-input"
                    min={1}
                  />
                </div>
              )}
            </div>
          )}
          
          <button onClick={addTask} className="add-button">
            Добавить
          </button>
        </div>

        <div className="task-list">
          {tasks.length === 0 && (
            <p className="empty-text">Нет задач. Добавьте первую!</p>
          )}
          
          {tasks.map(task => (
            <div 
              key={task.id} 
              className={`task-item ${task.completed ? 'completed' : ''}`}
              {...(editingId !== task.id && { onClick: () => toggleComplete(task.id) })}
            >
              {editingId === task.id ? (
                <div className="edit-form">
                  <input
                    type="text"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                    className="edit-input"
                    autoFocus
                  />
                  
                  {hasNumberInEditTask && (
                    <div className="progressive-options">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={editIsProgressive}
                          onChange={(e) => setEditIsProgressive(e.target.checked)}
                          className="checkbox"
                        />
                        Прогрессирующая
                      </label>
                      
                      {editIsProgressive && (
                        <div className="increment-wrapper">
                          <span>Прирост:</span>
                          <input
                            type="number"
                            value={editIncrement}
                            onChange={(e) => setEditIncrement(Number(e.target.value))}
                            className="increment-input"
                            min={1}
                          />
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="edit-buttons">
                    <button onClick={saveEdit} className="action-button save" title="Сохранить">
                      💾
                    </button>
                    <button onClick={cancelEdit} className="action-button cancel" title="Отмена">
                      ✕
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="task-content">
                    <span className={`task-text ${task.completed ? 'completed' : ''}`}>
                      {getDisplayText(task)}
                    </span>
                    
                    {task.isProgressive && (
                      <span className="progress-badge">
                        📈 +{task.progressConfig?.increment}/день
                      </span>
                    )}
                    
                    {task.completed && <span className="checkmark">✓</span>}
                  </div>
                  
                  <div className="task-actions">
                    <button 
                      onClick={(e) => { e.stopPropagation(); startEdit(task); }} 
                      className="action-button edit" 
                      title="Редактировать"
                    >
                      ✏️
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }} 
                      className="action-button delete" 
                      title="Удалить"
                    >
                      🗑️
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        <footer className="footer">
          <big>Данные хранятся только в вашем браузере</big>
        </footer>
      </div>
    </div>
  );
}

export default App;