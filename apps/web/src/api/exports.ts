import axios from 'axios';
import { apiClient } from './client';

interface ExportResponse {
  export_id: number;
  status: string;
  exported_samples: number;
}

export const downloadDatasetExport = async (
  datasetId: number | string,
  datasetName: string,
): Promise<number> => {
  try {
    const { data: exportResult } = await apiClient.post<ExportResponse>(
      `/datasets/${datasetId}/exports`,
    );
    if (exportResult.status !== 'completed') {
      throw new Error('Экспорт не завершён');
    }

    const { data: archive } = await apiClient.get<Blob>(
      `/datasets/${datasetId}/exports/${exportResult.export_id}/download`,
      { responseType: 'blob' },
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

    return exportResult.exported_samples;
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
