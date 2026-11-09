import axios from 'axios';
import { apiClient } from './client';

interface ExportResponse {
  export_id: number;
  status: 'processing' | 'completed' | 'failed';
  stage: 'processing' | 'validating' | 'packaging' | 'uploading' | 'finalizing' | 'completed' | 'failed';
  exported_samples: number;
  total_samples: number;
  progress: number;
  error?: string | null;
}

export interface ExportProgress {
  stage: ExportResponse['stage'] | 'downloading';
  progress: number;
  exported_samples: number;
  total_samples: number;
  downloaded_bytes?: number;
  total_download_bytes?: number;
}

export const getExportProgressLabel = (progress: ExportProgress): string => {
  if (progress.stage === 'downloading') {
    if (!progress.downloaded_bytes) return 'Подготавливаем архив к скачиванию…';
    const downloaded = (progress.downloaded_bytes / 1_000_000).toFixed(0);
    const total = progress.total_download_bytes
      ? ` из ${(progress.total_download_bytes / 1_000_000).toFixed(0)} МБ`
      : ' МБ';
    return `Скачиваем архив: ${downloaded}${total}`;
  }

  const labels: Record<string, string> = {
    processing: `Обработка кадров: ${progress.exported_samples} из ${progress.total_samples}`,
    validating: 'Проверяем собранный датасет…',
    packaging: 'Упаковываем архив…',
    uploading: 'Сохраняем архив…',
    finalizing: 'Завершаем экспорт…',
    completed: 'Экспорт завершён',
    failed: 'Ошибка экспорта',
  };
  return labels[progress.stage];
};

const wait = (milliseconds: number) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

export const downloadDatasetExport = async (
  datasetId: number | string,
  datasetName: string,
  onProgress?: (progress: ExportProgress) => void,
): Promise<number> => {
  try {
    const { data: exportResult } = await apiClient.post<ExportResponse>(
      `/datasets/${datasetId}/exports`,
    );
    onProgress?.(exportResult);

    let result = exportResult;
    while (result.status === 'processing') {
      await wait(1000);
      const { data } = await apiClient.get<ExportResponse>(
        `/datasets/${datasetId}/exports/${result.export_id}`,
      );
      result = data;
      onProgress?.(result);
    }

    if (result.status === 'failed') {
      throw new Error(result.error || 'Не удалось собрать архив экспорта.');
    }

    onProgress?.({
      stage: 'downloading',
      progress: 0,
      exported_samples: result.exported_samples,
      total_samples: result.total_samples,
    });
    const { data: archive } = await apiClient.get<Blob>(
      `/datasets/${datasetId}/exports/${result.export_id}/download`,
      {
        responseType: 'blob',
        onDownloadProgress: (event) => {
          const total = event.total ?? 0;
          onProgress?.({
            stage: 'downloading',
            progress: total ? Math.floor((event.loaded / total) * 100) : 0,
            exported_samples: result.exported_samples,
            total_samples: result.total_samples,
            downloaded_bytes: event.loaded,
            total_download_bytes: total,
          });
        },
      },
    );

    const url = URL.createObjectURL(archive);
    const link = document.createElement('a');
    link.href = url;
    const safeDatasetName = datasetName
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
      .trim()
      .replace(/[. ]+$/g, '') || `dataset_${datasetId}`;
    link.download = `${safeDatasetName}.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);

    return result.exported_samples;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      let detail: unknown = error.response?.data?.detail;
      if (error.response?.data instanceof Blob) {
        try {
          detail = JSON.parse(await error.response.data.text()).detail;
        } catch {
          detail = undefined;
        }
      }
      throw new Error(typeof detail === 'string' ? detail : error.message);
    }
    throw error;
  }
};
