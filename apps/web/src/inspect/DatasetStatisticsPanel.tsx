import { useEffect, useState, type CSSProperties } from 'react';
import axios from 'axios';
import { apiClient } from '../api/client';

interface ClassStatistic {
  class_id: number;
  class_name: string;
  count: number;
}

type Heatmap = number[][];

interface SplitStatistics {
  image_count: number;
  labeled_count: number;
  status_counts: Record<string, number>;
  annotation_count: number;
  annotations_per_class: ClassStatistic[];
  annotation_locations: {
    all: Heatmap;
    classes: (ClassStatistic & { heatmap: Heatmap })[];
  };
}

interface DatasetStatistics extends SplitStatistics {
  grid_size: number;
  splits: Record<'train' | 'test' | 'val', SplitStatistics | null>;
}

const COLUMNS = [['all', 'All'], ['train', 'Train'], ['test', 'Test'], ['val', 'Val']] as const;
const formatNumber = new Intl.NumberFormat('ru-RU');
const formatShare = new Intl.NumberFormat('ru-RU', { style: 'percent', maximumSignificantDigits: 3 });

interface Props {
  datasetId: string;
  reloadKey: number;
}

const STATUSES = [
  { id: 'unlabeled', label: 'Без разметки', color: 'var(--frame-status-unlabeled)' },
  { id: 'in_progress', label: 'В работе', color: 'var(--frame-status-in-progress)' },
  { id: 'in_review', label: 'На проверке', color: 'var(--frame-status-in-review)' },
  { id: 'accepted', label: 'Приняты', color: 'var(--frame-status-accepted)' },
  { id: 'rejected', label: 'На доработку', color: 'var(--frame-status-rejected)' },
] as const;

const CLASS_COLORS = ['var(--app-accent)', '#ffad36', '#4b9dff', '#35c99a', '#a779ef', '#e879b9'];

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
          <line x1="40" x2="300" y1={135 - fraction * 115} y2={135 - fraction * 115} stroke="var(--app-line)" />
          <text x="34" y={139 - fraction * 115} textAnchor="end">{Math.round(maximum * fraction).toLocaleString('ru-RU')}</text>
        </g>
      ))}
      <polyline points={points.map(({ x, y }) => `${x},${y}`).join(' ')} fill="none" stroke="var(--app-accent-text)" strokeWidth="2" />
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

function CenterHeatmap({ title, grid, gridSize, total, peak, hasFrames }: {
  title: string;
  grid: Heatmap;
  gridSize: number;
  total: number;
  peak: number;
  hasFrames: boolean;
}) {
  return (
    <article className="dataset-stat-card dataset-stat-card--heatmap">
      <h4 className="dataset-stat-card__label">Центры объектов</h4>
      <div className="dataset-center-heatmap">
        <svg viewBox={`0 0 ${gridSize} ${gridSize}`} role="img" aria-label={`${title}: карта центров, ${total} объектов`} shapeRendering="crispEdges">
          {grid.map((row, y) => row.map((count, x) => {
            if (count === 0) return null;
            const share = count / total;
            const intensity = (share / peak) * 100;
            return (
              <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1"
                fill={`color-mix(in oklab, var(--heatmap-low), var(--heatmap-high) ${intensity}%)`}>
                <title>{`${formatNumber.format(count)} · ${formatShare.format(share)}`}</title>
              </rect>
            );
          }))}
        </svg>
        {total === 0 && <span>{hasFrames ? 'Нет объектов' : 'Нет кадров'}</span>}
      </div>
      <span className="dataset-stat-card__hint">Объектов на карте: {formatNumber.format(total)}</span>
    </article>
  );
}

