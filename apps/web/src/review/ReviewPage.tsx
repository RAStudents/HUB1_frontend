import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { getApiErrorMessage } from '../api/errorMessage';

interface DatasetSummary {
  id: number;
  name: string;
  is_owner?: boolean;
  my_role?: string;
}

interface ReviewAnnotation {
  id?: number | null;
  class_id: number;
  box?: { x: number; y: number; width: number; height: number } | null;
  obb?: { x: number; y: number; width: number; height: number; angle_deg: number } | null;
  polygon?: { points: Array<{ x: number; y: number }> } | null;
}

interface ReviewSample {
  id: number;
  sample_id?: number | null;
  dataset_id: number;
  stem: string;
  split: string;
  status: string;
  is_labeled: boolean;
  image_url: string;
  thumb_url?: string | null;
  filename: string;
  task: string;
  objects_count: number;
  annotation_classes: Array<{ id: number; name: string; count: number }>;
  annotations: ReviewAnnotation[];
}

interface GalleryResponse {
  total: number;
  page: number;
  page_size: number;
  items: ReviewSample[];
}

interface QueueItem {
  key: string;
  datasetName: string;
  sample: ReviewSample;
}

const PAGE_SIZE = 100;
const ANNOTATION_COLORS = ['#ef4444', '#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899'];

const ReviewImage = ({ item }: { item: ReviewSample }) => {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const classNames = useMemo(
    () => Object.fromEntries(item.annotation_classes.map(({ id, name }) => [id, name])),
    [item.annotation_classes],
  );

  const resizeCanvas = useCallback(() => {
    const container = containerRef.current;
    if (!container || dimensions.width === 0 || dimensions.height === 0) return;
    const scale = Math.min(
      container.clientWidth / dimensions.width,
      container.clientHeight / dimensions.height,
    );
    const nextSize = {
      width: Math.round(dimensions.width * scale),
      height: Math.round(dimensions.height * scale),
    };
    setCanvasSize((current) => (
      current.width === nextSize.width && current.height === nextSize.height ? current : nextSize
    ));
  }, [dimensions]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(container);
    resizeCanvas();
    return () => observer.disconnect();
  }, [resizeCanvas]);

  return (
    <div className="review-image" ref={containerRef}>
      <div
        className="review-image__canvas"
        style={canvasSize.width > 0 ? canvasSize : undefined}
      >
        <img
          alt={item.filename}
          onLoad={(event) => setDimensions({
            width: event.currentTarget.naturalWidth,
            height: event.currentTarget.naturalHeight,
          })}
          src={item.image_url}
        />
        {dimensions.width > 0 && dimensions.height > 0 && item.annotations.length > 0 && (
        <svg
          aria-label="Разметка кадра"
          className="review-image__annotations"
          preserveAspectRatio="none"
          viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        >
          {item.annotations.map((annotation, index) => {
            const color = ANNOTATION_COLORS[
              (annotation.class_id % ANNOTATION_COLORS.length + ANNOTATION_COLORS.length)
              % ANNOTATION_COLORS.length
            ];
            const strokeWidth = Math.max(2, dimensions.width * 0.0025);
            const key = annotation.id ?? `${annotation.class_id}-${index}`;
            const label = classNames[annotation.class_id] || `class_${annotation.class_id}`;

            if (annotation.obb) {
              const { x, y, width, height, angle_deg } = annotation.obb;
              const centerX = x * dimensions.width;
              const centerY = y * dimensions.height;
              const boxWidth = width * dimensions.width;
              const boxHeight = height * dimensions.height;
              return (
                <g key={key}>
                  <rect
                    fill={`${color}33`}
                    height={boxHeight}
                    stroke={color}
                    strokeWidth={strokeWidth}
                    transform={`rotate(${angle_deg} ${centerX} ${centerY})`}
                    width={boxWidth}
                    x={centerX - boxWidth / 2}
                    y={centerY - boxHeight / 2}
                  />
                </g>
              );
            }

            if (annotation.box) {
              const { x, y, width, height } = annotation.box;
              const boxWidth = width * dimensions.width;
              const boxHeight = height * dimensions.height;
              const left = x * dimensions.width - boxWidth / 2;
              const top = y * dimensions.height - boxHeight / 2;
              return (
                <g key={key}>
                  <rect
                    fill={`${color}33`}
                    height={boxHeight}
                    stroke={color}
                    strokeWidth={strokeWidth}
                    width={boxWidth}
                    x={left}
                    y={top}
                  />
                  <text fill={color} fontSize={Math.max(14, dimensions.width * 0.02)} fontWeight="700" x={left} y={Math.max(16, top - 4)}>
                    {label}
                  </text>
                </g>
              );
            }

            const points = annotation.polygon?.points || [];
            if (points.length < 3) return null;
            const pointsAttribute = points
              .map(({ x, y }) => `${x * dimensions.width},${y * dimensions.height}`)
              .join(' ');
            return (
              <polygon
                key={key}
                fill={`${color}33`}
                points={pointsAttribute}
                stroke={color}
                strokeWidth={strokeWidth}
              />
            );
          })}
        </svg>
        )}
      </div>
    </div>
  );
};

