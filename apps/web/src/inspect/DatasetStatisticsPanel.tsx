import { useEffect, useState, type CSSProperties } from 'react';
import axios from 'axios';
import { apiClient } from '../api/client';

interface ClassStatistic {
  class_id: number;
  class_name: string;
  count: number;
}

interface DatasetStatistics {
  image_count: number;
  annotation_count: number;
  annotations_per_class: ClassStatistic[];
}

interface GallerySummary {
  total: number;
  labeled_count: number;
  unlabeled_count: number;
}

interface Props {
  datasetId: string;
  reloadKey: number;
}

const STATUSES = [
  { id: 'unlabeled', label: 'Без разметки', color: '#7b858b' },
  { id: 'in_progress', label: 'В работе', color: '#4b9dff' },
  { id: 'in_review', label: 'На проверке', color: '#ffbd59' },
  { id: 'accepted', label: 'Приняты', color: '#35c99a' },
  { id: 'rejected', label: 'На доработку', color: '#f26b6b' },
] as const;

const CLASS_COLORS = ['#f85025', '#ffad36', '#4b9dff', '#35c99a', '#a779ef', '#e879b9'];

const getErrorMessage = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const detail: unknown = error.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      const messages = detail
        .map((item) => typeof item === 'object' && item !== null && 'msg' in item ? item.msg : undefined)
        .filter((message): message is string => typeof message === 'string');
      if (messages.length) return messages.join('; ');
    }
    return error.message;
  }
  return error instanceof Error ? error.message : 'Не удалось загрузить статистику датасета.';
};

export const DatasetStatisticsPanel = ({ datasetId, reloadKey }: Props) => {
  const [statistics, setStatistics] = useState<DatasetStatistics | null>(null);
  const [gallerySummary, setGallerySummary] = useState<GallerySummary | null>(null);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const loadStatistics = async () => {
      setLoading(true);
      setError('');
      try {
        const [statisticsResponse, summaryResponse, ...statusResponses] = await Promise.all([
          apiClient.get<DatasetStatistics>(`/datasets/${datasetId}/statistics`, {
            params: { grid_size: 20 },
            signal: controller.signal,
          }),
          apiClient.get<GallerySummary>(`/datasets/${datasetId}/samples`, {
            params: { page: 1, page_size: 1 },
            signal: controller.signal,
          }),
          ...STATUSES.map(({ id }) => apiClient.get<GallerySummary>(`/datasets/${datasetId}/samples`, {
            params: { status: id, page: 1, page_size: 1 },
            signal: controller.signal,
          })),
        ]);
        if (controller.signal.aborted) return;
        setStatistics(statisticsResponse.data);
        setGallerySummary(summaryResponse.data);
        setStatusCounts(Object.fromEntries(
          STATUSES.map(({ id }, index) => [id, statusResponses[index].data.total]),
        ));
      } catch (requestError) {
        if (!controller.signal.aborted) setError(getErrorMessage(requestError));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void loadStatistics();
    return () => controller.abort();
  }, [datasetId, reloadKey, refreshKey]);

  const maxClassCount = Math.max(1, ...(statistics?.annotations_per_class.map(({ count }) => count) || [0]));
  const labeledCount = gallerySummary?.labeled_count || 0;
  const imageCount = statistics?.image_count || 0;
  const roundedProgress = imageCount > 0 ? Math.round((labeledCount / imageCount) * 100) : 0;
  const progress = labeledCount < imageCount ? Math.min(roundedProgress, 99) : roundedProgress;

  return (
    <section className="dataset-statistics" aria-labelledby="dataset-statistics-title" aria-busy={loading}>
      <header className="dataset-statistics__header">
        <h2 id="dataset-statistics-title">Статистика</h2>
        <button
          aria-label="Обновить статистику"
          className="gallery-button dataset-statistics__refresh"
          disabled={loading}
          onClick={() => setRefreshKey((current) => current + 1)}
          type="button"
        >
          {loading ? 'Обновляем...' : '↻ Обновить'}
        </button>
      </header>

      {error ? (
        <div className="dataset-statistics__error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setRefreshKey((current) => current + 1)}>Повторить</button>
        </div>
      ) : loading && !statistics ? (
        <div className="dataset-statistics__loading">Считаем статистику датасета...</div>
      ) : statistics && (
        <>
          <div className="dataset-statistics__grid">
            <article className="dataset-stat-card">
              <span className="dataset-stat-card__label">Прогресс разметки</span>
              <strong className="dataset-stat-card__value">{progress}%</strong>
              <div className={`dataset-stat-progress${progress === 100 ? ' is-complete' : ''}`} role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                <span style={{ width: `${progress}%` }} />
              </div>
              <span className="dataset-stat-card__hint">
                {labeledCount} из {imageCount} кадров размечено
              </span>
            </article>

            <article className="dataset-stat-card">
              <span className="dataset-stat-card__label">Статусы кадров</span>
              <div className="dataset-stat-status-bar" aria-hidden="true">
                {STATUSES.map(({ id, color }) => {
                  const count = statusCounts[id] || 0;
                  return count > 0 ? (
                    <span key={id} style={{ width: `${(count / Math.max(imageCount, 1)) * 100}%`, background: color }} />
                  ) : null;
                })}
              </div>
              <div className="dataset-stat-status-list">
                {STATUSES.map(({ id, label, color }) => (
                  <div className="dataset-stat-status" key={id}>
                    <span><i style={{ background: color }} />{label}</span>
                    <strong>{statusCounts[id] || 0}</strong>
                  </div>
                ))}
              </div>
            </article>

            <article className="dataset-stat-card">
              <span className="dataset-stat-card__label">Объекты по классам</span>
              {statistics.annotations_per_class.length === 0 ? (
                <span className="dataset-stat-card__hint">Пока нет размеченных объектов</span>
              ) : statistics.annotations_per_class.map(({ class_id, class_name, count }, index) => (
                <div className="dataset-stat-class" key={class_id} style={{ '--class-color': CLASS_COLORS[index % CLASS_COLORS.length] } as CSSProperties}>
                  <div><span>{class_name}</span><strong>{count}</strong></div>
                  <span className="dataset-stat-class__track">
                    <i style={{ width: `${(count / maxClassCount) * 100}%` }} />
                  </span>
                </div>
              ))}
              <span className="dataset-stat-card__hint">{statistics.annotation_count} объектов всего</span>
            </article>

          </div>
        </>
      )}
    </section>
  );
};
