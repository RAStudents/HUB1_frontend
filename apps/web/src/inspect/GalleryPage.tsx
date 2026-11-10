import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { apiClient } from '../api/client';

interface GalleryItem {
  id: number;
  sample_id?: number;
  filename: string;
  image_url: string;
  annotations: AnnotationGeometry[];
  objects_count: number;
  task: string;
  split?: string;
  status?: string;
  is_labeled?: boolean;
  visible_objects_count?: number;
  annotation_classes?: Array<{ id: number; name: string; count: number }>;
}

interface AnnotationGeometry {
  id?: number | null;
  class_id: number;
  box?: { x: number; y: number; width: number; height: number } | null;
  obb?: { x: number; y: number; width: number; height: number; angle_deg: number } | null;
  polygon?: { points: { x: number; y: number }[] } | null;
}

type GalleryFilter = 'all' | 'labeled' | 'unlabeled';
type ObjectCountFilter = 'all' | 'none' | 'one' | 'multiple';
type SplitFilter = 'all' | 'train' | 'val' | 'test';

const PAGE_SIZE = 12;
const REVIEW_STATUSES = [
  ['unlabeled', 'Без разметки'],
  ['in_progress', 'В работе'],
  ['in_review', 'На проверке'],
  ['accepted', 'Одобрено'],
  ['rejected', 'На доработку'],
] as const;

const taskLabel = (task?: string) => {
  if (task === 'segment') return 'Сегментация';
  if (task === 'detect') return 'Детекция';
  if (task === 'obb') return 'Поворотные рамки';
  return task || 'Не указана';
};

const ANNOTATION_COLORS = ['#ef4444', '#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899'];

