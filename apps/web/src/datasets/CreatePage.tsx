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
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link to="/" className="text-blue-600 hover:underline text-sm">← Назад к списку</Link>
        <h1 className="text-3xl font-bold text-gray-800 mt-2">Создать датасет</h1>
        <p className="text-gray-500 mt-1">Задайте параметры нового проекта разметки</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 space-y-6">
        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded text-sm">{error}</div>
        )}

        {/* Название */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Название</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например, cats-and-dogs"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Тип задачи */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Тип задачи</label>
          <div className="grid grid-cols-3 gap-3">
            {(['detect', 'obb', 'segment'] as Task[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTask(t)}
                className={`px-4 py-3 rounded-md border-2 text-sm font-medium transition ${
                  task === t
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {t === 'detect' && ' Bounding Box'}
                {t === 'obb' && '🔄 OBB (повёрнутые)'}
                {t === 'segment' && '🔷 Polygon'}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {task === 'detect' && 'Обычные прямоугольные рамки вокруг объектов'}
            {task === 'obb' && 'Повёрнутые рамки для объектов под углом'}
            {task === 'segment' && 'Точные контуры объектов (полигоны)'}
          </p>
        </div>

        {/* Приватность */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="private"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded"
          />
          <label htmlFor="private" className="text-sm text-gray-700">
            Приватный датасет (доступ только у приглашённых)
          </label>
        </div>

        {/* Классы */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Классы объектов</label>
          
          {/* Переключатель режима */}
          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() => setInputMode('manual')}
              className={`px-3 py-1 rounded text-sm ${inputMode === 'manual' ? 'bg-blue-100 text-blue-700' : 'text-gray-600'}`}
            >
              Ввести вручную
            </button>
            <button
              type="button"
              onClick={() => setInputMode('yaml')}
              className={`px-3 py-1 rounded text-sm ${inputMode === 'yaml' ? 'bg-blue-100 text-blue-700' : 'text-gray-600'}`}
            >
              Загрузить data.yaml
            </button>
          </div>

          {inputMode === 'manual' ? (
            <div>
              <textarea
                value={manualClasses}
                onChange={(e) => setManualClasses(e.target.value)}
                placeholder={"cat\ndog\nbird"}
                rows={5}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">По одному классу на строку. Порядок = индекс в YOLO.</p>
            </div>
          ) : (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".yaml,.yml"
                onChange={handleYamlUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
              >
                📄 Выбрать файл data.yaml
              </button>
              {yamlContent && (
                <pre className="mt-3 p-3 bg-gray-50 rounded text-xs overflow-auto max-h-40 border">
                  {yamlContent}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Кнопки */}
        <div className="flex gap-3 pt-4 border-t">
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 font-medium disabled:opacity-50"
          >
            {isLoading ? 'Создание...' : 'Создать датасет'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
};