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

type ChartType = 'bars' | 'donut' | 'line';
type SortOrder = 'descending' | 'ascending';
interface ChartItem {
  label: string;
  count: number;
  color: string;
}

function DistributionChart({ items, type }: { items: ChartItem[]; type: ChartType }) {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  if (type === 'bars') return null;
  if (total === 0) return <p className="dataset-stat-card__hint">Пока нет данных для диаграммы</p>;

  if (type === 'donut') {
    const { segments } = items.reduce<{ segments: string[]; offset: number }>((result, { count, color }) => {
      const end = result.offset + (count / total) * 100;
      return { segments: [...result.segments, `${color} ${result.offset}% ${end}%`], offset: end };
    }, { segments: [], offset: 0 });
    return (
      <div className="dataset-distribution-donut" role="img" aria-label={`Всего: ${total}. Значения указаны в списке ниже.`} style={{ background: `conic-gradient(${segments.join(', ')})` }}>
        <span>{total.toLocaleString('ru-RU')}</span>
      </div>
    );
  }

  const maximum = Math.max(1, ...items.map(({ count }) => count));
  const points = items.map((item, index) => ({
    ...item,
    x: items.length === 1 ? 160 : 40 + (index / (items.length - 1)) * 260,
    y: 135 - (item.count / maximum) * 115,
  }));
  return (
    <svg className="dataset-distribution-line" viewBox="0 0 320 162" role="img" aria-label="Количество по категориям. Порядок и значения указаны в списке ниже.">
      {[0, 0.5, 1].map((fraction) => (
        <g key={fraction}>
          <line x1="40" x2="300" y1={135 - fraction * 115} y2={135 - fraction * 115} stroke="#515a60" />
          <text x="34" y={139 - fraction * 115} textAnchor="end">{Math.round(maximum * fraction).toLocaleString('ru-RU')}</text>
        </g>
      ))}
      <polyline points={points.map(({ x, y }) => `${x},${y}`).join(' ')} fill="none" stroke="#ffad36" strokeWidth="2" />
      {points.map(({ label, count, color, x, y }, index) => (
        <g key={label}>
          <circle cx={x} cy={y} r="4" fill={color}><title>{label}: {count}</title></circle>
          {items.length <= 12 && <text x={x} y="155" textAnchor="middle">{index + 1}</text>}
        </g>
      ))}
    </svg>
  );
}

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
  const [sortOrder, setSortOrder] = useState<SortOrder>('descending');
  const [chartType, setChartType] = useState<ChartType>('bars');

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
  const direction = sortOrder === 'descending' ? -1 : 1;
  const sortedClasses = [...(statistics?.annotations_per_class || [])]
    .sort((a, b) => direction * (a.count - b.count) || a.class_id - b.class_id);
  const sortedStatuses = STATUSES.map((status) => ({ ...status, count: statusCounts[status.id] || 0 }))
    .sort((a, b) => direction * (a.count - b.count));
  const classChartItems = sortedClasses.map(({ class_id, class_name, count }) => ({
    label: class_name, count, color: CLASS_COLORS[class_id % CLASS_COLORS.length],
  }));

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

      <div className="dataset-statistics__controls">
        <label>Сортировка
          <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value as SortOrder)}>
            <option value="descending">Сначала частые</option>
            <option value="ascending">Сначала редкие</option>
          </select>
        </label>
        <label>Диаграмма
          <select value={chartType} onChange={(event) => setChartType(event.target.value as ChartType)}>
            <option value="bars">Полосы</option>
            <option value="donut">Бублик</option>
            <option value="line">Линии</option>
          </select>
        </label>
      </div>

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
              <DistributionChart items={sortedStatuses} type={chartType} />
              {chartType === 'bars' && <div className="dataset-stat-status-bar" aria-hidden="true">
                {sortedStatuses.map(({ id, color }) => {
                  const count = statusCounts[id] || 0;
                  return count > 0 ? (
                    <span key={id} style={{ width: `${(count / Math.max(imageCount, 1)) * 100}%`, background: color }} />
                  ) : null;
                })}
              </div>}
              <div className="dataset-stat-status-list">
                {sortedStatuses.map(({ id, label, color }, index) => (
                  <div className="dataset-stat-status" key={id}>
                    <span><i style={{ background: color }} />{chartType === 'line' ? `${index + 1}. ` : ''}{label}</span>
                    <strong>{statusCounts[id] || 0}</strong>
                  </div>
                ))}
              </div>
            </article>

            <article className="dataset-stat-card">
              <span className="dataset-stat-card__label">Объекты по классам</span>
              <DistributionChart items={classChartItems} type={chartType} />
              {statistics.annotations_per_class.length === 0 ? (
                <span className="dataset-stat-card__hint">Пока нет размеченных объектов</span>
              ) : sortedClasses.map(({ class_id, class_name, count }, index) => (
                <div className="dataset-stat-class" key={class_id} style={{ '--class-color': CLASS_COLORS[class_id % CLASS_COLORS.length] } as CSSProperties}>
                  <div><span className="dataset-stat-class__name"><i />{chartType === 'line' ? `${index + 1}. ` : ''}{class_name}</span><strong>{count}</strong></div>
                  {chartType === 'bars' && <span className="dataset-stat-class__track">
                    <i style={{ width: `${(count / maxClassCount) * 100}%` }} />
                  </span>}
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
