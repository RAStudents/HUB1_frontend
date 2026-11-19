import { useEffect, useState } from 'react';
import { apiClient } from './client';
import { getApiErrorMessage } from './errorMessage';
export interface DatasetDetails { id: string | number; name: string; task: string; is_owner?: boolean; my_role?: string; is_private?: boolean }
export function useDatasetDetails(id: string) {
  const [dataset, setDataset] = useState<DatasetDetails | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    apiClient.get<{ items: DatasetDetails[] }>('/datasets/', { signal: controller.signal, timeout: 15000 }).then(({ data }) => {
      if (controller.signal.aborted) return;
      const found = data.items.find(item => String(item.id) === id);
      if (!found) throw new Error('Датасет не найден или у вас нет доступа.');
      setDataset(found);
    }).catch(e => { if (!controller.signal.aborted) setError(getApiErrorMessage(e, 'Не удалось загрузить датасет.')); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id]);
  return { dataset, error, loading };
}
