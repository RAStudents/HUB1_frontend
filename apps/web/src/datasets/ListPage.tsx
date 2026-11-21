// apps/web/src/datasets/ListPage.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getRole } from '../auth/roles';
import { downloadDatasetExport, getExportProgressLabel } from '../api/exports';
import type { ExportProgress } from '../api/exports';
import { Dataset } from '../api/types';

export const ListPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'my' | 'shared'>('my');
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [exportingDatasetId, setExportingDatasetId] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
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
      const exportedSamples = await downloadDatasetExport(
        datasetId,
        datasetName,
        setExportProgress,
      );
      window.alert(
        exportedSamples
          ? `Экспортировано кадров: ${exportedSamples}`
          : 'В датасете нет принятых кадров для экспорта.',
      );
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Не удалось экспортировать датасет.');
    } finally {
      setExportingDatasetId(null);
      setExportProgress(null);
    }
  };

  return (
    <div>
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-[var(--app-text)]">
            Привет, {user?.display_name || 'Пользователь'}!
          </h1>
          <p className="text-[var(--app-muted)] mt-1">Управление датасетами для разметки</p>
        </div>
        <button
          onClick={() => navigate('/datasets/create')}
          className="bg-[var(--app-button-fill)] text-[var(--app-button-text)] px-4 py-2 rounded-md hover:underline font-medium"
        >
          Создать датасет
        </button>
      </header>

      <div className="bg-[var(--app-surface)] rounded-lg shadow-sm border border-[var(--app-line)]">
        {/* Табы */}
        <div className="border-b border-[var(--app-line)]">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('my')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'my'
                  ? 'border-[var(--app-accent)] text-[var(--app-accent-text)]'
                  : 'border-transparent text-[var(--app-muted)] hover:text-[var(--app-text-secondary)]'
              }`}
            >
              Мои датасеты
            </button>
            <button
              onClick={() => setActiveTab('shared')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'shared'
                  ? 'border-[var(--app-accent)] text-[var(--app-accent-text)]'
                  : 'border-transparent text-[var(--app-muted)] hover:text-[var(--app-text-secondary)]'
              }`}
            >
              Доступные мне
            </button>
          </nav>
        </div>

        {/* Контент */}
        <div className="p-6">
          {isLoading ? (
            <div className="text-center py-12 text-[var(--app-muted)]">Загрузка...</div>
          ) : datasets.length === 0 ? (
            <div className="text-center py-12 text-[var(--app-muted)]">
              <svg
                className="mx-auto h-12 w-12 text-[var(--app-subtle)]"
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
              <h3 className="mt-2 text-sm font-medium text-[var(--app-text-strong)]">
                {activeTab === 'my'
                  ? 'У вас пока нет датасетов'
                  : 'Вам пока не доступны чужие датасеты'}
              </h3>
              <p className="mt-1 text-sm text-[var(--app-muted)]">
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
                    className="border border-[var(--app-line)] rounded-lg p-4 hover:shadow-md transition cursor-pointer"
                    onClick={() => navigate(`/datasets/${dataset.id}`)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-[var(--app-text)] text-lg">
                        {dataset.name}
                      </h3>
                      {dataset.is_private && (
                        <span className="text-xs bg-[var(--app-surface-raised)] text-[var(--app-muted)] px-2 py-1 rounded">
                          Приватный
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 text-sm text-[var(--app-muted)]">
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
                      <div className="mt-4 pt-3 border-t border-[var(--app-line)]">
                        <div className="flex justify-between items-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/datasets/${dataset.id}/members`);
                            }}
                            className="text-sm text-[var(--app-accent-text)] hover:underline"
                          >
                            Участники →
                          </button>
                          {canExport && (
                            <button
                              onClick={(event) => exportDataset(event, dataset.id, dataset.name)}
                              disabled={exportingDatasetId === dataset.id}
                              className="text-sm text-[var(--app-green)] hover:underline"
                            >
                              {exportingDatasetId === dataset.id ? 'Экспортируем...' : 'Экспорт ↓'}
                            </button>
                          )}
                        </div>
                        {exportingDatasetId === dataset.id && exportProgress && (
                          <div className="dataset-export-progress dataset-export-progress--light" aria-live="polite">
                            <div className="dataset-export-progress__label">
                              <span>{getExportProgressLabel(exportProgress)}</span>
                              <span>{exportProgress.progress}%</span>
                            </div>
                            <progress
                              max="100"
                              value={exportProgress.stage === 'downloading' && !exportProgress.total_download_bytes
                                ? undefined
                                : exportProgress.progress}
                              aria-label="Прогресс экспорта датасета"
                            />
                          </div>
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
