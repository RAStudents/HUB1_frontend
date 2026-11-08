// apps/web/src/datasets/ListPage.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getRole } from '../auth/roles';
import { downloadDatasetExport } from '../api/exports';
import { Dataset } from '../api/types';

export const ListPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'my' | 'shared'>('my');
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [exportingDatasetId, setExportingDatasetId] = useState<string | null>(null);

  const loadDatasets = async () => {
    setIsLoading(true);
    try {
      // TODO: заменить на реальные эндпоинты
      // const endpoint = activeTab === 'my' ? '/datasets/my' : '/datasets/shared';
      // const res = await apiClient.get<Dataset[]>(endpoint);
      // setDatasets(res.data);

      // Заглушка — тестовые данные с разными ролями
      setDatasets([
        {
          id: '1',
          name: 'Cats and Dogs',
          task: 'detect',
          is_private: true,
          samples_count: 150,
          is_owner: true,
          my_role: 'owner',
        },
        {
          id: '2',
          name: 'Traffic Signs',
          task: 'detect',
          is_private: false,
          samples_count: 89,
          is_owner: false,
          my_role: 'labeler',
        },
        {
          id: '3',
          name: 'Public Dataset',
          task: 'segment',
          is_private: false,
          samples_count: 42,
          is_owner: false,
          my_role: 'observer',
        },
      ]);
    } catch (err) {
      console.error('Ошибка загрузки датасетов:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDatasets();
  }, [activeTab]);

  const taskLabels: Record<string, string> = {
    detect: 'Bounding Box',
    obb: 'OBB (повёрнутые)',
    segment: 'Polygon',
  };

  const exportDataset = async (
    event: React.MouseEvent<HTMLButtonElement>,
    datasetId: string,
    datasetName: string,
  ) => {
    event.stopPropagation();
    setExportingDatasetId(datasetId);
    try {
      const exportedSamples = await downloadDatasetExport(datasetId, datasetName);
      window.alert(
        exportedSamples
          ? `Экспортировано кадров: ${exportedSamples}`
          : 'В датасете нет принятых кадров для экспорта.',
      );
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Не удалось экспортировать датасет.');
    } finally {
      setExportingDatasetId(null);
    }
  };

  return (
    <div>
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">
            Привет, {user?.display_name || 'Пользователь'}!
          </h1>
          <p className="text-gray-500 mt-1">Управление датасетами для разметки</p>
        </div>
        <button
          onClick={() => navigate('/datasets/create')}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-medium"
        >
          + Создать датасет
        </button>
      </header>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Табы */}
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('my')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'my'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Мои датасеты
            </button>
            <button
              onClick={() => setActiveTab('shared')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'shared'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Доступные мне
            </button>
          </nav>
        </div>

        {/* Контент */}
        <div className="p-6">
          {isLoading ? (
            <div className="text-center py-12 text-gray-500">Загрузка...</div>
          ) : datasets.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                {activeTab === 'my'
                  ? 'У вас пока нет датасетов'
                  : 'Вам пока не доступны чужие датасеты'}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {activeTab === 'my'
                  ? 'Создайте первый датасет, чтобы начать загрузку и разметку.'
                  : 'Попросите владельца датасета пригласить вас по email.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {datasets.map((dataset) => {
                const { isOwner, canExport } = getRole(dataset.my_role);
                return (
                  <div
                    key={dataset.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition cursor-pointer"
                    onClick={() => navigate(`/datasets/${dataset.id}`)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-gray-800 text-lg">
                        {dataset.name}
                      </h3>
                      {dataset.is_private && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                          Приватный
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 text-sm text-gray-600">
                      <div className="flex justify-between">
                        <span>Тип задачи:</span>
                        <span className="font-medium">
                          {taskLabels[dataset.task] || dataset.task}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Кадры:</span>
                        <span className="font-medium">{dataset.samples_count}</span>
                      </div>
                      {dataset.my_role && (
                        <div className="flex justify-between">
                          <span>Ваша роль:</span>
                          <span className="font-medium capitalize">
                            {dataset.my_role === 'owner' && 'Владелец'}
                            {dataset.my_role === 'labeler' && 'Разметчик'}
                            {dataset.my_role === 'observer' && 'Наблюдатель'}
                          </span>
                        </div>
                      )}
                    </div>

                    {isOwner && (
                      <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/datasets/${dataset.id}/members`);
                          }}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          Участники →
                        </button>
                        {canExport && (
                          <button
                            onClick={(event) => exportDataset(event, dataset.id, dataset.name)}
                            disabled={exportingDatasetId === dataset.id}
                            className="text-sm text-green-600 hover:underline"
                          >
                            {exportingDatasetId === dataset.id ? 'Экспортируем...' : 'Экспорт ↓'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};