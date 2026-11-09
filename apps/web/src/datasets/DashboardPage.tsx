// apps/web/src/datasets/DashboardPage.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { apiClient } from '../api/client';
import { downloadDatasetExport, getExportProgressLabel } from '../api/exports';
import type { ExportClass, ExportOptions, ExportProgress } from '../api/exports';
import { useAuth } from '../auth/AuthContext';

interface DatasetItem {
  id: number;
  name: string;
  task: 'detect' | 'obb' | 'segment';
  description?: string;
  is_private: boolean;
  images_count: number;
  cover_url?: string;
  classes: string[];
  is_owner?: boolean;
  my_role?: 'owner' | 'labeler' | 'observer';
}

const taskNames: Record<string, string> = {
  detect: 'Bounding Box',
  obb: 'OBB',
  segment: 'Polygon',
};

const roleLabels: Record<string, string> = {
  owner: 'Владелец',
  labeler: 'Разметчик',
  observer: 'Наблюдатель',
};

export const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'my' | 'shared'>('my');
  const [datasets, setDatasets] = useState<DatasetItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingDatasetId, setDeletingDatasetId] = useState<number | null>(null);
  const [exportingDatasetId, setExportingDatasetId] = useState<number | null>(null);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [exportDialogDataset, setExportDialogDataset] = useState<DatasetItem | null>(null);
  const [exportClasses, setExportClasses] = useState<ExportClass[]>([]);
  const [selectedExportClassIds, setSelectedExportClassIds] = useState<number[]>([]);
  const [selectedExportSplits, setSelectedExportSplits] = useState<Array<'train' | 'val' | 'test'>>(['train', 'val', 'test']);
  const [isLoadingExportClasses, setIsLoadingExportClasses] = useState(false);
  const [exportClassError, setExportClassError] = useState('');
  const [exportDialogError, setExportDialogError] = useState('');
  const isOwner = (dataset: DatasetItem) => Boolean(dataset.is_owner || dataset.my_role === 'owner');
  const myDatasets = datasets.filter(isOwner);
  const sharedDatasets = datasets.filter((dataset) => !isOwner(dataset));
  const visibleDatasets = activeTab === 'my' ? myDatasets : sharedDatasets;

  useEffect(() => {
    loadDatasets();
  }, [activeTab]);

  const loadDatasets = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get('/datasets/');
      setDatasets(res.data.items || []);
    } catch (err) {
      console.error('Ошибка загрузки датасетов:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteDataset = async (event: React.MouseEvent<HTMLButtonElement>, dataset: DatasetItem) => {
    event.stopPropagation();
    const confirmed = window.confirm(`Удалить датасет «${dataset.name}» вместе со всеми изображениями? Это действие нельзя отменить.`);
    if (!confirmed) return;

    setDeletingDatasetId(dataset.id);
    try {
      await apiClient.delete(`/datasets/${dataset.id}`);
      setDatasets((current) => current.filter((item) => item.id !== dataset.id));
    } catch (error: any) {
      window.alert(error.response?.data?.detail || 'Не удалось удалить датасет. Попробуйте ещё раз.');
    } finally {
      setDeletingDatasetId(null);
    }
  };

  const openExportDialog = async (event: React.MouseEvent<HTMLButtonElement>, dataset: DatasetItem) => {
    event.stopPropagation();
    setExportDialogDataset(dataset);
    setExportClasses([]);
    setSelectedExportClassIds([]);
    setSelectedExportSplits(['train', 'val', 'test']);
    setExportClassError('');
    setExportDialogError('');
    setIsLoadingExportClasses(true);
    try {
      const { data } = await apiClient.get<ExportClass[]>(`/datasets/${dataset.id}/exports/classes`);
      setExportClasses(data);
      setSelectedExportClassIds(data.map(({ id }) => id));
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.detail || 'Не удалось загрузить список классов.'
        : error instanceof Error ? error.message : 'Не удалось загрузить список классов.';
      setExportClassError(message);
    } finally {
      setIsLoadingExportClasses(false);
    }
  };

  const exportDataset = async (dataset: DatasetItem, options: ExportOptions) => {
    setExportingDatasetId(dataset.id);
    setExportDialogDataset(null);
    try {
      const exportedSamples = await downloadDatasetExport(
        dataset.id,
        dataset.name,
        setExportProgress,
        options,
      );
      if (exportedSamples === 0) {
        window.alert('В датасете нет принятых кадров для экспорта.');
      } else {
        window.alert(`Экспортировано кадров: ${exportedSamples}`);
      }
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Не удалось экспортировать датасет.');
    } finally {
      setExportingDatasetId(null);
      setExportProgress(null);
    }
  };

  const submitExport = () => {
    if (!exportDialogDataset) return;
    if (selectedExportSplits.length === 0) {
      setExportDialogError('Выберите хотя бы один сплит.');
      return;
    }
    if (exportClasses.length > 0 && selectedExportClassIds.length === 0) {
      setExportDialogError('Выберите хотя бы один класс.');
      return;
    }

    const options: ExportOptions = {
      class_ids: selectedExportClassIds.length === exportClasses.length ? null : selectedExportClassIds,
      splits: selectedExportSplits.length === 3 ? null : selectedExportSplits,
    };
    void exportDataset(exportDialogDataset, options);
  };

  return (
    <section className="dataset-page">
      <header className="dataset-page__heading">
        <div>
          <h1>Привет, {user?.display_name || 'Пользователь'}!</h1>
          <p>Управление датасетами для разметки</p>
        </div>
        <button className="button button--primary" onClick={() => navigate('/datasets/create')}>
          Создать датасет
        </button>
      </header>

      <nav className="dataset-tabs" aria-label="Разделы датасетов">
        <button
          className={`dataset-tabs__tab${activeTab === 'my' ? ' is-active' : ''}`}
          type="button"
          aria-current={activeTab === 'my' ? 'page' : undefined}
          onClick={() => setActiveTab('my')}
        >
          Мои датасеты <span>{myDatasets.length}</span>
        </button>
        <button
          className={`dataset-tabs__tab${activeTab === 'shared' ? ' is-active' : ''}`}
          type="button"
          aria-current={activeTab === 'shared' ? 'page' : undefined}
          onClick={() => setActiveTab('shared')}
        >
          Доступные мне <span>{sharedDatasets.length}</span>
        </button>
      </nav>

      {isLoading ? (
        <div className="dataset-empty">Загружаем датасеты...</div>
      ) : visibleDatasets.length === 0 && activeTab === 'shared' ? (
        <div className="dataset-empty">
          <h2>Нет доступных датасетов</h2>
          <p>Здесь появятся датасеты, к которым вас пригласили.</p>
        </div>
      ) : (
        <div className="dataset-grid">
          {visibleDatasets.map((dataset) => {
            const canManage = isOwner(dataset);
            const role = canManage ? 'owner' : dataset.my_role;
            const userRole = role ? roleLabels[role] : 'Участник';

            return (
              <article className="dataset-card" key={dataset.id} onClick={() => navigate(`/datasets/${dataset.id}/gallery`)} style={{ cursor: 'pointer' }}>
                {dataset.cover_url ? (
                  <img className="dataset-card__preview" src={dataset.cover_url} alt={dataset.name} />
                ) : (
                  <div className="dataset-card__preview" style={{ background: '#222', display: 'grid', placeItems: 'center', color: '#666' }}>Нет превью</div>
                )}

                <div className="dataset-card__content">
                  <div className="dataset-card__title-row">
                    <h2>{dataset.name}</h2>
                    {dataset.is_private && (
                      <span className="dataset-private">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11V7.5A5 5 0 0 1 12 2.5a5 5 0 0 1 5 5V11M5 11h14v10H5z" /></svg>
                        Приватный
                      </span>
                    )}
                  </div>

                  <div className="dataset-card__badges">
                    <span className="dataset-badge">{taskNames[dataset.task] || dataset.task}</span>
                    <span className="dataset-badge">{dataset.images_count} кадров</span>
                  </div>

                  <div className="dataset-card__role-row">
                    <span>Ваша роль</span>
                    <span className={`role-pill ${role === 'owner' ? 'role-pill--owner' : role === 'labeler' ? 'role-pill--labeler' : 'role-pill--observer'}`}>
                      {userRole}
                    </span>
                  </div>

                  <div className="dataset-card__actions">
                    {canManage ? (
                      <>
                        <button
                          type="button"
                          className="button button--quiet dataset-card__open"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(`/datasets/${dataset.id}/members`);
                          }}
                        >
                          Участники
                        </button>
                        <button
                          type="button"
                          className="button button--quiet dataset-card__open dataset-card__open--labeler"
                          disabled={exportingDatasetId === dataset.id}
                          onClick={(event) => { void openExportDialog(event, dataset); }}
                        >
                          {exportingDatasetId === dataset.id ? 'Экспортируем...' : 'Экспорт'}
                        </button>
                        <button
                          type="button"
                          className="button button--quiet dataset-card__open dataset-card__delete"
                          disabled={deletingDatasetId === dataset.id}
                          onClick={(event) => deleteDataset(event, dataset)}
                          aria-label={`Удалить датасет ${dataset.name}`}
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m3 3v7m6-7v7" /></svg>
                          {deletingDatasetId === dataset.id ? 'Удаляем...' : 'Удалить'}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="button button--quiet dataset-card__open dataset-card__open--labeler"
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(`/datasets/${dataset.id}/gallery`);
                        }}
                      >
                        Открыть разметку <span aria-hidden="true">→</span>
                      </button>
                    )}
                  </div>
                  {exportingDatasetId === dataset.id && exportProgress && (
                    <div className="dataset-export-progress" aria-live="polite">
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
              </article>
            );
          })}
          {activeTab === 'my' && (
            <button
              type="button"
              className="dataset-create-tile"
              onClick={() => navigate('/datasets/create')}
            >
              <span className="dataset-create-tile__plus" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
              </span>
              <strong>Новый датасет</strong>
              <span>Задайте классы и тип разметки, потом пригласите команду</span>
            </button>
          )}
        </div>
      )}
      {exportDialogDataset && (
        <div
          className="dataset-export-dialog"
          onClick={() => setExportDialogDataset(null)}
          role="presentation"
        >
          <section
            aria-labelledby="dataset-export-title"
            aria-modal="true"
            className="dataset-export-dialog__panel"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header className="dataset-export-dialog__header">
              <div>
                <h2 id="dataset-export-title">Экспорт датасета</h2>
                <p>{exportDialogDataset.name}</p>
              </div>
              <button
                aria-label="Закрыть"
                className="dataset-export-dialog__close"
                onClick={() => setExportDialogDataset(null)}
                type="button"
              >
                ×
              </button>
            </header>
            <div className="dataset-export-dialog__body">
              <fieldset className="dataset-export-dialog__group">
                <legend>Сплиты</legend>
                {([
                  ['train', 'Train'],
                  ['val', 'Val'],
                  ['test', 'Test'],
                ] as const).map(([split, label]) => (
                  <label key={split}>
                    <input
                      checked={selectedExportSplits.includes(split)}
                      onChange={(event) => setSelectedExportSplits((current) => event.target.checked
                        ? [...current, split]
                        : current.filter((value) => value !== split))}
                      type="checkbox"
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
              <fieldset className="dataset-export-dialog__group dataset-export-dialog__classes">
                <legend>Классы</legend>
                {isLoadingExportClasses ? (
                  <p>Загружаем классы...</p>
                ) : exportClassError ? (
                  <p className="dataset-export-dialog__error" role="alert">{exportClassError}</p>
                ) : exportClasses.length === 0 ? (
                  <p>В датасете нет классов.</p>
                ) : (
                  <>
                    <button
                      className="dataset-export-dialog__select-all"
                      onClick={() => setSelectedExportClassIds(
                        selectedExportClassIds.length === exportClasses.length
                          ? []
                          : exportClasses.map(({ id }) => id),
                      )}
                      type="button"
                    >
                      {selectedExportClassIds.length === exportClasses.length ? 'Снять выбор' : 'Выбрать все'}
                    </button>
                    <div className="dataset-export-dialog__class-list">
                      {exportClasses.map(({ id, name, count }) => (
                        <label key={id}>
                          <input
                            checked={selectedExportClassIds.includes(id)}
                            onChange={(event) => setSelectedExportClassIds((current) => event.target.checked
                              ? [...current, id]
                              : current.filter((classId) => classId !== id))}
                            type="checkbox"
                          />
                          <span>{name}</span>
                          <small>{count}</small>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </fieldset>
              {exportDialogError && <p className="dataset-export-dialog__error" role="alert">{exportDialogError}</p>}
            </div>
            <footer className="dataset-export-dialog__footer">
              <button className="button button--quiet" onClick={() => setExportDialogDataset(null)} type="button">Отмена</button>
              <button
                className="button button--primary"
                disabled={isLoadingExportClasses || Boolean(exportClassError)}
                onClick={submitExport}
                type="button"
              >
                Экспортировать
              </button>
            </footer>
          </section>
        </div>
      )}
    </section>
  );
};