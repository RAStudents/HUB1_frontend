import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { apiClient } from '../api/client';
import { getApiErrorMessage } from '../api/errorMessage';
import { useAuth } from '../auth/AuthContext';
import { EditorIcon } from './EditorIcon';
interface Comment { id: number; user_id: number; author_name: string; body: string; parent_id: number | null; annotation_index: number | null; resolved: boolean; created_at: string }
interface Props { datasetId: string; sampleId: number; annotationIndex: number | null; canWrite: boolean; isOwner: boolean; active: boolean; onCountChange: (count: number) => void; onUnreadCountChange: (count: number) => void }
export function EditorComments({ datasetId, sampleId, annotationIndex, canWrite, isOwner, active, onCountChange, onUnreadCountChange }: Props) {
  const { user } = useAuth();
  const feedRef = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);
  const lastReadComment = useRef({ key: '', id: 0 });
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const url = `/datasets/${datasetId}/samples/${sampleId}/comments`;

  useLayoutEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;

    const scrollToLatest = () => {
      if (followLatest.current && feed.clientHeight > 0) {
        feed.scrollTop = feed.scrollHeight;
      }
    };

    scrollToLatest();
    const observer = new ResizeObserver(scrollToLatest);
    observer.observe(feed);
    return () => observer.disconnect();
  }, [comments.length]);

  useEffect(() => {
    const controller = new AbortController();
    onCountChange(0);
    apiClient.get<Comment[]>(url, { signal: controller.signal }).then(({ data }) => {
      setComments(data); onCountChange(data.filter(c => c.parent_id === null && !c.resolved).length);
    }).catch(e => { if (!controller.signal.aborted) setError(getApiErrorMessage(e, 'Не удалось загрузить комментарии.')); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [url, onCountChange]);

  const userId = user?.id;
  useEffect(() => {
    if (!userId || loading) {
      onUnreadCountChange(0);
      return;
    }

    const key = `hub:comments:last-read:${userId}:${datasetId}:${sampleId}`;
    if (lastReadComment.current.key !== key) {
      let id = 0;
      try {
        id = Number(window.localStorage.getItem(key)) || 0;
      } catch {
        // Keep the read state in memory when browser storage is unavailable.
      }
      lastReadComment.current = { key, id };
    }

    const unread = comments.filter(comment => String(comment.user_id) !== userId && comment.id > lastReadComment.current.id);
    onUnreadCountChange(active ? 0 : unread.length);
    if (active && unread.length > 0) {
      const id = unread.reduce((latest, comment) => Math.max(latest, comment.id), lastReadComment.current.id);
      lastReadComment.current.id = id;
      try {
        window.localStorage.setItem(key, String(id));
      } catch {
        // The current editor still keeps the read state in memory.
      }
    }
  }, [active, comments, datasetId, loading, onUnreadCountChange, sampleId, userId]);

  const update = (next: Comment[]) => { setComments(next); onCountChange(next.filter(c => c.parent_id === null && !c.resolved).length); };
  const send = async (event: React.FormEvent) => {
    event.preventDefault(); if (!body.trim() || busy) return;
    setBusy(true); setError('');
    try {
      const { data } = await apiClient.post<Comment>(url, { body: body.trim(), parent_id: replyTo?.id ?? null, annotation_index: replyTo ? replyTo.annotation_index : annotationIndex });
      update([...comments, data]); setBody(''); setReplyTo(null);
    } catch (e) { setError(getApiErrorMessage(e, 'Не удалось отправить комментарий.')); }
    finally { setBusy(false); }
  };
  const resolve = async (comment: Comment) => {
    setBusy(true); setError('');
    try {
      const { data } = await apiClient.post<Comment>(`${url}/${comment.id}/resolve`, null, { params: { resolved: !comment.resolved } });
      update(comments.map(c => c.id === data.id ? data : c));
    } catch (e) { setError(getApiErrorMessage(e, 'Не удалось изменить статус.')); }
    finally { setBusy(false); }
  };
  const renderComment = (comment: Comment) => <div className="editor-comment" key={comment.id}>
    <div className="editor-comment__author"><span className="editor-comment__avatar" style={{ background: ['#3478d8', 'var(--app-accent-dark)', '#c17e28'][Math.abs(comment.user_id) % 3] }}>{comment.author_name.trim().slice(0, 2).toUpperCase()}</span><strong>{comment.author_name}</strong><time dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</time></div><p>{comment.body}</p>
  </div>;
  return <div className="editor-discussion">
    <div
      ref={feedRef}
      className="editor-discussion__feed"
      aria-live="polite"
      onScroll={event => {
        const feed = event.currentTarget;
        if (feed.clientHeight > 0) {
          followLatest.current = feed.scrollHeight - feed.clientHeight - feed.scrollTop <= 2;
        }
      }}
    >
      {loading && <p className="editor-discussion__empty">Загружаем обсуждения…</p>}
      {!loading && comments.length === 0 && <div className="editor-discussion__empty"><EditorIcon name="comment" /><p>Обсудите разметку</p><span>Выберите объект, чтобы оставить комментарий к нему, или напишите ко всему кадру.</span></div>}
      {comments.filter(c => c.parent_id === null).map(comment => <article className={`editor-thread${comment.resolved ? ' is-resolved' : ''}${comment.annotation_index === annotationIndex && annotationIndex !== null ? ' is-linked' : ''}`} key={comment.id}>
        {comment.resolved && <span className="editor-thread__resolved"><EditorIcon name="check" /> Решено</span>}{renderComment(comment)}
        <span className="editor-thread__context">{comment.annotation_index === null ? '▧ Ко всему кадру' : `К объекту #${comment.annotation_index + 1}`}</span>
        {comments.filter(c => c.parent_id === comment.id).map(renderComment)}
        <div className="editor-thread__actions">{canWrite && <button type="button" onClick={() => setReplyTo(comment)}>Ответить</button>}{canWrite && (isOwner || String(comment.user_id) === user?.id) && <button type="button" disabled={busy} onClick={() => void resolve(comment)}>{comment.resolved ? 'Открыть снова' : '✓ Отметить решённым'}</button>}</div>
      </article>)}
    </div>
    <form className="editor-discussion__composer" onSubmit={event => void send(event)}>
      {error && <p role="alert" className="editor-discussion__error">{error}</p>}
      {replyTo && <div className="editor-discussion__reply">Ответ: {replyTo.author_name}<button aria-label="Отменить ответ" type="button" onClick={() => setReplyTo(null)}>×</button></div>}
      <div className="editor-discussion__input-row">
        <div className="editor-discussion__input" data-value={body}>
          <textarea
            aria-label="Комментарий"
            placeholder={canWrite ? 'Написать комментарий…' : 'Комментарии доступны для чтения'}
            rows={1}
            maxLength={2000}
            disabled={!canWrite || busy}
            value={body}
            onChange={event => setBody(event.target.value)}
          />
        </div>
        <button className="editor-discussion__send" aria-label="Отправить комментарий" disabled={!canWrite || busy || !body.trim()} type="submit"><EditorIcon name="send" /></button>
      </div>
      <small>{replyTo ? 'Ответ в обсуждении' : annotationIndex === null ? 'Комментарий ко всему кадру' : `Привяжется к выбранному объекту: #${annotationIndex + 1}`}</small>
    </form>
  </div>;
}