const GalleryImage: React.FC<{
  item: GalleryItem;
  selectedClassIds: number[];
  classNames: Record<number, string>;
  opacity: number;
  modal?: boolean;
}> = ({ item, selectedClassIds, classNames, opacity, modal = false }) => {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  const annotations = selectedClassIds.length > 0
    ? item.annotations.filter((annotation) => selectedClassIds.includes(annotation.class_id))
    : item.annotations;

  useEffect(() => {
    if (!modal) return;
    const updateViewport = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, [modal]);

  const modalImageSize = modal && dimensions.width > 0 && dimensions.height > 0
    ? (() => {
      const aspectRatio = dimensions.width / dimensions.height;
      const maxWidth = Math.min(viewport.width * 0.7, 420);
      const maxHeight = Math.min(viewport.height * 0.5, 340);
      const width = Math.min(dimensions.width, maxWidth, maxHeight * aspectRatio);
      return { width, height: width / aspectRatio };
    })()
    : undefined;

  return (
    <span
      className={`gallery-image${modal ? ' gallery-image--modal' : ''}`}
      style={modalImageSize}
    >
      <img
        alt={modal ? item.filename : ''}
        loading={modal ? 'eager' : 'lazy'}
        onLoad={(event) => setDimensions({
          width: event.currentTarget.naturalWidth,
          height: event.currentTarget.naturalHeight,
        })}
        src={item.image_url}
      />
      {dimensions.width > 0 && dimensions.height > 0 && annotations.length > 0 && (
        <svg
          aria-hidden="true"
          className="gallery-image__annotations"
          preserveAspectRatio={modal ? 'xMidYMid meet' : 'xMidYMid slice'}
          viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
          style={{ opacity }}
        >
          {annotations.map((annotation, index) => {
            const colorIndex = (annotation.class_id % ANNOTATION_COLORS.length + ANNOTATION_COLORS.length)
              % ANNOTATION_COLORS.length;
            const color = ANNOTATION_COLORS[colorIndex];
            const strokeWidth = Math.max(2, dimensions.width * 0.0025);
            const points = annotation.polygon?.points ?? [];
            const label = classNames[annotation.class_id] || `class_${annotation.class_id}`;

            if (annotation.obb) {
              const { x, y, width, height, angle_deg } = annotation.obb;
              const centerX = x * dimensions.width;
              const centerY = y * dimensions.height;
              const rectWidth = width * dimensions.width;
              const rectHeight = height * dimensions.height;
              return (
                <g key={annotation.id ?? `${annotation.class_id}-${index}`}>
                  <rect
                    fill={`${color}33`}
                    height={rectHeight}
                    stroke={color}
                    strokeWidth={strokeWidth}
                    transform={`rotate(${angle_deg} ${centerX} ${centerY})`}
                    width={rectWidth}
                    x={centerX - rectWidth / 2}
                    y={centerY - rectHeight / 2}
                  />
                </g>
              );
            }

            if (annotation.box) {
              const { x, y, width, height } = annotation.box;
              const rectWidth = width * dimensions.width;
              const rectHeight = height * dimensions.height;
              return (
                <g key={annotation.id ?? `${annotation.class_id}-${index}`}>
                  <rect
                    fill={`${color}33`}
                    height={rectHeight}
                    stroke={color}
                    strokeWidth={strokeWidth}
                    width={rectWidth}
                    x={x * dimensions.width - rectWidth / 2}
                    y={y * dimensions.height - rectHeight / 2}
                  />
                  <text
                    fill={color}
                    fontSize={Math.max(12, dimensions.width * 0.015)}
                    fontWeight="bold"
                    x={x * dimensions.width - rectWidth / 2}
                    y={y * dimensions.height - rectHeight / 2 - 4}
                  >
                    {label}
                  </text>
                </g>
              );
            }

            if (points.length > 0) {
              const pointsString = points
                .map(({ x, y }) => `${x * dimensions.width},${y * dimensions.height}`)
                .join(' ');
              return (
                <g key={annotation.id ?? `${annotation.class_id}-${index}`}>
                  <polygon fill={`${color}33`} points={pointsString} stroke={color} strokeWidth={strokeWidth} />
                  <text
                    fill={color}
                    fontSize={Math.max(12, dimensions.width * 0.015)}
                    fontWeight="bold"
                    x={points[0].x * dimensions.width}
                    y={points[0].y * dimensions.height - 4}
                  >
                    {label}
                  </text>
                </g>
              );
            }
            return null;
          })}
        </svg>
      )}
    </span>
  );
};

export const GalleryPage: React.FC = () => {
  const { datasetId } = useParams<{ datasetId: string }>();
  const navigate = useNavigate();

  const [items, setItems] = useState<GalleryItem[]>([]);
  const [itemsDatasetId, setItemsDatasetId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ datasetId: string; reloadKey: number; message: string } | null>(null);
  const [maskOpacity, setMaskOpacity] = useState(0.9);
  const [filter, setFilter] = useState<GalleryFilter>('all');
  const [allItemsCount, setAllItemsCount] = useState(0);
  const [splitFilter, setSplitFilter] = useState<SplitFilter>('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [objectCountFilter, setObjectCountFilter] = useState<ObjectCountFilter>('all');
  const [selectedClassState, setSelectedClassState] = useState({ datasetId, ids: [] as number[] });
  const selectedClassIds = useMemo(
    () => selectedClassState.datasetId === datasetId ? selectedClassState.ids : [],
    [datasetId, selectedClassState],
  );
  const setSelectedClassIds: React.Dispatch<React.SetStateAction<number[]>> = (action) => {
    setSelectedClassState((current) => {
      const currentIds = current.datasetId === datasetId ? current.ids : [];
      return { datasetId, ids: typeof action === 'function' ? action(currentIds) : action };
    });
  };
  const [pendingClassState, setPendingClassState] = useState({ datasetId, ids: [] as number[] });
  const pendingClassIds = useMemo(
    () => pendingClassState.datasetId === datasetId ? pendingClassState.ids : [],
    [datasetId, pendingClassState],
  );
  const setPendingClassIds: React.Dispatch<React.SetStateAction<number[]>> = (action) => {
    setPendingClassState((current) => {
      const currentIds = current.datasetId === datasetId ? current.ids : [];
      return { datasetId, ids: typeof action === 'function' ? action(currentIds) : action };
    });
  };
  const [classCatalogState, setClassCatalogState] = useState({
    datasetId,
    names: {} as Record<number, string>,
  });
  const classCatalog = classCatalogState.datasetId === datasetId ? classCatalogState.names : {};
  const [datasetTask, setDatasetTask] = useState('');
  const [totalItems, setTotalItems] = useState(0);
  const [labeledCount, setLabeledCount] = useState(0);
  const [unlabeledCount, setUnlabeledCount] = useState(0);
  const [page, setPage] = useState(1);
  const [itemsPage, setItemsPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [activeItem, setActiveItem] = useState<GalleryItem | null>(null);
  const pendingNavigation = useRef<'next' | 'previous' | null>(null);
  const classFilterRef = useRef<HTMLDetailsElement>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [canDeleteImages, setCanDeleteImages] = useState(false);
  const [deletingImageId, setDeletingImageId] = useState<number | null>(null);
  const [datasetRole, setDatasetRole] = useState<string | undefined>();
  const [datasetNameState, setDatasetNameState] = useState({ datasetId, name: '' });
  const [reviewingSampleId, setReviewingSampleId] = useState<number | null>(null);

  useEffect(() => {
    const closeClassFilterOnOutsideClick = (event: PointerEvent) => {
      const classFilter = classFilterRef.current;
      if (classFilter?.open && event.target instanceof Node && !classFilter.contains(event.target)) {
        classFilter.open = false;
      }
    };

    document.addEventListener('pointerdown', closeClassFilterOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeClassFilterOnOutsideClick);
  }, []);

  useEffect(() => {
    if (!datasetId) return;

    const controller = new AbortController();
    const loadPage = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          page_size: String(PAGE_SIZE),
        });
        if (splitFilter !== 'all') params.set('split', splitFilter);
        if (statusFilter !== 'all') params.set('status', statusFilter);
        if (objectCountFilter !== 'all') params.set('object_count', objectCountFilter);
        selectedClassIds.forEach((classId) => params.append('class_ids', String(classId)));

        const pageParams = new URLSearchParams(params);
        if (filter !== 'all') pageParams.set('labeled', String(filter === 'labeled'));
        const countParams = new URLSearchParams(params);
        countParams.set('page', '1');
        countParams.set('page_size', '1');

        const countRequest = filter === 'all'
          ? Promise.resolve(null)
          : apiClient.get<{ total: number }>(
              `/datasets/${datasetId}/samples?${countParams.toString()}`,
              { signal: controller.signal },
            );
        const [{ data }, countResponse] = await Promise.all([
          apiClient.get<{
            total: number;
            labeled_count: number;
            unlabeled_count: number;
            task: string;
            classes: Array<{ id: number; name: string; count: number }>;
            items: GalleryItem[];
          }>(`/datasets/${datasetId}/samples?${pageParams.toString()}`, { signal: controller.signal }),
          countRequest,
        ]);

        setItems(data.items);
        setItemsDatasetId(datasetId);
        setItemsPage(page);
        setTotalItems(data.total);
        setAllItemsCount(countResponse?.data.total ?? data.total);
        setLabeledCount(data.labeled_count);
        setUnlabeledCount(data.unlabeled_count);
        setDatasetTask(data.task);
        setClassCatalogState({
          datasetId,
          names: Object.fromEntries(data.classes.map(({ id, name }) => [id, name])),
        });
        if (pendingNavigation.current) {
          setActiveItem(pendingNavigation.current === 'next'
            ? data.items[0] || null
            : data.items[data.items.length - 1] || null);
          pendingNavigation.current = null;
        } else {
          setActiveItem((current) => current
            ? data.items.find((item) => item.id === current.id) || null
            : null);
        }
        setError(null);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError({
            datasetId,
            reloadKey,
            message: axios.isAxiosError(err)
              ? err.response?.data?.detail || 'Ошибка загрузки галереи'
              : 'Ошибка загрузки галереи',
          });
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    const timeout = window.setTimeout(() => { void loadPage(); }, 180);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [
    datasetId,
    page,
    splitFilter,
    statusFilter,
    objectCountFilter,
    filter,
    selectedClassIds,
    reloadKey,
  ]);

  useEffect(() => {
    if (!datasetId) return;
    let cancelled = false;

    apiClient.get('/datasets/')
      .then(({ data }) => {
        const dataset = (data.items || []).find((item: {
          id: number | string;
          name?: string;
          is_owner?: boolean;
          my_role?: string;
        }) => String(item.id) === datasetId);
        if (!cancelled) {
          const role = dataset?.is_owner ? 'owner' : dataset?.my_role;
          setDatasetRole(role);
          setCanDeleteImages(role === 'owner');
          setDatasetNameState({ datasetId, name: dataset?.name || '' });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCanDeleteImages(false);
          setDatasetRole(undefined);
          setDatasetNameState({ datasetId, name: '' });
        }
      });

    return () => { cancelled = true; };
  }, [datasetId]);

  const pageCount = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  const goToInputPage = () => {
    const requestedPage = Number(pageInput);
    if (!pageInput.trim() || !Number.isFinite(requestedPage)) {
      setPageInput(String(page));
      return;
    }

    const nextPage = Math.min(pageCount, Math.max(1, Math.trunc(requestedPage)));
    setPageInput(String(nextPage));
    if (nextPage !== page) setPage(nextPage);
  };

  const visibleItems = items;
  const activeIndex = activeItem
    ? items.findIndex((item) => item.id === activeItem.id)
    : -1;
  const showPreviousItem = useCallback(() => {
    if (activeIndex > 0) setActiveItem(items[activeIndex - 1]);
    else if (activeItem && page > 1) {
      pendingNavigation.current = 'previous';
      setPage((current) => current - 1);
    }
  }, [activeIndex, activeItem, items, page]);
  const showNextItem = useCallback(() => {
    if (activeIndex >= 0 && activeIndex < items.length - 1) {
      setActiveItem(items[activeIndex + 1]);
    } else if (activeItem && page < pageCount) {
      pendingNavigation.current = 'next';
      setPage((current) => current + 1);
    }
  }, [activeIndex, activeItem, items, page, pageCount]);

  useEffect(() => {
    if (!activeItem) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveItem(null);
      if (event.key === 'ArrowLeft') showPreviousItem();
      if (event.key === 'ArrowRight') showNextItem();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeItem, activeIndex, items, showNextItem, showPreviousItem]);

  const currentError = error && error.datasetId === datasetId && error.reloadKey === reloadKey ? error.message : null;
  const task = items[0]?.task || datasetTask;
  const firstItem = items[0];
  const availableClasses = Object.entries(classCatalog)
    .map(([id, name]) => ({ id: Number(id), name }))
    .sort((left, right) => left.id - right.id);
  const hasPendingClassChanges = pendingClassIds.length !== selectedClassIds.length
    || pendingClassIds.some((classId) => !selectedClassIds.includes(classId));
  const getVisibleObjectCount = (item: GalleryItem) => selectedClassIds.length > 0
    ? item.annotation_classes?.reduce(
      (count, itemClass) => selectedClassIds.includes(itemClass.id)
        ? count + itemClass.count
        : count,
      0,
    ) ?? 0
    : item.objects_count;

  const clearFilters = () => {
    setFilter('all');
    setSplitFilter('all');
    setStatusFilter('all');
    setObjectCountFilter('all');
    setSelectedClassIds([]);
    setPendingClassIds([]);
    setPage(1);
  };

  const deleteImage = async (item: GalleryItem) => {
    if (!datasetId || !canDeleteImages) return;
    const confirmed = window.confirm(`Удалить изображение «${item.filename}» из датасета? Это действие нельзя отменить.`);
    if (!confirmed) return;

    setDeletingImageId(item.id);
    try {
      await apiClient.delete(`/datasets/${datasetId}/gallery-item`, {
        params: { filename: item.filename, split: item.split || 'train' },
      });
      setReloadKey((key) => key + 1);
      setPage(1);
      setActiveItem((current) => current?.id === item.id ? null : current);
    } catch (requestError: any) {
      window.alert(requestError.response?.data?.detail || 'Не удалось удалить изображение. Попробуйте ещё раз.');
    } finally {
      setDeletingImageId(null);
    }
  };

  const updateReviewStatus = async (
    item: GalleryItem,
    action: 'submit-review' | 'review' | 'reopen',
    decision?: 'accepted' | 'rejected',
  ) => {
    if (!datasetId || !item.sample_id) return;

    setReviewingSampleId(item.sample_id);
    try {
      const url = `/datasets/${datasetId}/samples/${item.sample_id}/${action}`;
      const response = action === 'review'
        ? await apiClient.post(url, { decision })
        : await apiClient.post(url);
      setItems((current) => current.map((entry) => (
        entry.sample_id === item.sample_id
          ? { ...entry, status: response.data.status }
          : entry
      )));
    } catch (requestError) {
      const detail = axios.isAxiosError(requestError)
        ? requestError.response?.data?.detail
        : undefined;
      const message = typeof detail === 'string'
        ? detail
        : requestError instanceof Error
          ? requestError.message
          : 'Не удалось обновить статус кадра.';
      window.alert(message);
    } finally {
      setReviewingSampleId(null);
    }
  };

  const reviewStatusLabels: Record<string, string> = {
    unlabeled: 'Без разметки',
    in_progress: 'В работе',
    in_review: 'На проверке',
    accepted: 'Одобрено',
    rejected: 'На доработку',
  };

  if (loading && (items.length === 0 || itemsDatasetId !== datasetId)) {
    return (
      <section className="gallery-state" aria-live="polite">
        <span className="gallery-state__spinner" />
        Загрузка страницы галереи…
      </section>
    );
  }

  if (currentError) {
    return (
      <section className="gallery-state gallery-state--error" role="alert">
        <h1>Не удалось загрузить галерею</h1>
        <p>{currentError}</p>
        <button className="gallery-button gallery-button--primary" onClick={() => { setLoading(true); setReloadKey((key) => key + 1); }} type="button">Повторить</button>
      </section>
    );
  }

  return (
    <section className="gallery-page">
      <header className="gallery-heading">
        <div className="gallery-heading__copy">
          <button className="gallery-back" type="button" onClick={() => navigate('/')}>← Датасеты</button>
          <h1>{datasetNameState.datasetId === datasetId && datasetNameState.name
            ? datasetNameState.name
            : `Галерея #${datasetId}`}</h1>
          <p>{totalItems} кадров <span aria-hidden="true">·</span> {taskLabel(task)}</p>
        </div>
        <div className="gallery-heading__actions">
          <label className="gallery-opacity">
            <span>Разметка <strong>{Math.round(maskOpacity * 100)}%</strong></span>
            <input
              aria-label="Прозрачность маски"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={maskOpacity}
              style={{ '--range-progress': `${maskOpacity * 100}%` } as React.CSSProperties}
              onChange={(event) => setMaskOpacity(Number(event.target.value))}
            />
          </label>
          <button
            className="gallery-button gallery-button--primary"
            disabled={!firstItem}
            onClick={() => firstItem && setActiveItem(firstItem)}
            type="button"
          >
            Открыть разметку
          </button>
        </div>
      </header>

      <div className="gallery-toolbar">
      <div className="gallery-tabs" role="tablist" aria-label="Фильтр по статусу разметки">
        {([
          ['all', 'Все', allItemsCount],
          ['labeled', 'Размеченные', labeledCount],
          ['unlabeled', 'Без разметки', unlabeledCount],
        ] as const).map(([value, label, count]) => (
          <button
            aria-selected={filter === value}
            className={`gallery-tab${filter === value ? ' is-active' : ''}`}
            key={value}
            onClick={() => { setPage(1); setFilter(value); }}
            role="tab"
            type="button"
          >
            {label}<span>{count}</span>
          </button>
        ))}
      </div>
      <div className="gallery-filters" aria-label="Дополнительные фильтры">
        <label>
          Сплит
          <select value={splitFilter} onChange={(event) => { setPage(1); setSplitFilter(event.target.value as SplitFilter); }}>
            <option value="all">Все</option>
            <option value="train">Train</option>
            <option value="val">Val</option>
            <option value="test">Test</option>
          </select>
        </label>
        <label>
          Статус
          <select value={statusFilter} onChange={(event) => { setPage(1); setStatusFilter(event.target.value); }}>
            <option value="all">Все статусы</option>
            {REVIEW_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          Разметок на кадре
          <select value={objectCountFilter} onChange={(event) => { setPage(1); setObjectCountFilter(event.target.value as ObjectCountFilter); }}>
            <option value="all">Любое количество</option>
            <option value="none">Нет разметок</option>
            <option value="one">Одна</option>
            <option value="multiple">Несколько</option>
          </select>
        </label>
        {availableClasses.length > 0 && (
          <details className="gallery-class-filter" ref={classFilterRef}>
            <summary>Классы{pendingClassIds.length > 0 ? `: ${pendingClassIds.length}` : ''}</summary>
            <div className="gallery-class-filter__options">
              <div className="gallery-class-filter__list">
                <span>Показывать кадры с любым выбранным классом</span>
                {availableClasses.map(({ id, name }) => (
                  <label key={id}>
                    <input
                      checked={pendingClassIds.includes(id)}
                      onChange={(event) => {
                        setPage(1);
                        setPendingClassIds((current) => event.target.checked
                          ? [...current, id]
                          : current.filter((selectedId) => selectedId !== id));
                      }}
                      type="checkbox"
                    />
                    {name}
                  </label>
                ))}
              </div>
              <button
                disabled={!hasPendingClassChanges}
                onClick={() => {
                  setPage(1);
                  setSelectedClassIds(pendingClassIds);
                  if (classFilterRef.current) classFilterRef.current.open = false;
                }}
                type="button"
              >
                Применить
              </button>
            </div>
          </details>
        )}
        <button className="gallery-filter-reset" onClick={clearFilters} type="button">Сбросить</button>
      </div>
      </div>
      <div className={`gallery-results${loading ? ' is-loading' : ''}`} aria-busy={loading}>
        {visibleItems.length === 0 ? (
          <div className="gallery-empty">
            <h2>{totalItems ? 'Ничего не найдено' : 'Галерея пока пуста'}</h2>
            <p>{totalItems ? 'Измените запрос или выберите другой статус.' : 'В этом датасете пока нет изображений для показа.'}</p>
          </div>
        ) : (
          <div className="gallery-grid">
            {visibleItems.map((item) => {
            const isLabeled = item.objects_count > 0;
            return (
              <article className="gallery-card" key={item.id}>
                <button className="gallery-card__open" onClick={() => setActiveItem(item)} type="button">
                <span className="gallery-card__preview">
                  <GalleryImage
                    classNames={classCatalog}
                    item={item}
                    key={item.id}
                    opacity={maskOpacity}
                    selectedClassIds={selectedClassIds}
                  />
                  <span className="gallery-card__count">
                    {getVisibleObjectCount(item)} объектов
                  </span>
                </span>
                <span className="gallery-card__details">
                  <span className="gallery-card__filename" title={item.filename}>{item.filename}</span>
                  <span className="gallery-card__meta">
                    <span className={`gallery-status${isLabeled ? ' gallery-status--labeled' : ''}`}>
                      <i aria-hidden="true" />{reviewStatusLabels[item.status || ''] || (isLabeled ? 'Размечено' : 'Без разметки')}
                    </span>
                    <span className="gallery-card__task">{taskLabel(item.task)}</span>
                  </span>
                </span>
                </button>
                {item.sample_id && (
                  <div className="gallery-card__review">
                    {item.status === 'in_review' && datasetRole === 'owner' ? (
                      <>
                        <button
                          className="gallery-review-button gallery-review-button--accept"
                          disabled={reviewingSampleId === item.sample_id}
                          onClick={() => updateReviewStatus(item, 'review', 'accepted')}
                          type="button"
                        >
                          Одобрить
                        </button>
                        <button
                          className="gallery-review-button"
                          disabled={reviewingSampleId === item.sample_id}
                          onClick={() => updateReviewStatus(item, 'review', 'rejected')}
                          type="button"
                        >
                          На доработку
                        </button>
                      </>
                    ) : item.status === 'in_progress' && (datasetRole === 'owner' || datasetRole === 'labeler') ? (
                      <button
                        className="gallery-review-button"
                        disabled={reviewingSampleId === item.sample_id}
                        onClick={() => updateReviewStatus(item, 'submit-review')}
                        type="button"
                      >
                        Отправить на проверку
                      </button>
                    ) : item.status === 'rejected' && (datasetRole === 'owner' || datasetRole === 'labeler') ? (
                      <button
                        className="gallery-review-button"
                        disabled={reviewingSampleId === item.sample_id}
                        onClick={() => updateReviewStatus(item, 'reopen')}
                        type="button"
                      >
                        Вернуть в работу
                      </button>
                    ) : null}
                  </div>
                )}
                {canDeleteImages && (
                  <button
                    aria-label={`Удалить изображение ${item.filename}`}
                    className="gallery-card__delete"
                    disabled={deletingImageId === item.id}
                    onClick={() => deleteImage(item)}
                    title="Удалить изображение"
                    type="button"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m3 3v7m6-7v7" /></svg>
                  </button>
                )}
              </article>
            );
            })}
          </div>
        )}
      </div>

      {totalItems > 0 && (
        <footer className="gallery-pagination">
          <span>Показано {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalItems)} из {totalItems}</span>
          <div className="gallery-pagination__controls">
            <button aria-label="Предыдущая страница" disabled={page === 1} onClick={() => setPage((current) => current - 1)} type="button">Назад</button>
            <label className="gallery-pagination__page">
              <span>Страница</span>
              <input
                aria-label="Номер страницы"
                max={pageCount}
                min={1}
                onBlur={goToInputPage}
                onChange={(event) => setPageInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                }}
                type="number"
                value={pageInput}
              />
              <span aria-hidden="true">/ {pageCount}</span>
            </label>
            <button aria-label="Следующая страница" disabled={page === pageCount} onClick={() => setPage((current) => current + 1)} type="button">Далее</button>
          </div>
        </footer>
      )}

      {activeItem && (
        createPortal(
          <div className="gallery-modal" onClick={() => setActiveItem(null)} role="presentation">
            <section aria-label={`Просмотр кадра: ${activeItem.filename}`} aria-modal="true" className="gallery-modal__panel" onClick={(event) => event.stopPropagation()} role="dialog">
              <header className="gallery-modal__header">
                <div>
                  <h2>{activeItem.filename}</h2>
                  <p>{getVisibleObjectCount(activeItem)} объектов <span aria-hidden="true">·</span> {taskLabel(activeItem.task)}</p>
                </div>
                <span className="gallery-modal__position">
                  {(itemsPage - 1) * PAGE_SIZE + activeIndex + 1} / {totalItems}
                </span>
                <button aria-label="Закрыть просмотр" className="gallery-modal__close" onClick={() => setActiveItem(null)} type="button">×</button>
              </header>
              <div className="gallery-modal__image">
                <GalleryImage
                  classNames={classCatalog}
                  item={activeItem}
                  key={activeItem.id}
                  modal
                  opacity={maskOpacity}
                  selectedClassIds={selectedClassIds}
                />
                <button
                  aria-label="Предыдущий кадр"
                  className="gallery-modal__nav gallery-modal__nav--previous"
                  disabled={activeIndex <= 0 && page <= 1}
                  onClick={showPreviousItem}
                  type="button"
                >
                  ‹
                </button>
                <button
                  aria-label="Следующий кадр"
                  className="gallery-modal__nav gallery-modal__nav--next"
                  disabled={activeIndex < 0 || (activeIndex >= items.length - 1 && page >= pageCount)}
                  onClick={showNextItem}
                  type="button"
                >
                  ›
                </button>
              </div>
              <footer className="gallery-modal__footer">Используйте клавиши ← и → для перехода между кадрами · Esc — закрыть</footer>
            </section>
          </div>,
          document.body,
        )
      )}
    </section>
  );
};