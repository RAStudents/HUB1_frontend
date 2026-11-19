import { useState } from 'react';
import { EditorIcon } from './EditorIcon';
interface Frame {
  id: number; sample_id?: number | null; filename: string; image_url: string;
  thumb_url?: string | null; split: string; status: string;
  objects_count?: number; annotations?: unknown[];
}
interface Props {
  items: Frame[]; selectedId: number; currentAnnotations: number; position: number; total: number;
  busy: boolean; isFirst: boolean; isLast: boolean;
  onSelect: (frame: Frame) => void; onMove: (direction: -1 | 1) => void;
}
export function EditorFrames({ items, selectedId, currentAnnotations, position, total, busy, isFirst, isLast, onSelect, onMove }: Props) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [onlyLabeled, setOnlyLabeled] = useState(false);
  const visible = items.filter(item => item.filename.toLocaleLowerCase().includes(query.toLocaleLowerCase()) && (!onlyLabeled || ((item.sample_id ?? item.id) === selectedId ? currentAnnotations > 0 : (item.objects_count ?? item.annotations?.length ?? 0) > 0)));
  return <aside className="editor-frames" aria-label="Кадры датасета">
    <div className="editor-frames__heading"><h2>Кадры</h2><div>
      <button type="button" aria-label="Поиск кадров на странице" aria-expanded={searchOpen} onClick={() => setSearchOpen(value => !value)} title="Поиск на странице"><EditorIcon name="search" /></button>
      <button type="button" aria-label="Только размеченные кадры" aria-pressed={onlyLabeled} onClick={() => setOnlyLabeled(value => !value)} title="Только размеченные"><EditorIcon name="filter" /></button>
    </div></div>
    {searchOpen && <div className="editor-frames__search"><input aria-label="Найти кадр на странице" placeholder="Имя кадра…" value={query} onChange={event => setQuery(event.target.value)} /><small>Поиск на текущей странице</small></div>}
    <nav className="editor-frames__navigation" aria-label="Навигация по кадрам">
      <button type="button" aria-label="Предыдущий кадр в панели" disabled={busy || isFirst} onClick={() => onMove(-1)}>‹</button><span>{position} / {total}</span><button type="button" aria-label="Следующий кадр в панели" disabled={busy || isLast} onClick={() => onMove(1)}>›</button>
    </nav>
    <div className="editor-frames__list">
      {visible.map(item => {
        const id = item.sample_id ?? item.id;
        const selected = id === selectedId;
        const count = selected ? currentAnnotations : item.objects_count ?? item.annotations?.length ?? 0;
        const status = item.status === 'in_review' ? 'На проверке' : item.status === 'accepted' ? 'Принят' : item.status === 'rejected' ? 'На доработку' : count > 0 ? 'Размечен' : 'Без разметки';
        return <button key={id} type="button" className={`editor-frame${selected ? ' is-selected' : ''}`} aria-current={selected ? 'true' : undefined} aria-label={`Открыть кадр ${item.filename}`} disabled={busy} onClick={() => onSelect(item)}>
          <div className="editor-frame__preview"><img src={item.thumb_url || item.image_url} alt="" loading="lazy" />{selected && <span className="editor-frame__selected"><EditorIcon name="check" /></span>}</div>
          <div className="editor-frame__caption"><span title={item.filename}>{item.filename}</span><small><i />{item.split === 'val' || item.split === 'valid' ? 'Val' : item.split === 'test' ? 'Test' : 'Train'}</small></div>
          <div className={`editor-frame__status${count > 0 ? ' is-labeled' : ''}`}><span>{count > 0 ? '✓' : '○'}</span>{status} · {count} объект{count % 10 === 1 && count % 100 !== 11 ? '' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? 'а' : 'ов'}</div>
        </button>;
      })}
      {visible.length === 0 && <p className="editor-frames__empty">На этой странице нет подходящих кадров.</p>}
    </div>
  </aside>;
}
