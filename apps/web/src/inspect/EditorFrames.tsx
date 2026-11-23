import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { apiClient } from '../api/client';
import { getApiErrorMessage } from '../api/errorMessage';
import type { EditableAnnotation, ImageSize } from './annotationGeometry';
import { AnnotationShape } from './AnnotationShape';
import { EditorIcon } from './EditorIcon';
interface Frame {
  id: number; sample_id?: number | null; filename: string; image_url: string;
  split: string; status: string;
  objects_count?: number; annotations?: EditableAnnotation[];
}
const FRAME_SPLIT_OPTIONS = { all: 'Все', train: 'Train', val: 'Val', test: 'Test' };
const WORKFLOW_LABELS: Partial<Record<string, string>> = {
  in_progress: 'В работе',
  in_review: 'На проверке',
  accepted: 'Принят',
  rejected: 'На доработку',
};
export type FrameSplitFilter = keyof typeof FRAME_SPLIT_OPTIONS;

const SEARCH_BATCH_SIZE = 50;

interface SearchResults {
  items: Frame[];
  total: number;
  page: number;
  hasMore: boolean;
  error?: string;
}

interface Props {
  datasetId: string;
  split: FrameSplitFilter;
  onSplitChange: (split: FrameSplitFilter) => Promise<string | undefined>;
  onResize: (width: number) => void;
  items: Frame[]; selectedId: number; currentAnnotations: EditableAnnotation[]; position: number; total: number;
  classNames: Record<number, string>;
  busy: boolean; isFirst: boolean; isLast: boolean;
  onSelect: (id: number, fromSearch: boolean) => void; onMove: (direction: -1 | 1) => void;
}
function FramePreview({ src, annotations, classNames, selected }: {
  src: string;
  annotations: EditableAnnotation[];
  classNames: Record<number, string>;
  selected: boolean;
}) {
  const [size, setSize] = useState<ImageSize | null>(null);

  return (
    <div className="editor-frame__preview">
      <img
        src={src}
        alt=""
        loading="lazy"
        onLoad={({ currentTarget: image }) => {
          const width = 180;
          setSize({ width, height: width * image.naturalHeight / image.naturalWidth });
        }}
      />
      {size && annotations.length > 0 && (
        <svg className="editor-frame__annotations" aria-hidden="true" viewBox={`0 0 ${size.width} ${size.height}`} preserveAspectRatio="xMidYMid meet">
          {annotations.map((annotation, index) => (
            <AnnotationShape
              key={annotation.id ?? index}
              annotation={annotation}
              size={size}
              label={classNames[annotation.class_id] || `Класс ${annotation.class_id}`}
              preview
            />
          ))}
        </svg>
      )}
      {selected && <span className="editor-frame__selected"><EditorIcon name="check" /></span>}
    </div>
  );
}

