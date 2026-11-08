import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

type Task = 'detect' | 'obb' | 'segment';

type TaskOption = {
  value: Task;
  label: string;
  description: string;
  icon: ReactNode;
};

const taskOptions: TaskOption[] = [
  {
    value: 'detect',
    label: 'Bounding Box',
    description: 'Обычные прямоугольные рамки вокруг объектов',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M4 9h16M9 5v14" /></svg>
    ),
  },
  {
    value: 'obb',
    label: 'OBB',
    description: 'Рамки с поворотом под угол объекта',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5h8l3 3v8l-3 3H8l-3-3V8z" /><path d="M12 5v14M5 12h14" /></svg>
    ),
  },
  {
    value: 'segment',
    label: 'Polygon',
    description: 'Точный контур объекта по точкам',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 8 4-3 5 2 4 4-2 5-5 3-6-1-2-5 2-5Z" /></svg>
    ),
  },
];

export const CreatePage = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('cats-and-dogs');
  const [task, setTask] = useState<Task>('detect');
  const [isPrivate, setIsPrivate] = useState(true);
  const [manualClasses, setManualClasses] = useState('cat\ndog\nbird');
  const [inputMode, setInputMode] = useState<'manual' | 'zip'>('manual');
  const [selectedFileName, setSelectedFileName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFinished, setUploadFinished] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Введите название датасета');
      return;
    }

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError('Загрузите ZIP-архив со всем датасетом');
      return;
    }
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setError('Поддерживаются только ZIP-архивы');
      return;
    }

    setIsLoading(true);
    setUploadProgress(0);
    setUploadFinished(false);
    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('task', task);
      formData.append('is_private', String(isPrivate));
      formData.append('file', file);

      const token = localStorage.getItem('access_token');
      const response = await axios.post('http://localhost:8000/api/datasets/upload', formData, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        onUploadProgress: (progressEvent) => {
          if (!progressEvent.total) return;
          const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
          setUploadProgress(progress);
          setUploadFinished(progress >= 100);
        },
      });

      const datasetId = response.data.dataset_id ?? response.data.id;
      navigate(`/datasets/${datasetId}/gallery`);
    } catch (err) {
      const detail = axios.isAxiosError(err) ? err.response?.data?.detail : null;
      setError(typeof detail === 'string' ? detail : 'Ошибка создания датасета');
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
            onChange={(event) => setName(event.target.value)}
            placeholder="Например, cats-and-dogs"
            className="form-input"
          />
        </div>

        <div className="form-section">
          <span className="form-section__title">Тип задачи</span>
          <div className="task-choice-grid" role="group" aria-label="Тип задачи">
            {taskOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={task === option.value ? 'task-choice is-active' : 'task-choice'}
                onClick={() => setTask(option.value)}
              >
                <span className="task-choice__top">
                  <span className="task-choice__icon">{option.icon}</span>
                  <span className="task-choice__radio" aria-hidden="true" />
                </span>
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </button>
            ))}
          </div>
        </div>

        <label className="privacy-option" htmlFor="dataset-private">
          <input
            id="dataset-private"
            type="checkbox"
            checked={isPrivate}
            onChange={(event) => setIsPrivate(event.target.checked)}
          />
          <span>
            <strong>Приватный датасет</strong>
            <small>Доступ только уполномоченным участникам</small>
          </span>
          <span className="privacy-option__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M7 11V7.5A5 5 0 0 1 12 2.5a5 5 0 0 1 5 5V11M5 11h14v10H5z" /></svg>
          </span>
        </label>

        <div className="form-section">
          <div className="class-section__heading">
            <span className="form-section__title">Классы объектов</span>
            <div className="form-mode" role="tablist" aria-label="Источник классов">
              <button
                type="button"
                className={inputMode === 'manual' ? 'form-mode__button is-active' : 'form-mode__button'}
                onClick={() => setInputMode('manual')}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h16M4 12h12M4 16h8" /></svg>
                Ввести вручную
              </button>
              <button
                type="button"
                className={inputMode === 'zip' ? 'form-mode__button is-active' : 'form-mode__button'}
                onClick={() => setInputMode('zip')}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 19h14" /></svg>
                Загрузить .zip
              </button>
            </div>
          </div>

          {inputMode === 'manual' ? (
            <textarea
              className="form-textarea"
              value={manualClasses}
              onChange={(event) => setManualClasses(event.target.value)}
              aria-label="Классы объектов"
            />
          ) : (
            <label className="yaml-upload" htmlFor="dataset-zip-upload">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 19h14" /></svg>
              {selectedFileName || 'Загрузить .zip'}
              <input
                id="dataset-zip-upload"
                ref={fileInputRef}
                type="file"
                accept=".zip,application/zip"
                className="file-input-hidden"
                onChange={(event) => {
                  setSelectedFileName(event.target.files?.[0]?.name ?? '');
                  setError('');
                }}
              />
            </label>
          )}

          <div className="form-hint">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v5m0 3h.01" /></svg>
            {inputMode === 'manual'
              ? 'По одному классу на строку. Порядок — индекс в YOLO. Для загрузки выберите ZIP-архив.'
              : 'Загрузите ZIP со всем датасетом, включая конфигурацию, изображения и разметку.'}
          </div>
        </div>

        <div className="form-actions">
          <button type="button" onClick={() => navigate('/')} className="button button--outline">Отмена</button>
          <button type="submit" disabled={isLoading} className="button button--primary">
            {isLoading ? 'Создание...' : 'Создать датасет'}
          </button>
        </div>
        {isLoading && (
          <p className="form-hint" role="status" aria-live="polite">
            {uploadFinished
              ? 'ZIP загружен. Импортируем кадры и создаём превью; большой датасет может обрабатываться несколько минут.'
              : `Загрузка ZIP: ${uploadProgress}%`}
          </p>
        )}
      </form>
    </section>
  );
};
