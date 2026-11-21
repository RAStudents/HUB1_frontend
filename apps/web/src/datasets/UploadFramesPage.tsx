import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../api/client';
import { getApiErrorMessage } from '../api/errorMessage';
import { useDatasetDetails } from '../api/useDatasetDetails';
import { EditorIcon } from '../inspect/EditorIcon';
import { FRAME_EXTENSIONS, validateFrame } from './uploadValidation';
import { useFrameUploads, type UploadSplit } from './useFrameUploads';
interface ImportJob { import_id: number; status: string; stage: string; progress: number; error?: string; imported_samples: number }
export function UploadFramesPage() { const { datasetId = '' } = useParams(); return <UploadFrames key={datasetId} datasetId={datasetId} />; }
function UploadFrames({ datasetId }: { datasetId: string }) {
  const navigate = useNavigate();
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const { dataset, loading, error } = useDatasetDetails(datasetId);
  const { entries, add, remove, retry, clearErrors } = useFrameUploads(datasetId);
  const [split, setSplit] = useState<UploadSplit>('train');
  const [dragging, setDragging] = useState(false);
  const [job, setJob] = useState<ImportJob | null>(null);
  const [zipBusy, setZipBusy] = useState(false);
  const [zipError, setZipError] = useState('');
  const [zipProgress, setZipProgress] = useState(0);
  const filesRef = useRef<HTMLInputElement>(null), zipRef = useRef<HTMLInputElement>(null);
  const zipRequest = useRef<AbortController | null>(null);
  const gallery = `/datasets/${datasetId}/gallery`;
  const owner = dataset?.is_owner || dataset?.my_role === 'owner';
  const busy = entries.some(entry => entry.status === 'pending' || entry.status === 'uploading');
  const done = entries.filter(entry => entry.status === 'success').length;
  const failed = entries.filter(entry => entry.status === 'error').length;
  useEffect(() => () => zipRequest.current?.abort(), []);
  useEffect(() => {
    if (!busy && !zipBusy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [busy, zipBusy]);
  const importZip = async (file?: File) => {
    if (!file || zipBusy || busy || !owner) return;
    if (!file.name.toLowerCase().endsWith('.zip')) { setZipError('Выберите ZIP-архив с разметкой.'); return; }
    const controller = new AbortController(); zipRequest.current = controller;
    setZipBusy(true); setZipError(''); setJob(null); setZipProgress(0);
    try {
      const form = new FormData(); form.append('file', file);
      const { data } = await apiClient.post<ImportJob>(`/datasets/${datasetId}/samples/import-zip`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }, signal: controller.signal,
        onUploadProgress: event => setZipProgress(Math.min(99, Math.round(event.loaded * 100 / (event.total || file.size)))),
      });
      let current = data; setJob(current);
      while (current.status !== 'completed' && current.status !== 'failed') {
        await new Promise<void>((resolve, reject) => {
          const abort = () => { clearTimeout(timer); reject(new Error('Импорт прерван')); };
          const timer = window.setTimeout(() => { controller.signal.removeEventListener('abort', abort); resolve(); }, 1500);
          if (controller.signal.aborted) abort(); else controller.signal.addEventListener('abort', abort, { once: true });
        });
        const response = await apiClient.get<ImportJob>(`/datasets/imports/${current.import_id}`, { signal: controller.signal, timeout: 15000 });
        current = response.data; setJob(current);
      }
      if (current.status === 'failed') throw new Error(current.error || 'Не удалось импортировать разметку.');
    } catch (e) { if (!controller.signal.aborted) setZipError(getApiErrorMessage(e, 'Ошибка импорта архива.')); }
    finally { if (!controller.signal.aborted) setZipBusy(false); }
  };
  if (loading) return <div className="upload-frames-state" role="status">Загружаем датасет…</div>;
  if (error || !owner) return <section className="upload-frames-page"><Link className="page-back" to={gallery}>← В галерею</Link><h1>Загрузить кадры</h1><p role="alert">{error || 'Загружать кадры может только владелец датасета.'}</p></section>;
  return <section className="upload-frames-page">
    <Link className="page-back" to={gallery}>← {dataset?.name || 'В галерею'}</Link>
    <header><h1>Загрузить кадры</h1><p>Новые кадры появятся в датасете со статусом «Без разметки»</p></header>
    <div className={`frame-dropzone${dragging ? ' is-dragging' : ''}${zipBusy ? ' is-disabled' : ''}`} onDragOver={event => { event.preventDefault(); if (!zipBusy) setDragging(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }} onDrop={event => { event.preventDefault(); setDragging(false); if (!zipBusy) add(Array.from(event.dataTransfer.files), split); }}>
      <span className="frame-dropzone__icon"><EditorIcon name="upload" /></span><p>Перетащите кадры сюда</p>
      <button className="button button--primary" disabled={zipBusy} type="button" onClick={() => filesRef.current?.click()}>Выбрать файлы</button>
      <small>JPG, PNG, WebP, BMP, TIFF, HEIC · до 25 МБ каждый</small>
      <input ref={filesRef} type="file" multiple accept={FRAME_EXTENSIONS.map(ext => '.' + ext).join(',')} hidden onChange={event => { add(Array.from(event.target.files || []), split); event.target.value = ''; }} />
    </div>
    <div className="upload-split"><span>Добавить новые кадры в выборку</span><div role="group" aria-label="Выборка для новых кадров">{(['train','val','test'] as const).map(value => <button key={value} type="button" aria-pressed={split === value} onClick={() => setSplit(value)}>{value === 'train' ? 'Train' : value === 'val' ? 'Val' : 'Test'}</button>)}</div></div>
    {entries.length > 0 && <section className="frame-upload-queue" aria-label="Очередь загрузки"><div className="frame-upload-queue__heading"><span aria-live="polite">Загрузка · {done} из {entries.length} готово{failed > 0 ? `, ${failed} с ошибкой` : ''}</span>{failed > 0 && <button type="button" onClick={clearErrors}>× Очистить ошибки</button>}</div>
      {entries.map(entry => <article key={entry.id} className={`frame-upload-row is-${entry.status}`}>
        <div className="frame-upload-row__preview"><img src={entry.preview} alt="" onError={event => { event.currentTarget.style.visibility = 'hidden'; }} /></div>
        <div className="frame-upload-row__name"><strong title={entry.file.name}>{entry.file.name}</strong><small>{entry.file.size < 1024 * 1024 ? `${Math.max(1, Math.round(entry.file.size / 1024))} КБ` : `${(entry.file.size / 1024 / 1024).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} МБ`} · {entry.split === 'train' ? 'Train' : entry.split === 'val' ? 'Val' : 'Test'}</small></div>
        <div className="frame-upload-row__status">{entry.status === 'success' ? <span className="upload-success">✓ Загружен</span> : entry.status === 'error' ? <span role="alert" className="upload-error">ⓘ {entry.error}</span> : entry.status === 'pending' ? <span>В очереди</span> : <><progress max={100} value={entry.progress} aria-label={`Загрузка ${entry.file.name}`} /><span>{entry.progress >= 98 ? 'Обработка…' : `${entry.progress}%`}</span></>}</div>
        {entry.status === 'error' && !validateFrame(entry.file) && <button type="button" className="frame-upload-row__action" aria-label={`Повторить ${entry.file.name}`} onClick={() => retry(entry.id)}>Повторить</button>}
        {entry.status !== 'success' && <button type="button" className="frame-upload-row__action" aria-label={`${entry.status === 'uploading' ? 'Отменить' : 'Удалить'} ${entry.file.name}`} onClick={() => remove(entry.id)}>{entry.status === 'uploading' ? 'Отменить' : 'Удалить'}</button>}
      </article>)}
    </section>}
    <div className="upload-method-divider">или</div>
    <section className="upload-archive"><div><h2>Импорт готовой разметки</h2><p>Архив YOLO с изображениями, разметкой и data.yaml</p></div><button type="button" className="button button--quiet" disabled={busy || zipBusy} onClick={() => zipRef.current?.click()}><EditorIcon name="file" /> Загрузить архив</button><input ref={zipRef} hidden type="file" accept=".zip" onChange={event => { void importZip(event.target.files?.[0]); event.target.value = ''; }} /></section>
    {(zipBusy || job || zipError) && <div className="upload-archive-status" aria-live="polite">{zipError ? <p role="alert" className="upload-error">{zipError}</p> : job?.status === 'completed' ? <p className="upload-success">✓ Импортировано кадров: {job.imported_samples}</p> : <><p>{job ? `Импорт разметки · ${job.progress}%` : `Загрузка архива · ${zipProgress}%`}</p><progress max={100} value={job?.progress ?? zipProgress} /></>}</div>}
    <footer className="upload-frames-footer">
      <small>Готовые кадры сохраняются сразу.</small>
      <div className="upload-frames-footer__actions">
        <button className="button button--quiet" type="button" disabled={busy || zipBusy} onClick={() => navigate(gallery)}>Назад</button>
        <button className="button button--primary" type="button" disabled={busy || zipBusy} onClick={() => navigate(gallery)}>Готово</button>
      </div>
    </footer>
  </section>;
}
