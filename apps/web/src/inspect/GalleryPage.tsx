import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../api/client';

interface GalleryItem {
  id: number;
  filename: string;
  image_url: string;
  mask_url: string;
  objects_count: number;
  task: string;
  split?: string;
}

type GalleryFilter = 'all' | 'labeled' | 'unlabeled';

const PAGE_SIZE = 12;

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
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [activeItem, setActiveItem] = useState<GalleryItem | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [canDeleteImages, setCanDeleteImages] = useState(false);
  const [deletingImageId, setDeletingImageId] = useState<number | null>(null);

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

    apiClient.get(`/datasets/${datasetId}/gallery`, {
      params: { yaml_path: yamlPath, split: 'train', limit: 50 },
    })
      .then((response) => {
        if (!cancelled) setItems(response.data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError({
            datasetId,
            reloadKey,
            message: err.response?.data?.detail || 'Ошибка загрузки галереи',
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [datasetId, routerYaml, reloadKey]);

  useEffect(() => {
    if (!datasetId) return;
    let cancelled = false;

    apiClient.get('/datasets/')
      .then(({ data }) => {
        const dataset = (data.items || []).find((item: { id: number | string; is_owner?: boolean; my_role?: string }) => String(item.id) === datasetId);
        if (!cancelled) setCanDeleteImages(Boolean(dataset?.is_owner || dataset?.my_role === 'owner'));
      })
      .catch(() => {
        if (!cancelled) setCanDeleteImages(false);
      });

    return () => { cancelled = true; };
  }, [datasetId]);

  useEffect(() => {
    if (!activeItem) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveItem(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeItem]);

  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredItems = items.filter((item) => {
    const matchesStatus = filter === 'all'
      || (filter === 'labeled' ? item.objects_count > 0 : item.objects_count === 0);
    return matchesStatus && item.filename.toLocaleLowerCase().includes(normalizedSearch);
  });
  const pageCount = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const visibleItems = filteredItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const currentError = error && error.datasetId === datasetId && error.reloadKey === reloadKey ? error.message : null;
  const labeledCount = items.filter((item) => item.objects_count > 0).length;
  const task = items[0]?.task;
  const firstItem = filteredItems[0];

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
                  <span className="gallery-card__count">{item.objects_count} объектов</span>
                </span>
                <span className="gallery-card__details">
                  <span className="gallery-card__filename" title={item.filename}>{item.filename}</span>
                  <span className="gallery-card__meta">
                    <span className={`gallery-status${isLabeled ? ' gallery-status--labeled' : ''}`}>
                      <i aria-hidden="true" />{isLabeled ? 'Размечено' : 'Без разметки'}
                    </span>
                    <span className="gallery-card__task">{taskLabel(item.task)}</span>
                  </span>
                </span>
                </button>
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
          <section aria-label={`Разметка: ${activeItem.filename}`} aria-modal="true" className="gallery-modal__panel" onClick={(event) => event.stopPropagation()} role="dialog">
            <header className="gallery-modal__header">
              <div><h2>{activeItem.filename}</h2><p>{activeItem.objects_count} объектов <span aria-hidden="true">·</span> {taskLabel(activeItem.task)}</p></div>
              <button aria-label="Закрыть просмотр" className="gallery-modal__close" onClick={() => setActiveItem(null)} type="button">×</button>
            </header>
            <div className="gallery-modal__image">
              <img alt={activeItem.filename} src={activeItem.image_url} />
              {activeItem.mask_url && <img alt="" src={activeItem.mask_url} style={{ opacity: maskOpacity }} />}
            </div>
          </section>
        </div>
      )}
    </section>
  );
};