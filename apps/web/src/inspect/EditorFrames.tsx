import { useId, useRef, useState } from 'react';
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

interface Props {
  split: FrameSplitFilter;
  onSplitChange: (split: FrameSplitFilter) => Promise<string | undefined>;
  onResize: (width: number) => void;
  items: Frame[]; selectedId: number; currentAnnotations: EditableAnnotation[]; position: number; total: number;
  classNames: Record<number, string>;
  busy: boolean; isFirst: boolean; isLast: boolean;
  onSelect: (frame: Frame) => void; onMove: (direction: -1 | 1) => void;
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

export function EditorFrames({ split, onSplitChange, onResize, items, selectedId, currentAnnotations, classNames, position, total, busy, isFirst, isLast, onSelect, onMove }: Props) {
  const drag = useRef<{ x: number; width: number } | null>(null);
  const filtersId = useId();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterMessage, setFilterMessage] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [onlyLabeled, setOnlyLabeled] = useState(false);
  const visible = items.filter(item => item.filename.toLocaleLowerCase().includes(query.toLocaleLowerCase()) && (!onlyLabeled || ((item.sample_id ?? item.id) === selectedId ? currentAnnotations.length > 0 : (item.objects_count ?? item.annotations?.length ?? 0) > 0)));
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
      <button type="button" aria-label="Поиск кадров на странице" aria-expanded={searchOpen} onClick={() => setSearchOpen(value => !value)} title="Поиск на странице"><EditorIcon name="search" /></button>
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
    {searchOpen && <div className="editor-frames__search"><input aria-label="Найти кадр на странице" placeholder="Имя кадра…" value={query} onChange={event => setQuery(event.target.value)} /><small>Поиск на текущей странице</small></div>}
    <div className="editor-frames__filters" id={filtersId} hidden={!filtersOpen}>
      <label>
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
      </label>
      <label className="editor-frames__labeled">
        <input type="checkbox" checked={onlyLabeled} onChange={event => setOnlyLabeled(event.target.checked)} />
        Только размеченные на этой странице
      </label>
      {filterMessage && <span role="status">{filterMessage}</span>}
    </div>
    <nav className="editor-frames__navigation" aria-label="Навигация по кадрам">
      <button type="button" aria-label="Предыдущий кадр в панели" disabled={busy || isFirst} onClick={() => onMove(-1)}>‹</button><span>{position} / {total}</span><button type="button" aria-label="Следующий кадр в панели" disabled={busy || isLast} onClick={() => onMove(1)}>›</button>
    </nav>
    <div className="editor-frames__list">
      {visible.map(item => {
        const id = item.sample_id ?? item.id;
        const selected = id === selectedId;
        const annotations = selected ? currentAnnotations : item.annotations ?? [];
        const count = selected ? annotations.length : item.objects_count ?? annotations.length;
        const workflowLabel = WORKFLOW_LABELS[item.status];
        const status = workflowLabel ? item.status : count > 0 ? 'labeled' : 'unlabeled';
        const statusLabel = workflowLabel ?? (count > 0 ? 'Размечен' : 'Без разметки');
        return <button key={id} type="button" className={`editor-frame${selected ? ' is-selected' : ''}`} aria-current={selected ? 'true' : undefined} aria-label={`Открыть кадр ${item.filename}`} disabled={busy} onClick={() => onSelect(item)}>
          <FramePreview key={item.image_url} src={item.image_url} annotations={annotations} classNames={classNames} selected={selected} />
          <div className="editor-frame__caption"><span title={item.filename}>{item.filename}</span><small><i />{item.split === 'val' || item.split === 'valid' ? 'Val' : item.split === 'test' ? 'Test' : 'Train'}</small></div>
          <div className="editor-frame__status" data-frame-status={status}><i aria-hidden="true" />{statusLabel} · {count} объект{count % 10 === 1 && count % 100 !== 11 ? '' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? 'а' : 'ов'}</div>
        </button>;
      })}
      {visible.length === 0 && <p className="editor-frames__empty">На этой странице нет подходящих кадров.</p>}
    </div>
  </aside>;
}