function StatisticsColumn({ title, data, classOrder, chartType, gridSize, grid, total, peak }: {
  title: string;
  data: SplitStatistics | null;
  classOrder: ClassStatistic[];
  chartType: ChartType;
  gridSize: number;
  grid: Heatmap;
  total: number;
  peak: number;
}) {
  const imageCount = data?.image_count ?? 0;
  const labeledCount = data?.labeled_count ?? 0;
  const roundedProgress = imageCount ? Math.round(labeledCount / imageCount * 100) : 0;
  const progress = labeledCount < imageCount ? Math.min(roundedProgress, 99) : roundedProgress;
  const statuses = STATUSES.map(status => ({ ...status, count: data?.status_counts[status.id] ?? 0 }));
  const counts = new Map(data?.annotations_per_class.map(item => [item.class_id, item.count]));
  const classes = classOrder.map(({ class_id, class_name }) => ({
    id: class_id,
    label: class_name,
    count: counts.get(class_id) ?? 0,
    color: CLASS_COLORS[class_id % CLASS_COLORS.length],
  }));
  const maxClassCount = classes.reduce((max, item) => Math.max(max, item.count), 1);

  return (
    <section className={`dataset-statistics__column${title === 'All' ? ' is-overall' : ''}`} aria-label={title}>
      <h3>{title}</h3>
      <article className="dataset-stat-card">
        <h4 className="dataset-stat-card__label">Прогресс разметки</h4>
        <strong className="dataset-stat-card__value">{imageCount ? `${progress}%` : '—'}</strong>
        <div className="dataset-stat-progress" role="progressbar" aria-label={`Прогресс разметки: ${title}`} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${progress}%` }} />
        </div>
        <span className="dataset-stat-card__hint">{imageCount ? `${labeledCount} из ${imageCount} кадров размечено` : 'Нет кадров'}</span>
      </article>

      <article className="dataset-stat-card">
        <h4 className="dataset-stat-card__label">Статусы кадров</h4>
        {imageCount > 0 && <DistributionChart items={statuses} type={chartType} />}
        {chartType === 'bars' && <div className="dataset-stat-status-bar" aria-hidden="true">
          {statuses.filter(({ count }) => count > 0).map(({ id, color, count }) => (
            <span key={id} style={{ width: `${count / imageCount * 100}%`, background: color }} />
          ))}
        </div>}
        <div className="dataset-stat-status-list">
          {statuses.map(({ id, label, color, count }, index) => (
            <div className="dataset-stat-status" key={id}>
              <span><i style={{ background: color }} />{chartType === 'line' && imageCount > 0 ? `${index + 1}. ` : ''}{label}</span>
              <strong>{formatNumber.format(count)}</strong>
            </div>
          ))}
        </div>
      </article>

      <article className="dataset-stat-card">
        <h4 className="dataset-stat-card__label">Объекты по классам</h4>
        {data && data.annotation_count > 0 ? (
          <>
            <DistributionChart items={classes} type={chartType} />
            <div className="dataset-stat-class-list" tabIndex={0} role="region" aria-label={`Объекты по классам: ${title}`}>
              {classes.map(({ id, label, count, color }, index) => (
                <div className="dataset-stat-class" key={id} style={{ '--class-color': color } as CSSProperties}>
                  <div><span className="dataset-stat-class__name"><i />{chartType === 'line' ? `${index + 1}. ` : ''}{label}</span><strong>{formatNumber.format(count)}</strong></div>
                  {chartType === 'bars' && <span className="dataset-stat-class__track">
                    <i style={{ width: `${count / maxClassCount * 100}%` }} />
                  </span>}
                </div>
              ))}
            </div>
            <span className="dataset-stat-card__hint">Объектов всего: {formatNumber.format(data.annotation_count)}</span>
          </>
        ) : <span className="dataset-stat-card__hint">Нет размеченных объектов</span>}
      </article>

      <CenterHeatmap title={title} grid={grid} gridSize={gridSize} total={total} peak={peak} hasFrames={imageCount > 0} />
    </section>
  );
}

function getHeatmap(data: SplitStatistics | null, classId: string) {
  const locations = data?.annotation_locations;
  const grid = (classId === 'all'
    ? locations?.all
    : locations?.classes.find(item => String(item.class_id) === classId)?.heatmap) ?? [];
  let total = 0;
  let maximum = 0;
  for (const row of grid) {
    for (const count of row) {
      total += count;
      maximum = Math.max(maximum, count);
    }
  }
  return { grid, total, peak: total ? maximum / total : 0 };
}

export const DatasetStatisticsPanel = ({ datasetId, reloadKey }: Props) => {
  const [statistics, setStatistics] = useState<DatasetStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [sortOrder, setSortOrder] = useState<SortOrder>('descending');
  const [chartType, setChartType] = useState<ChartType>('bars');
  const [heatmapClass, setHeatmapClass] = useState('all');

  useEffect(() => {
    const controller = new AbortController();
    const loadStatistics = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await apiClient.get<DatasetStatistics>(`/datasets/${datasetId}/statistics`, {
          params: { grid_size: 20 },
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setStatistics(data);
        setHeatmapClass(current => data.annotations_per_class.some(item => String(item.class_id) === current) ? current : 'all');
      } catch (requestError) {
        if (!controller.signal.aborted) setError(getErrorMessage(requestError));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void loadStatistics();
    return () => controller.abort();
  }, [datasetId, reloadKey, refreshKey]);

  const direction = sortOrder === 'descending' ? -1 : 1;
  const classOrder = [...(statistics?.annotations_per_class ?? [])]
    .sort((a, b) => direction * (a.count - b.count) || a.class_id - b.class_id);
  const columns = statistics ? COLUMNS.map(([key, title]) => {
    const data = key === 'all' ? statistics : statistics.splits[key];
    return { key, title, data, ...getHeatmap(data, heatmapClass) };
  }) : [];
  const peak = Math.max(0, ...columns.map(column => column.peak));

  return (
    <section className="dataset-statistics" aria-labelledby="dataset-statistics-title" aria-busy={loading}>
      <header className="dataset-statistics__header">
        <h2 id="dataset-statistics-title">Сравнение выборок</h2>
        <button
          aria-label="Обновить статистику"
          className="gallery-button dataset-statistics__refresh"
          disabled={loading}
          onClick={() => setRefreshKey(current => current + 1)}
          type="button"
        >
          {loading ? 'Обновляем...' : '↻ Обновить'}
        </button>
      </header>

      {error ? (
        <div className="dataset-statistics__error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setRefreshKey(current => current + 1)}>Повторить</button>
        </div>
      ) : !statistics ? (
        <div className="dataset-statistics__loading" role="status">Считаем статистику датасета...</div>
      ) : (
        <>
          <div className="dataset-statistics__controls">
            <label>Класс на карте
              <select value={heatmapClass} onChange={event => setHeatmapClass(event.target.value)}>
                <option value="all">All · Все классы</option>
                {statistics.annotations_per_class.map(item => <option key={item.class_id} value={item.class_id}>{item.class_name}</option>)}
              </select>
            </label>
            <label>Сортировка классов
              <select value={sortOrder} onChange={event => setSortOrder(event.target.value as SortOrder)}>
                <option value="descending">Сначала частые</option>
                <option value="ascending">Сначала редкие</option>
              </select>
            </label>
            <label>Диаграмма
              <select value={chartType} onChange={event => setChartType(event.target.value as ChartType)}>
                <option value="bars">Полосы</option>
                <option value="donut">Круговая</option>
                <option value="line">Линии</option>
              </select>
            </label>
          </div>
          <div className="dataset-statistics__comparison" role="region" aria-label="Таблица сравнения выборок" tabIndex={0}>
            <div className="dataset-statistics__grid">
              {columns.map(column => <StatisticsColumn key={column.key} title={column.title} data={column.data} classOrder={classOrder}
                chartType={chartType} gridSize={statistics.grid_size} grid={column.grid} total={column.total} peak={peak} />)}
            </div>
          </div>
          <div className="dataset-heatmap-legend">
            <span>Доля центров в ячейке от всех центров на карте</span>
            <div><span>0%</span><i aria-hidden="true" /><span>{formatShare.format(peak)}</span></div>
          </div>
        </>
      )}
    </section>
  );
};
