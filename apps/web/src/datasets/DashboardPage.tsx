import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dataset } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { useRole } from '../auth/roles';

const mockDatasets: Dataset[] = [
  { id: '1', name: 'Cats and Dogs', task: 'detect', is_private: true, samples_count: 150, is_owner: true, my_role: 'owner' },
  { id: '2', name: 'Traffic Signs', task: 'detect', is_private: false, samples_count: 89, is_owner: false, my_role: 'labeler' },
  { id: '3', name: 'Public Dataset', task: 'segment', is_private: false, samples_count: 42, is_owner: false, my_role: 'observer' },
];

const taskNames: Record<Dataset['task'], string> = {
  detect: 'Bounding Box',
  obb: 'OBB',
  segment: 'Polygon',
};

const roleNames = {
  owner: 'Владелец',
  labeler: 'Разметчик',
  observer: 'Наблюдатель',
} as const;

export const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'my' | 'shared'>('my');
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const timer = window.setTimeout(() => {
      setDatasets(mockDatasets.filter((dataset) => (
        activeTab === 'my' ? dataset.is_owner : !dataset.is_owner
      )));
      setIsLoading(false);
    }, 140);

    return () => window.clearTimeout(timer);
  }, [activeTab]);

  return (
    <section className="dataset-page">
      <header className="dataset-page__heading">
        <div>
          <h1>Привет, {user?.display_name || 'Пользователь'}!</h1>
          <p>Управление датасетами для разметки</p>
        </div>
        <button className="button button--primary" onClick={() => navigate('/datasets/create')}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          Создать датасет
        </button>
      </header>

      <div className="dataset-tabs" role="tablist" aria-label="Список датасетов">
        <button className={activeTab === 'my' ? 'dataset-tabs__tab is-active' : 'dataset-tabs__tab'} role="tab" aria-selected={activeTab === 'my'} onClick={() => setActiveTab('my')}>
          Мои датасеты <span>{mockDatasets.filter((dataset) => dataset.is_owner).length}</span>
        </button>
        <button className={activeTab === 'shared' ? 'dataset-tabs__tab is-active' : 'dataset-tabs__tab'} role="tab" aria-selected={activeTab === 'shared'} onClick={() => setActiveTab('shared')}>
          Доступные мне <span>{mockDatasets.filter((dataset) => !dataset.is_owner).length}</span>
        </button>
      </div>

      {isLoading ? (
        <div className="dataset-empty">Загружаем датасеты...</div>
      ) : datasets.length === 0 ? (
        <div className="dataset-empty">
          <h2>{activeTab === 'my' ? 'Пока нет датасетов' : 'Нет общих датасетов'}</h2>
          <p>{activeTab === 'my' ? 'Создайте первый датасет для разметки.' : 'Когда вас пригласят, он появится здесь.'}</p>
        </div>
      ) : (
        <div className="dataset-grid">
          {datasets.map((dataset) => {
            const { isOwner, canExport } = useRole(dataset.my_role);
            const preview = dataset.id === '1'
              ? '/previews/cats-dogs.svg'
              : dataset.id === '2'
                ? '/previews/traffic-signs.svg'
                : '/previews/car-segmentation.svg';

            return (
              <article className="dataset-card" key={dataset.id}>
                <img className="dataset-card__preview" src={preview} alt={`Превью ${dataset.name}`} />
                <div className="dataset-card__content">
                  <div className="dataset-card__title-row">
                    <h2>{dataset.name}</h2>
                    {dataset.is_private && <span className="dataset-private"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>Приватный</span>}
                  </div>
                  <div className="dataset-card__badges">
                    <span className="dataset-badge"><span className="dataset-badge__box" />{taskNames[dataset.task]}</span>
                    <span className="dataset-badge"><span className="dataset-badge__samples" />{dataset.samples_count} кадров</span>
                  </div>
                  <div className="dataset-card__role-row">
                    <span>Ваша роль</span>
                    <span className={`role-pill role-pill--${dataset.my_role}`}>{roleNames[dataset.my_role || 'observer']}</span>
                  </div>
                  <div className="dataset-card__actions">
                    {isOwner ? (
                      <>
                        <button className="button button--quiet" onClick={() => navigate(`/datasets/${dataset.id}/members`)}>
                          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM20 8v6M23 11h-6" /></svg>Участники
                        </button>
                        {canExport && <button className="button button--quiet" onClick={() => window.alert('Экспорт пока не подключён к API.')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>Экспорт</button>}
                      </>
                    ) : (
                      <button className={`button dataset-card__open ${dataset.my_role === 'labeler' ? 'dataset-card__open--labeler' : ''}`} onClick={() => window.alert('Галерея датасета пока не подключена.')}>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></svg>
                        {dataset.my_role === 'labeler' ? 'Открыть разметку' : 'Просмотр'}
                        {dataset.my_role === 'labeler' && <span aria-hidden="true">→</span>}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
          {activeTab === 'my' && (
            <button className="dataset-create-tile" onClick={() => navigate('/datasets/create')}>
              <span className="dataset-create-tile__plus">+</span>
              <strong>Новый датасет</strong>
              <span>Задайте классы и тип разметки, потом пригласите команду</span>
            </button>
          )}
        </div>
      )}
    </section>
  );
};