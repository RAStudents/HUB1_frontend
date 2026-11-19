import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useDatasetDetails } from '../api/useDatasetDetails';
import { DatasetStatisticsPanel } from '../inspect/DatasetStatisticsPanel';
export function DatasetStatisticsPage() {
  const { datasetId = '' } = useParams();
  return <StatisticsContent key={datasetId} id={datasetId} />;
}
function StatisticsContent({ id }: { id: string }) {
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const { dataset, error, loading } = useDatasetDetails(id);
  return <section className="dataset-statistics-page"><Link className="page-back" to={`/datasets/${id}/gallery`}>← {dataset?.name || 'В галерею'}</Link><header><div><p>АНАЛИТИКА ДАТАСЕТА</p><h1>Статистика</h1><span>{dataset?.name || (loading ? 'Загружаем датасет…' : '')}</span></div><Link className="button button--quiet" to={`/datasets/${id}/gallery`}>Открыть галерею →</Link></header>{error ? <p className="form-alert" role="alert">{error}</p> : loading ? <p role="status">Загружаем датасет…</p> : <DatasetStatisticsPanel key={id} datasetId={id} reloadKey={0} />}</section>;
}
