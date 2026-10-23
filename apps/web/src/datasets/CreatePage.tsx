// apps/web/src/datasets/CreatePage.tsx
import { useState, FormEvent, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';

type Task = 'detect' | 'obb' | 'segment';

export const CreatePage = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [task, setTask] = useState<Task>('detect');
  const [isPrivate, setIsPrivate] = useState(true);
  const [yamlContent, setYamlContent] = useState('');
  const [manualClasses, setManualClasses] = useState(''); // по одному классу на строку
  const [inputMode, setInputMode] = useState<'manual' | 'yaml'>('manual');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Введите название датасета');
      return;
    }

    setIsLoading(true);
    try {
      // TODO: здесь будет запрос к API /datasets
      // const res = await apiClient.post('/datasets', {
      //   name, task, is_private: isPrivate,
      //   yaml: inputMode === 'yaml' ? yamlContent : undefined,
      //   classes: inputMode === 'manual' ? manualClasses.split('\n').filter(Boolean) : undefined,
      // });
      // navigate(`/datasets/${res.data.id}`);

      // Заглушка, пока бэкенд не готов:
      console.log('Создание датасета:', { name, task, isPrivate, inputMode });
      alert('Датасет создан (заглушка — бэкенд еще не подключен)');
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка создания датасета');
    } finally {
      setIsLoading(false);
    }
  };

  const handleYamlUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setYamlContent(ev.target?.result as string);
    reader.readAsText(file);
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
        {error && (
          <div className="form-alert" role="alert">{error}</div>
        )}

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
          <div className="task-choice-grid" role="group" aria-label="Тип задачи">
            {(['detect', 'obb', 'segment'] as Task[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTask(t)}
                className={task === t ? 'task-choice is-active' : 'task-choice'}
                aria-pressed={task === t}
              >
                <span className="task-choice__top">
                  <span className="task-choice__icon">
                    {t === 'detect' && <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="1" /></svg>}
                    {t === 'obb' && <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 9 9-9 9-9-9z" /></svg>}
                    {t === 'segment' && <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 9 5v8l-9 5-9-5V8z" /></svg>}
                  </span>
                  <span className="task-choice__radio" />
                </span>
                <strong>{t === 'detect' ? 'Bounding Box' : t === 'obb' ? 'OBB (повёрнутые)' : 'Polygon'}</strong>
                <small>{t === 'detect' ? 'Обычные прямоугольные рамки вокруг объектов' : t === 'obb' ? 'Рамки с поворотом под угол объекта' : 'Точный контур объекта по точкам'}</small>
              </button>
            ))}
          </div>
        </div>

        <label className="privacy-option" htmlFor="private">
          <input
            type="checkbox"
            id="private"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
          />
          <span>
            <strong>Приватный датасет</strong>
            <small>Доступ только у приглашённых участников</small>
          </span>
        </label>

        <div className="form-section">
          <div className="class-section__heading">
            <span className="form-section__title">Классы объектов</span>
            <div className="form-mode" role="tablist" aria-label="Способ задания классов">
            <button
              type="button"
              onClick={() => setInputMode('manual')}
              className={inputMode === 'manual' ? 'form-mode__button is-active' : 'form-mode__button'}
              role="tab"
              aria-selected={inputMode === 'manual'}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6 4 4M4 20l4-1 11-11-3-3L5 16zM4 20h16" /></svg>
              Ввести вручную
            </button>
            <button
              type="button"
              onClick={() => setInputMode('yaml')}
              className={inputMode === 'yaml' ? 'form-mode__button is-active' : 'form-mode__button'}
              role="tab"
              aria-selected={inputMode === 'yaml'}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m-4 4 4-4 4 4M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" /></svg>
              Загрузить data.yaml
            </button>
          </div>
          </div>

          {inputMode === 'manual' ? (
            <div>
              <textarea
                value={manualClasses}
                onChange={(e) => setManualClasses(e.target.value)}
                placeholder={"cat\ndog\nbird"}
                rows={5}
                aria-label="Классы, по одному на строку"
                className="form-textarea"
              />
              <p className="form-hint"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></svg>По одному классу на строку. Порядок = индекс в YOLO.</p>
            </div>
          ) : (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".yaml,.yml"
                onChange={handleYamlUpload}
                className="file-input-hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="yaml-upload"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m-4 4 4-4 4 4M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" /></svg>
                Выбрать файл data.yaml
              </button>
              {yamlContent && (
                <pre className="yaml-preview">
                  {yamlContent}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Кнопки */}
        <div className="form-actions">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="button button--outline"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="button button--primary"
          >
            {isLoading ? 'Создание...' : 'Создать датасет'}
          </button>
        </div>
      </form>
    </section>
  );
};