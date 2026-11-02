import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams, useLocation } from 'react-router-dom';

interface GalleryItem {
  id: number;
  filename: string;
  image_url: string;
  mask_url: string;
  objects_count: number;
  task: string;
}

export const GalleryPage: React.FC = () => {
  const { datasetId } = useParams<{ datasetId: string }>();
  const location = useLocation();
  
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [maskOpacity, setMaskOpacity] = useState<number>(0.9);

  // Безопасное сохранение yamlPath в useEffect, если он передан через state роутера
  useEffect(() => {
    const stateYaml = (location.state as any)?.yamlPath;
    if (stateYaml && datasetId) {
      localStorage.setItem(`dataset_${datasetId}_yaml`, stateYaml);
    }
  }, [location.state, datasetId]);

  useEffect(() => {
    if (!datasetId) return;

    const token = localStorage.getItem('token') || localStorage.getItem('access_token');
    setLoading(true);

    // Достаем сохраненный yamlPath ТОЛЬКО для этого datasetId (без глобального дефолта на первый датасет!)
    const savedYaml = localStorage.getItem(`dataset_${datasetId}_yaml`);
    const stateYaml = (location.state as any)?.yamlPath;
    const yamlPath = stateYaml || savedYaml || undefined; // Если пути нет — отправляем undefined, бэкенд возьмет из storage!

    axios.get(`http://localhost:8000/api/datasets/${datasetId}/gallery`, {
      params: { 
        yaml_path: yamlPath, // Если null/undefined, бэкенд отработает по ID из папки storage
        split: 'train', 
        limit: 50 
      },
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(response => {
      setItems(response.data);
      setLoading(false);
    })
    .catch(err => {
      setError(err.response?.data?.detail || 'Ошибка загрузки галереи');
      setLoading(false);
    });
  }, [datasetId, location.state]);

  if (loading) return <div className="p-8 text-white bg-slate-900 min-h-screen">Генерация масок и загрузка датасета...</div>;
  if (error) return <div className="p-8 text-red-400 bg-slate-900 min-h-screen">Ошибка: {error}</div>;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 bg-slate-950 p-6 rounded-2xl border border-slate-800">
          <div>
            <h1 className="text-2xl font-bold mb-1">Галерея датасета #{datasetId}</h1>
          </div>

          <div className="flex items-center gap-3 bg-slate-900 px-4 py-2.5 rounded-xl border border-slate-800">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Прозрачность маски: {Math.round(maskOpacity * 100)}%
            </span>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.05" 
              value={maskOpacity}
              onChange={(e) => setMaskOpacity(parseFloat(e.target.value))}
              className="accent-red-600 cursor-pointer w-28"
            />
          </div>
        </div>

        {items.length === 0 ? (
          <div className="text-slate-400 py-12 text-center bg-slate-950 rounded-2xl border border-slate-800">
            Изображения не найдены или галерея пуста.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {items.map((item) => (
              <div 
                key={item.id} 
                className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-lg flex flex-col"
              >
                <div className="relative w-full aspect-square bg-slate-900 overflow-hidden flex items-center justify-center">
                  <img 
                    src={item.image_url} 
                    alt={item.filename}
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                  />
                  <img 
                    src={item.mask_url} 
                    alt="mask"
                    style={{ opacity: maskOpacity }}
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none transition-opacity duration-150"
                  />
                  <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-md text-xs px-2.5 py-1 rounded-full text-slate-200 border border-white/10">
                    Объектов: {item.objects_count}
                  </div>
                </div>

                <div className="p-4 flex flex-col justify-between flex-1 bg-slate-950">
                  <p className="text-sm font-medium text-slate-200 truncate" title={item.filename}>
                    {item.filename}
                  </p>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-900 text-xs text-slate-400">
                    <span>Задача: <strong className="text-slate-300">{item.task}</strong></span>
                    <span className="text-emerald-400 font-semibold">Ок</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};