export function EditorFrames({ datasetId, split, onSplitChange, onResize, items, selectedId, currentAnnotations, classNames, position, total, busy, isFirst, isLast, onSelect, onMove }: Props) {
  const drag = useRef<{ x: number; width: number } | null>(null);
  const filtersId = useId();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterMessage, setFilterMessage] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [onlyLabeled, setOnlyLabeled] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [searchAttempt, setSearchAttempt] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const searchTerm = searchOpen ? query.trim() : '';
  const searching = Boolean(searchTerm && !results?.error && searchPage > (results?.page ?? 0));
  const visible = searchTerm ? results?.items ?? [] : items.filter(item => (
    !onlyLabeled || ((item.sample_id ?? item.id) === selectedId
      ? currentAnnotations.length > 0
      : (item.objects_count ?? item.annotations?.length ?? 0) > 0)
  ));

  const resetSearchResults = () => {
    setResults(null);
    setSearchPage(1);
    if (listRef.current) listRef.current.scrollTop = 0;
  };

  useEffect(() => {
    if (!searchTerm) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const { data } = await apiClient.get<{ items: Frame[]; total: number }>(`/datasets/${datasetId}/samples`, {
          params: { search: searchTerm, labeled: onlyLabeled || undefined, page: searchPage, page_size: SEARCH_BATCH_SIZE },
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setResults(previous => {
          const accumulated = new Map((searchPage === 1 ? [] : previous?.items ?? [])
            .map(frame => [frame.sample_id ?? frame.id, frame]));
          data.items.forEach(frame => accumulated.set(frame.sample_id ?? frame.id, frame));
          return {
            items: Array.from(accumulated.values()),
            total: data.total,
            page: searchPage,
            hasMore: data.items.length === SEARCH_BATCH_SIZE && searchPage * SEARCH_BATCH_SIZE < data.total,
          };
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        setResults(previous => ({
          ...(previous ?? { items: [], total: 0, page: 0, hasMore: false }),
          error: getApiErrorMessage(error, 'Не удалось найти кадры.'),
        }));
      }
    }, searchPage === 1 ? 250 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [datasetId, searchTerm, searchPage, searchAttempt, onlyLabeled]);

  const loadMore = useCallback((list: HTMLDivElement) => {
    if (!searchTerm || !results?.hasMore || results.error || searchPage !== results.page) return;
    if (list.scrollHeight - list.clientHeight - list.scrollTop > 160) return;
    setSearchPage(page => page === results.page ? page + 1 : page);
  }, [searchTerm, results, searchPage]);

  useEffect(() => {
    if (listRef.current) loadMore(listRef.current);
  }, [loadMore]);

  return <aside className="editor-frames" aria-label="Кадры датасета">
    <div className="editor-frames__resize" role="separator" aria-orientation="vertical" aria-label="Ширина панели кадров" tabIndex={0}
      title="Потяните для изменения ширины; двойной щелчок — исходный размер"
      onPointerDown={event => {
        if (event.button !== 0) return;
        event.preventDefault();
        drag.current = { x: event.clientX, width: event.currentTarget.parentElement!.getBoundingClientRect().width };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        if (!drag.current) return;
        const minimum = window.innerWidth <= 760 ? 135 : window.innerWidth <= 1050 ? 150 : Math.min(210, Math.max(150, window.innerWidth * .15));
        onResize(Math.max(minimum, Math.min(Math.max(minimum, window.innerWidth / 4), drag.current.width + drag.current.x - event.clientX)));
      }}
      onPointerUp={event => { drag.current = null; event.currentTarget.releasePointerCapture(event.pointerId); }}
      onPointerCancel={() => { drag.current = null; }}
      onLostPointerCapture={() => { drag.current = null; }}
      onDoubleClick={() => onResize(0)}
      onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        event.stopPropagation();
        const width = event.currentTarget.parentElement!.getBoundingClientRect().width;
        onResize(event.key === 'Home' ? 0 : event.key === 'End' ? window.innerWidth / 4 : width + (event.key === 'ArrowLeft' ? 16 : -16));
      }}
    />
    <div className="editor-frames__heading"><h2>Кадры</h2><div>
      <button type="button" aria-label="Поиск по датасету" aria-expanded={searchOpen} onClick={() => {
        if (searchOpen) { setQuery(''); resetSearchResults(); }
        setSearchOpen(!searchOpen);
      }} title="Поиск по датасету"><EditorIcon name="search" /></button>
      <button
        type="button"
        aria-label="Фильтры кадров"
        aria-expanded={filtersOpen}
        aria-controls={filtersId}
        className={`editor-frames__filter-button${split !== 'all' || onlyLabeled ? ' is-filtered' : ''}`}
        onClick={() => setFiltersOpen(value => !value)}
        title="Фильтры кадров"
      ><EditorIcon name="filter" /></button>
    </div></div>
    {searchOpen && <div className="editor-frames__search">
      <input aria-label="Найти кадр в датасете" placeholder="Имя кадра…" value={query} maxLength={255} onChange={event => {
        const next = event.target.value;
        if (next.trim() !== query.trim()) resetSearchResults();
        setQuery(next);
      }} />
      <small role="status">{searchTerm && !results?.error
        ? (searching && !results ? 'Ищем по всему датасету…' : `Найдено: ${results?.total ?? 0}`)
        : 'Поиск по всему датасету'}</small>
    </div>}
    <div className="editor-frames__filters" id={filtersId} hidden={!filtersOpen}>
      {!searchTerm && <label>
        Кадры по выборке
        <select value={split} disabled={busy} onChange={async event => {
          const nextSplit = event.currentTarget.value as FrameSplitFilter;
          setFilterMessage('');
          setFilterMessage(await onSplitChange(nextSplit) ?? '');
        }}>
          {Object.entries(FRAME_SPLIT_OPTIONS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>}
      <label className="editor-frames__labeled">
        <input type="checkbox" checked={onlyLabeled} onChange={event => {
          resetSearchResults();
          setOnlyLabeled(event.target.checked);
        }} />
        {searchTerm ? 'Только размеченные' : 'Только размеченные на этой странице'}
      </label>
      {filterMessage && <span role="status">{filterMessage}</span>}
    </div>
    {!searchTerm && <nav className="editor-frames__navigation" aria-label="Навигация по кадрам">
      <button type="button" aria-label="Предыдущий кадр в панели" disabled={busy || isFirst} onClick={() => onMove(-1)}>‹</button><span>{position} / {total}</span><button type="button" aria-label="Следующий кадр в панели" disabled={busy || isLast} onClick={() => onMove(1)}>›</button>
    </nav>}
    <div className="editor-frames__list" ref={listRef} onScroll={event => loadMore(event.currentTarget)}>
      {visible.map(item => {
        const id = item.sample_id ?? item.id;
        const selected = id === selectedId;
        const annotations = selected ? currentAnnotations : item.annotations ?? [];
        const count = selected ? annotations.length : item.objects_count ?? annotations.length;
        const workflowLabel = WORKFLOW_LABELS[item.status];
        const status = workflowLabel ? item.status : count > 0 ? 'labeled' : 'unlabeled';
        const statusLabel = workflowLabel ?? (count > 0 ? 'Размечен' : 'Без разметки');
        return <button key={id} type="button" className={`editor-frame${selected ? ' is-selected' : ''}`} aria-current={selected ? 'true' : undefined} aria-label={`Открыть кадр ${item.filename}`} disabled={busy} onClick={() => onSelect(id, Boolean(searchTerm))}>
          <FramePreview key={item.image_url} src={item.image_url} annotations={annotations} classNames={classNames} selected={selected} />
          <div className="editor-frame__caption"><span title={item.filename}>{item.filename}</span><small><i />{item.split === 'val' || item.split === 'valid' ? 'Val' : item.split === 'test' ? 'Test' : 'Train'}</small></div>
          <div className="editor-frame__status" data-frame-status={status}><i aria-hidden="true" />{statusLabel} · {count} объект{count % 10 === 1 && count % 100 !== 11 ? '' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? 'а' : 'ов'}</div>
        </button>;
      })}
      {searchTerm && results?.error && <div className="editor-frames__empty">
        <p role="alert">{results.error}</p>
        <button className="button button--quiet" type="button" onClick={() => {
          setResults({ ...results, error: undefined });
          setSearchAttempt(attempt => attempt + 1);
        }}>Повторить</button>
      </div>}
      {searching && Boolean(results?.items.length) && <p role="status" className="editor-frames__empty">Загружаем ещё кадры…</p>}
      {visible.length === 0 && !searching && !results?.error && <p className="editor-frames__empty">
        {searchTerm ? 'Кадры с таким именем не найдены.' : 'На этой странице нет подходящих кадров.'}
      </p>}
    </div>
  </aside>;
}
