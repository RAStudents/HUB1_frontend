import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { apiClient } from '../api/client';

interface GalleryItem {
  id: number;
  sample_id?: number;
  filename: string;
  image_url: string;
  mask_url: string;
  objects_count: number;
  task: string;
  split?: string;
  status?: string;
  is_labeled?: boolean;
  visible_objects_count?: number;
  annotation_classes?: Array<{ id: number; name: string; count: number }>;
}

type GalleryFilter = 'all' | 'labeled' | 'unlabeled';
type ObjectCountFilter = 'all' | 'none' | 'one' | 'multiple';
type SplitFilter = 'all' | 'train' | 'val' | 'test';

const PAGE_SIZE = 12;
const GALLERY_BATCH_SIZE = 500;
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

export const GalleryPage: React.FC = () => {
  const { datasetId } = useParams<{ datasetId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const routerYaml = (location.state as { yamlPath?: string } | null)?.yamlPath;

  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ datasetId: string; reloadKey: number; message: string } | null>(null);
  const [maskOpacity, setMaskOpacity] = useState(0.9);
  const [filter, setFilter] = useState<GalleryFilter>('all');
  const [splitFilter, setSplitFilter] = useState<SplitFilter>('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [objectCountFilter, setObjectCountFilter] = useState<ObjectCountFilter>('all');
  const [selectedClassIds, setSelectedClassIds] = useState<number[]>([]);
  const [pendingClassIds, setPendingClassIds] = useState<number[]>([]);
  const [classCatalog, setClassCatalog] = useState<Record<number, string>>({});
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [activeItem, setActiveItem] = useState<GalleryItem | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [canDeleteImages, setCanDeleteImages] = useState(false);
  const [deletingImageId, setDeletingImageId] = useState<number | null>(null);
  const [datasetRole, setDatasetRole] = useState<string | undefined>();
  const [reviewingSampleId, setReviewingSampleId] = useState<number | null>(null);

  useEffect(() => {
    setClassCatalog({});
    setSelectedClassIds((current) => current.length > 0 ? [] : current);
    setPendingClassIds((current) => current.length > 0 ? [] : current);
  }, [datasetId]);

  useEffect(() => {
    if (routerYaml && datasetId) {
      localStorage.setItem(`dataset_${datasetId}_yaml`, routerYaml);
    }
  }, [routerYaml, datasetId]);

  useEffect(() => {
    if (!datasetId) return;

    let cancelled = false;
    const savedYaml = localStorage.getItem(`dataset_${datasetId}_yaml`);
    const yamlPath = routerYaml || savedYaml || undefined;

    setLoading(true);
    const loadGallery = async () => {
      try {
        const splits: SplitFilter[] = splitFilter === 'all'
          ? ['train', 'val', 'test']
          : [splitFilter];
        const galleryItems: GalleryItem[] = [];

        for (const split of splits) {
          let offset = 0;
          while (!cancelled) {
            const params = new URLSearchParams({
              split,
              limit: String(GALLERY_BATCH_SIZE),
              offset: String(offset),
            });
            if (yamlPath) params.set('yaml_path', yamlPath);
            selectedClassIds.forEach((classId) => params.append('class_ids', String(classId)));

            const response = await apiClient.get<GalleryItem[]>(
              `/datasets/${datasetId}/gallery?${params.toString()}`,
            );
            galleryItems.push(...response.data);
            if (response.data.length < GALLERY_BATCH_SIZE) break;
            offset += GALLERY_BATCH_SIZE;
          }
        }

        if (cancelled) return;
        setItems(galleryItems);
        setClassCatalog((current) => galleryItems.reduce(
          (catalog: Record<number, string>, item: GalleryItem) => {
            item.annotation_classes?.forEach(({ id, name }) => {
              catalog[id] = name;
            });
            return catalog;
          },
          { ...current },
        ));
        setActiveItem((current) => current
          ? galleryItems.find((item) => item.id === current.id) || current
          : null);
      } catch (err) {
        if (!cancelled) {
          setError({
            datasetId,
            reloadKey,
            message: axios.isAxiosError(err)
              ? err.response?.data?.detail || 'Ошибка загрузки галереи'
              : 'Ошибка загрузки галереи',
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadGallery();

    return () => { cancelled = true; };
  }, [datasetId, routerYaml, reloadKey, splitFilter, selectedClassIds]);

  useEffect(() => {
    if (!datasetId) return;
    let cancelled = false;

    apiClient.get('/datasets/')
      .then(({ data }) => {
        const dataset = (data.items || []).find((item: { id: number | string; is_owner?: boolean; my_role?: string }) => String(item.id) === datasetId);
        if (!cancelled) {
          const role = dataset?.is_owner ? 'owner' : dataset?.my_role;
          setDatasetRole(role);
          setCanDeleteImages(role === 'owner');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCanDeleteImages(false);
          setDatasetRole(undefined);
        }
      });

    return () => { cancelled = true; };
  }, [datasetId]);

  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredItems = items.filter((item) => {
    const matchesStatus = filter === 'all'
      || (filter === 'labeled' ? item.objects_count > 0 : item.objects_count === 0);
    const matchesReviewStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesObjectCount = objectCountFilter === 'all'
      || (objectCountFilter === 'none' && item.objects_count === 0)
      || (objectCountFilter === 'one' && item.objects_count === 1)
      || (objectCountFilter === 'multiple' && item.objects_count > 1);
    const matchesClasses = selectedClassIds.length === 0
      || selectedClassIds.some((classId) => item.annotation_classes?.some((itemClass) => itemClass.id === classId));
    return matchesStatus
      && matchesReviewStatus
      && matchesObjectCount
      && matchesClasses
      && item.filename.toLocaleLowerCase().includes(normalizedSearch);
  });
  const pageCount = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const visibleItems = filteredItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const activeIndex = activeItem
    ? filteredItems.findIndex((item) => item.id === activeItem.id)
    : -1;
  const showPreviousItem = () => {
    if (activeIndex > 0) setActiveItem(filteredItems[activeIndex - 1]);
  };
  const showNextItem = () => {
    if (activeIndex >= 0 && activeIndex < filteredItems.length - 1) {
      setActiveItem(filteredItems[activeIndex + 1]);
    }
  };

  useEffect(() => {
    if (!activeItem) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveItem(null);
      if (event.key === 'ArrowLeft') showPreviousItem();
      if (event.key === 'ArrowRight') showNextItem();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeItem, activeIndex, filteredItems]);

  const currentError = error && error.datasetId === datasetId && error.reloadKey === reloadKey ? error.message : null;
  const labeledCount = items.filter((item) => item.objects_count > 0).length;
  const task = items[0]?.task;
  const firstItem = filteredItems[0];
  const availableClasses = Object.entries(classCatalog)
    .map(([id, name]) => ({ id: Number(id), name }))
    .sort((left, right) => left.id - right.id);
  const hasPendingClassChanges = pendingClassIds.length !== selectedClassIds.length
    || pendingClassIds.some((classId) => !selectedClassIds.includes(classId));

  const clearFilters = () => {
    setFilter('all');
    setSplitFilter('all');
    setStatusFilter('all');
    setObjectCountFilter('all');
    setSelectedClassIds([]);
    setPendingClassIds([]);
    setSearch('');
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
      setItems((current) => current.filter((entry) => entry.id !== item.id));
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

  if (loading) {
    return <section className="gallery-state" aria-live="polite"><span className="gallery-state__spinner" />Генерация масок и загрузка датасета...</section>;
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
          <h1>Галерея <span>#{datasetId}</span></h1>
          <p>{items.length} кадров <span aria-hidden="true">·</span> {taskLabel(task)}</p>
        </div>
        <div className="gallery-heading__actions">
          <label className="gallery-opacity">
            <span>Маска <strong>{Math.round(maskOpacity * 100)}%</strong></span>
            <input
              aria-label="Прозрачность маски"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={maskOpacity}
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
            ['all', 'Все', items.length],
            ['labeled', 'Размеченные', labeledCount],
            ['unlabeled', 'Без разметки', items.length - labeledCount],
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
        <label className="gallery-search">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></svg>
          <input
            aria-label="Поиск по имени файла"
            onChange={(event) => { setPage(1); setSearch(event.target.value); }}
            placeholder="Поиск по имени файла"
            type="search"
            value={search}
          />
        </label>
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
          <details className="gallery-class-filter">
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
                }}
                type="button"
              >
                Применить
              </button>
            </div>
          </details>
        )}
        {pendingClassIds.map((classId) => (
          <button
            className="gallery-filter-reset"
            key={classId}
            onClick={() => {
              setPage(1);
              setPendingClassIds((current) => current.filter((id) => id !== classId));
            }}
            type="button"
          >
            {classCatalog[classId] || `Класс ${classId}`} ×
          </button>
        ))}
        <button className="gallery-filter-reset" onClick={clearFilters} type="button">Сбросить</button>
      </div>

      {visibleItems.length === 0 ? (
        <div className="gallery-empty">
          <h2>{items.length ? 'Ничего не найдено' : 'Галерея пока пуста'}</h2>
          <p>{items.length ? 'Измените запрос или выберите другой статус.' : 'В этом датасете пока нет изображений для показа.'}</p>
        </div>
      ) : (
        <div className="gallery-grid">
          {visibleItems.map((item) => {
            const isLabeled = item.objects_count > 0;
            return (
              <article className="gallery-card" key={item.id}>
                <button className="gallery-card__open" onClick={() => setActiveItem(item)} type="button">
                <span className="gallery-card__preview">
                  <img alt="" className="gallery-card__image" loading="lazy" src={item.image_url} />
                  {item.mask_url && <img alt="" className="gallery-card__mask" loading="lazy" src={item.mask_url} style={{ opacity: maskOpacity }} />}
                  <span className="gallery-card__count">
                    {selectedClassIds.length > 0 ? item.visible_objects_count : item.objects_count} объектов
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

      {filteredItems.length > 0 && (
        <footer className="gallery-pagination">
          <span>Показано {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredItems.length)} из {filteredItems.length}</span>
          <div className="gallery-pagination__controls">
            <button aria-label="Предыдущая страница" disabled={page === 1} onClick={() => setPage((current) => current - 1)} type="button">Назад</button>
            <span>{page} / {pageCount}</span>
            <button aria-label="Следующая страница" disabled={page === pageCount} onClick={() => setPage((current) => current + 1)} type="button">Далее</button>
          </div>
        </footer>
      )}

      {activeItem && (
        <div className="gallery-modal" onClick={() => setActiveItem(null)} role="presentation">
          <section aria-label={`Просмотр кадра: ${activeItem.filename}`} aria-modal="true" className="gallery-modal__panel" onClick={(event) => event.stopPropagation()} role="dialog">
            <header className="gallery-modal__header">
              <div>
                <h2>{activeItem.filename}</h2>
                <p>{activeItem.objects_count} объектов <span aria-hidden="true">·</span> {taskLabel(activeItem.task)}</p>
              </div>
              <span className="gallery-modal__position">{activeIndex + 1} / {filteredItems.length}</span>
              <button aria-label="Закрыть просмотр" className="gallery-modal__close" onClick={() => setActiveItem(null)} type="button">×</button>
            </header>
            <div className="gallery-modal__image">
              <img alt={activeItem.filename} src={activeItem.image_url} />
              {activeItem.mask_url && <img alt="" src={activeItem.mask_url} style={{ opacity: maskOpacity }} />}
              <button
                aria-label="Предыдущий кадр"
                className="gallery-modal__nav gallery-modal__nav--previous"
                disabled={activeIndex <= 0}
                onClick={showPreviousItem}
                type="button"
              >
                ‹
              </button>
              <button
                aria-label="Следующий кадр"
                className="gallery-modal__nav gallery-modal__nav--next"
                disabled={activeIndex < 0 || activeIndex >= filteredItems.length - 1}
                onClick={showNextItem}
                type="button"
              >
                ›
              </button>
            </div>
            <footer className="gallery-modal__footer">Используйте клавиши ← и → для перехода между кадрами · Esc — закрыть</footer>
          </section>
        </div>
      )}
    </section>
  );
};