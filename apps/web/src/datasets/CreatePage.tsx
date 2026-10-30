// apps/web/src/datasets/CreatePage.tsx
import { useState, FormEvent, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

type Task = 'detect' | 'obb' | 'segment';

export const CreatePage = () => {
  const navigate = useNavigate();
  fileInputRef: useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [task, setTask] = useState<Task>('detect');
  const [isPrivate, setIsPrivate] = useState(true);
  const [manualClasses, setManualClasses] = useState('');
  const [inputMode, setInputMode] = useState<'manual' | 'yaml'>('manual');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Введите название датасета');
      return;
    }

    const token = localStorage.getItem('access_token');
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('task', task);
      formData.append('is_private', String(isPrivate));

      if (inputMode === 'manual') {
        const parsedClasses = manualClasses.split('\n').map(c => c.trim()).filter(Boolean);
        parsedClasses.forEach((cls) => formData.append('classes', cls));
      }

      if (fileInputRef.current?.files?.[0]) {
        formData.append('file', fileInputRef.current.files[0]);
      }

      // Используем универсальный эндпоинт upload для создания и сохранения файлов
      const endpoint = fileInputRef.current?.files?.[0] ? 'http://localhost:8000/api/datasets/upload' : 'http://localhost:8000/api/datasets/';
      
      const res = fileInputRef.current?.files?.[0] 
        ? await axios.post(endpoint, formData, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } })
        : await axios.post(endpoint, { name, task, is_private: isPrivate, classes: manualClasses.split('\n').map(c => c.trim()).filter(Boolean) }, { headers: { Authorization: `Bearer ${token}` } });

      const datasetId = res.data.dataset_id;
      navigate(`/datasets/${datasetId}/gallery`);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка создания датасета');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="create-page">
      <Link to="/" className="page-back">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6M9 12h12" /></svg>
        Назад к списку
      </Link>
      <header className="page-heading page-heading--stacked">
        <h1>Создать датасет</h1>
        <p>Задайте параметры нового проекта разметки</p>
      </header>

      <form onSubmit={handleSubmit} className="form-surface create-form">
        {error && <div className="form-alert" role="alert">{error}</div>}

        <div className="form-field">
          <label className="form-label" htmlFor="dataset-name">Название</label>
          <input
            id="dataset-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например, cats-and-dogs"
            required
            className="form-input"
          />
        </div>

        <div className="form-section">
          <span className="form-section__title">Тип задачи</span>
          <div className="task-choice-grid" role="group">
            {(['detect', 'obb', 'segment'] as Task[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTask(t)}
                className={task === t ? 'task-choice is-active' : 'task-choice'}
              >
                <strong>{t}</strong>
              </button>
            ))}
          </div>
        </div>

        <div className="form-section">
          <span className="form-section__title">Архив датасета (ZIP) или YAML</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,.yaml,.yml"
            className="form-input"
          />
        </div>

        <div className="form-actions">
          <button type="button" onClick={() => navigate('/')} className="button button--outline">Отмена</button>
          <button type="submit" disabled={isLoading} className="button button--primary">
            {isLoading ? 'Создание...' : 'Создать датасет'}
          </button>
        </div>
      </form>
    </section>
  );
};