export const ReviewPage = () => {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [activeKey, setActiveKey] = useState('');
  const [datasetFilter, setDatasetFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const loadQueue = useCallback(async (signal: AbortSignal) => {
    const { data } = await apiClient.get<{ items: DatasetSummary[] }>('/datasets/', { signal });
    const ownedDatasets = (data.items || []).filter(
      (dataset) => dataset.is_owner || dataset.my_role === 'owner',
    );

    const queues = await Promise.all(ownedDatasets.map(async (dataset) => {
      const firstPage = await apiClient.get<GalleryResponse>(
        `/datasets/${dataset.id}/samples`,
        { params: { status: 'in_review', page: 1, page_size: PAGE_SIZE }, signal },
      );
      const pageCount = Math.ceil(firstPage.data.total / PAGE_SIZE);
      const otherPages = await Promise.all(
        Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) => (
          apiClient.get<GalleryResponse>(
            `/datasets/${dataset.id}/samples`,
            { params: { status: 'in_review', page: index + 2, page_size: PAGE_SIZE }, signal },
          )
        )),
      );
      return [
        ...firstPage.data.items,
        ...otherPages.flatMap(({ data: page }) => page.items),
      ].map((sample) => ({
        key: `${dataset.id}:${sample.sample_id ?? sample.id}`,
        datasetName: dataset.name,
        sample,
      }));
    }));

    return queues.flat();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      setLoading(true);
      setError('');
      try {
        const queue = await loadQueue(controller.signal);
        if (controller.signal.aborted) return;
        setItems(queue);
        setActiveKey((current) => queue.some((item) => item.key === current) ? current : queue[0]?.key || '');
      } catch (loadError) {
        if (!controller.signal.aborted) setError(getApiErrorMessage(loadError, 'Не удалось загрузить очередь проверки.'));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void run();
    return () => controller.abort();
  }, [loadQueue, refreshKey]);

  const visibleItems = useMemo(
    () => datasetFilter === 'all'
      ? items
      : items.filter(({ sample }) => String(sample.dataset_id) === datasetFilter),
    [datasetFilter, items],
  );
  const selectedItem = visibleItems.find(({ key }) => key === activeKey) || visibleItems[0] || null;
  const selectedIndex = selectedItem ? visibleItems.findIndex(({ key }) => key === selectedItem.key) : -1;
  const datasets = useMemo(() => {
    const unique = new Map<number, string>();
    items.forEach(({ sample, datasetName }) => unique.set(sample.dataset_id, datasetName));
    return [...unique.entries()].map(([id, name]) => ({ id, name }));
  }, [items]);

  const decide = async (decision: 'accepted' | 'rejected') => {
    if (!selectedItem) return;
    const sampleId = selectedItem.sample.sample_id ?? selectedItem.sample.id;
    setBusy(true);
    setError('');
    try {
      await apiClient.post(
        `/datasets/${selectedItem.sample.dataset_id}/samples/${sampleId}/review`,
        { decision },
      );
      const remaining = visibleItems.filter(({ key }) => key !== selectedItem.key);
      setItems((current) => current.filter(({ key }) => key !== selectedItem.key));
      setActiveKey(remaining[0]?.key || '');
      window.dispatchEvent(new Event('review-queue:changed'));
    } catch (decisionError) {
      setError(getApiErrorMessage(decisionError, 'Не удалось сохранить решение по кадру.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="review-page">
      <Link to="/" className="page-back">← Датасеты</Link>
      <header className="review-heading">
        <div>
          <h1>Проверка</h1>
          <p>{items.length} {items.length === 1 ? 'кадр ждёт' : 'кадров ждут'} решения владельца</p>
        </div>
        <button
          className="button button--quiet"
          disabled={loading}
          onClick={() => setRefreshKey((current) => current + 1)}
          type="button"
        >
          {loading ? 'Обновляем...' : 'Обновить'}
        </button>
      </header>

      {error && <div className="form-alert review-error" role="alert">{error}</div>}

      {loading && items.length === 0 ? (
        <div className="review-empty">Загружаем очередь проверки...</div>
      ) : error && items.length === 0 ? (
        <div className="review-empty">
          <h2>Не удалось загрузить очередь</h2>
          <button className="button button--quiet" onClick={() => setRefreshKey((current) => current + 1)} type="button">
            Повторить
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="review-empty">
          <h2>Очередь пуста</h2>
          <p>Кадры появятся здесь, когда разметчики отправят их на проверку.</p>
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="review-empty">
          <h2>В этом датасете нет кадров на проверке</h2>
          <p>Выберите другой датасет или вернитесь к общей очереди.</p>
        </div>
      ) : (
        <div className="review-layout">
          <aside className="review-queue panel-surface">
            <label className="review-queue__filter">
              <select aria-label="Фильтр по датасету" value={datasetFilter} onChange={(event) => {
                setDatasetFilter(event.target.value);
                const next = event.target.value === 'all'
                  ? items[0]
                  : items.find(({ sample }) => String(sample.dataset_id) === event.target.value);
                setActiveKey(next?.key || '');
              }}>
                <option value="all">Все датасеты</option>
                {datasets.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
              </select>
            </label>
            <div className="review-queue__count">В очереди · {visibleItems.length}</div>
            <div className="review-queue__items">
              {visibleItems.map(({ key, datasetName, sample }) => (
                <button
                  aria-current={selectedItem?.key === key ? 'true' : undefined}
                  className={`review-queue-item${selectedItem?.key === key ? ' is-active' : ''}`}
                  key={key}
                  onClick={() => setActiveKey(key)}
                  type="button"
                >
                  <span className="review-queue-item__thumb">
                    <img alt="" loading="lazy" src={sample.thumb_url || sample.image_url} />
                  </span>
                  <span className="review-queue-item__body">
                    <strong>{sample.filename || sample.stem}</strong>
                    <span>{datasetName}</span>
                    <small>{sample.objects_count} {sample.objects_count === 1 ? 'объект' : 'объектов'}</small>
                  </span>
                </button>
              ))}
            </div>
          </aside>

          {selectedItem && (
            <article className="review-detail panel-surface">
              <header className="review-detail__header">
                <div>
                  <h2>{selectedItem.sample.filename || selectedItem.sample.stem}</h2>
                  <p>{selectedItem.datasetName} · {selectedItem.sample.split}</p>
                </div>
                <div className="review-detail__navigation">
                  <button
                    aria-label="Предыдущий кадр"
                    disabled={selectedIndex <= 0}
                    onClick={() => setActiveKey(visibleItems[selectedIndex - 1]?.key || '')}
                    type="button"
                  >
                    ‹
                  </button>
                  <span>{selectedIndex + 1} из {visibleItems.length}</span>
                  <button
                    aria-label="Следующий кадр"
                    disabled={selectedIndex >= visibleItems.length - 1}
                    onClick={() => setActiveKey(visibleItems[selectedIndex + 1]?.key || '')}
                    type="button"
                  >
                    ›
                  </button>
                </div>
              </header>

              <ReviewImage item={selectedItem.sample} key={selectedItem.key} />

              <div className="review-detail__classes">
                <span>Объекты:</span>
                {selectedItem.sample.annotation_classes.length > 0
                  ? selectedItem.sample.annotation_classes.map(({ id, name, count }) => (
                    <span key={id}>{name} · {count}</span>
                  ))
                  : <span>Нет объектов</span>}
              </div>

              <footer className="review-detail__footer">
                <span>Решение сохранится сразу.</span>
                <div>
                  <button
                    className="button button--quiet review-detail__reject"
                    disabled={busy}
                    onClick={() => void decide('rejected')}
                    type="button"
                  >
                    Вернуть на доработку
                  </button>
                  <button
                    className="button button--primary"
                    disabled={busy}
                    onClick={() => void decide('accepted')}
                    type="button"
                  >
                    {busy ? 'Сохраняем...' : 'Принять'}
                  </button>
                </div>
              </footer>
            </article>
          )}
        </div>
      )}
    </section>
  );
};
