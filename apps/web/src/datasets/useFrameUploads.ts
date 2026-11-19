import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../api/client';
import { getApiErrorMessage } from '../api/errorMessage';
import { validateFrame } from './uploadValidation';
export type UploadSplit = 'train' | 'val' | 'test';
export interface FrameUpload { id: string; file: File; preview: string; split: UploadSplit; status: 'pending' | 'uploading' | 'success' | 'error'; progress: number; error?: string }
export function useFrameUploads(datasetId: string) {
  const [entries, setEntries] = useState<FrameUpload[]>([]);
  const records = useRef<FrameUpload[]>([]);
  const pending = useRef<FrameUpload[]>([]);
  const requests = useRef(new Map<string, AbortController>());
  const running = useRef(0);
  const mounted = useRef(true);
  const publish = useCallback(() => { if (mounted.current) setEntries([...records.current]); }, []);
  const patch = useCallback((id: string, changes: Partial<FrameUpload>) => {
    records.current = records.current.map(entry => entry.id === id ? { ...entry, ...changes } : entry); publish();
  }, [publish]);
  const pump = useCallback(function work() {
    if (!mounted.current) return;
    while (running.current < 2 && pending.current.length) {
      const entry = pending.current.shift()!;
      const controller = new AbortController(); requests.current.set(entry.id, controller); running.current++;
      patch(entry.id, { status: 'uploading', progress: 0, error: undefined });
      const form = new FormData(); form.append('files', entry.file); form.append('split', entry.split);
      void apiClient.post(`/datasets/${encodeURIComponent(datasetId)}/samples/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }, signal: controller.signal, timeout: 180000,
        onUploadProgress: event => patch(entry.id, { progress: Math.min(98, Math.round(event.loaded * 100 / (event.total || entry.file.size))) }),
      }).then(() => patch(entry.id, { status: 'success', progress: 100 }))
        .catch(e => patch(entry.id, { status: 'error', error: controller.signal.aborted ? 'Загрузка отменена' : getApiErrorMessage(e, 'Не удалось загрузить кадр') }))
        .finally(() => { requests.current.delete(entry.id); running.current--; work(); });
    }
  }, [datasetId, patch]);
  useEffect(() => {
    mounted.current = true;
    const activeRequests = requests.current;
    return () => {
      mounted.current = false; pending.current = []; activeRequests.forEach(controller => controller.abort());
      records.current.forEach(entry => URL.revokeObjectURL(entry.preview));
    };
  }, []);
  const add = (files: File[], split: UploadSplit) => {
    const added = files.map(file => {
      const error = validateFrame(file);
      return { id: crypto.randomUUID(), file, split, preview: URL.createObjectURL(file), status: error ? 'error' : 'pending', error, progress: 0 } as FrameUpload;
    });
    records.current = [...records.current, ...added]; pending.current.push(...added.filter(entry => entry.status === 'pending')); publish(); pump();
  };
  const remove = (id: string) => {
    requests.current.get(id)?.abort(); pending.current = pending.current.filter(entry => entry.id !== id);
    records.current.filter(entry => entry.id === id).forEach(entry => URL.revokeObjectURL(entry.preview));
    records.current = records.current.filter(entry => entry.id !== id); publish();
  };
  const retry = (id: string) => {
    const entry = records.current.find(entry => entry.id === id);
    if (!entry || entry.status !== 'error' || validateFrame(entry.file)) return;
    patch(id, { status: 'pending', error: undefined, progress: 0 }); pending.current.push(entry); pump();
  };
  return { entries, add, remove, retry, clearErrors: () => records.current.filter(entry => entry.status === 'error').forEach(entry => remove(entry.id)) };
}
