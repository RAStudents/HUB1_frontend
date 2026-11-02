// apps/web/src/datasets/DashboardPage.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useRole } from '../auth/roles';

interface DatasetItem {
  id: number;
  name: string;
  task: 'detect' | 'obb' | 'segment';
  description?: string;
  is_private: boolean;
  images_count: number;
  cover_url?: string;
  classes: string[];
}

const taskNames: Record<string, string> = {
  detect: 'Bounding Box',
  obb: 'OBB',
  segment: 'Polygon',
};

export const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'my' | 'shared'>('my');
  const [datasets, setDatasets] = useState<DatasetItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDatasets();
  }, [activeTab]);

  const loadDatasets = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get('/datasets/');
      setDatasets(res.data.items || []);
    } catch (err) {
      console.error('Ошибка загрузки датасетов:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="dataset-page">
      <header className="dataset-page__heading">
        <div>
          <h1>Привет, {user?.display_name || 'Пользователь'}!</h1>
          <p>Управление датасетами для разметки</p>
        </div>
        <button className="button button--primary" onClick={() => navigate('/datasets/create')}>
          + Создать датасет
        </button>
      </header>

      {isLoading ? (
        <div className="dataset-empty">Загружаем датасеты...</div>
      ) : datasets.length === 0 ? (
        <div className="dataset-empty">
          <h2>Пока нет датасетов</h2>
          <p>Создайте первый датасет для разметки.</p>
        </div>
      ) : (
        <div className="dataset-grid">
          {datasets.map((dataset) => (
            <article className="dataset-card" key={dataset.id} onClick={() => navigate(`/datasets/${dataset.id}/gallery`)} style={{ cursor: 'pointer' }}>
              {dataset.cover_url ? (
                <img className="dataset-card__preview" src={dataset.cover_url} alt={dataset.name} />
              ) : (
                <div className="dataset-card__preview" style={{ background: '#222', display: 'grid', placeItems: 'center', color: '#666' }}>Нет превью</div>
              )}
              <div className="dataset-card__content">
                <div className="dataset-card__title-row">
                  <h2>{dataset.name}</h2>
                </div>
                <div className="dataset-card__badges">
                  <span className="dataset-badge">{taskNames[dataset.task] || dataset.task}</span>
                  <span className="dataset-badge">{dataset.images_count} кадров</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};