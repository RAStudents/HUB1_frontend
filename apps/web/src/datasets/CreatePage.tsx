import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { apiClient } from '../api/client';

type Task = 'detect' | 'obb' | 'segment';
const MAX_DATASET_BYTES = 5 * 1024 * 1024 * 1024;

type TaskOption = {
  value: Task;
  label: string;
  description: string;
  icon: ReactNode;
};

interface ImportJob {
  import_id: number;
  dataset_id: string | null;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  stage: 'queued' | 'processing' | 'extracting' | 'normalizing' | 'copying'
    | 'discovering' | 'importing' | 'finalizing' | 'building_gallery' | 'completed' | 'failed';
  progress: number;
  total_samples: number;
  processed_samples: number;
  imported_samples: number;
  parse_errors: number;
  error?: string | null;
}

const importStageLabels: Record<ImportJob['stage'], string> = {
  queued: 'Импорт ожидает обработки…',
  processing: 'Подготавливаем импорт…',
  extracting: 'Распаковываем архив…',
  normalizing: 'Подготавливаем изображения…',
  copying: 'Копируем файлы датасета…',
  discovering: 'Проверяем структуру и кадры…',
  importing: 'Импортируем кадры и разметку…',
  finalizing: 'Завершаем импорт…',
  building_gallery: 'Создаём галерею…',
  completed: 'Импорт завершён',
  failed: 'Ошибка импорта',
};

const wait = (milliseconds: number) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

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

  const [name, setName] = useState('');
  const [task, setTask] = useState<Task>('detect');
  const [isPrivate, setIsPrivate] = useState(true);
  const [manualClasses, setManualClasses] = useState('cat\ndog\nbird');
  const [inputMode, setInputMode] = useState<'manual' | 'zip'>('manual');
  const [selectedFileName, setSelectedFileName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFinished, setUploadFinished] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportJob | null>(null);

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
    if (file.size > MAX_DATASET_BYTES) {
      setError('Размер ZIP-архива не должен превышать 5 ГиБ');
      return;
    }

    setIsLoading(true);
    setUploadProgress(0);
    setUploadFinished(false);
    setImportProgress(null);
    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('task', task);
      formData.append('is_private', String(isPrivate));
      formData.append('file', file);

      const response = await apiClient.post<ImportJob>('/datasets/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (!progressEvent.total) return;
          const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
          setUploadProgress(progress);
          setUploadFinished(progress >= 100);
        },
      });

      setUploadFinished(true);
      let importJob = response.data;
      setImportProgress(importJob);

      while (importJob.status === 'queued' || importJob.status === 'processing') {
        await wait(1000);
        const { data } = await apiClient.get<ImportJob>(`/datasets/imports/${importJob.import_id}`);
        importJob = data;
        setImportProgress(importJob);
      }

      if (importJob.status === 'failed') {
        throw new Error(importJob.error || 'Не удалось импортировать датасет.');
      }
      if (importJob.dataset_id === null) {
        throw new Error('Импорт завершён, но сервер не вернул идентификатор датасета.');
      }
      navigate(`/datasets/${importJob.dataset_id}/gallery`);
    } catch (err) {
      const detail = axios.isAxiosError(err) ? err.response?.data?.detail : null;
      setError(
        typeof detail === 'string'
          ? detail
          : err instanceof Error
            ? err.message
            : 'Ошибка создания датасета',
      );
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
            placeholder="Название появится из имени ZIP-архива"
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
                  const fileName = event.target.files?.[0]?.name ?? '';
                  setSelectedFileName(fileName);
                  if (fileName.toLowerCase().endsWith('.zip')) {
                    setName(fileName.slice(0, -4));
                  }
                  setError('');
                }}
              />
            </label>
          )}

          <div className="form-hint">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v5m0 3h.01" /></svg>
            {inputMode === 'manual'
              ? 'По одному классу на строку. Порядок — индекс в YOLO. Для загрузки выберите ZIP-архив.'
              : 'Загрузите ZIP со всем датасетом, включая конфигурацию, изображения и разметку. Максимум 5 ГиБ для архива и распакованных файлов.'}
          </div>
        </div>

        <div className="form-actions">
          <button type="button" onClick={() => navigate('/')} className="button button--outline">Отмена</button>
          <button type="submit" disabled={isLoading} className="button button--primary">
            {isLoading ? 'Создание...' : 'Создать датасет'}
          </button>
        </div>
        {isLoading && (
          <div className="import-progress" role="status" aria-live="polite">
            <div className="import-progress__summary">
              <span>
                {!uploadFinished
                  ? `Загрузка ZIP: ${uploadProgress}%`
                  : importProgress
                    ? importStageLabels[importProgress.stage]
                    : 'Запускаем импорт…'}
              </span>
              <strong>{uploadFinished ? importProgress?.progress ?? 0 : uploadProgress}%</strong>
            </div>
            <div
              aria-label="Прогресс импорта датасета"
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={uploadFinished ? importProgress?.progress ?? 0 : uploadProgress}
              className="import-progress__track"
              role="progressbar"
            >
              <span
                style={{
                  width: `${uploadFinished ? importProgress?.progress ?? 0 : uploadProgress}%`,
                }}
              />
            </div>
            {uploadFinished && importProgress && importProgress.total_samples > 0 && (
              <span className="import-progress__details">
                Обработано {importProgress.processed_samples} из {importProgress.total_samples} кадров
                {importProgress.parse_errors > 0 && ` · ошибок разметки: ${importProgress.parse_errors}`}
              </span>
            )}
          </div>
        )}
      </form>
    </section>
  );
};
