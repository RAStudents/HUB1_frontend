import React, { useState } from 'react';
import { Viewport, Annotation } from './Viewport';
import { parseYoloSegmentTxt } from '../utils/yoloParser';

const MOCK_TXT_CONTENT = `0 0.03686995913461539 0.9808467740384615 0.03245967788461539 0.9595654110576923 0.030569555288461538 0.9517249110576922`;
const MOCK_CLASSES = ['crack'];

const rawParsed = parseYoloSegmentTxt(MOCK_TXT_CONTENT, MOCK_CLASSES);
const annotations: Annotation[] = rawParsed.map((item) => ({
  id: item.id,
  classId: item.class_id,
  className: item.class_name,
  geometry: 'polygon',
  points: item.polygon?.points.map(([x, y]) => ({ x, y })) || [],
}));

export const InspectPage: React.FC = () => {
  const [showMasks, setShowMasks] = useState(true);
  const imageUrl = '/sample.jpg'; 

  // Состояния для реальных размеров картинки
  const [naturalSize, setNaturalSize] = useState({ width: 640, height: 640 });

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-text)] p-6 flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--app-line)] pb-4">
        <div>
          <h1 className="text-xl font-bold">Инспектирование сэмпла</h1>
          <p className="text-sm text-[var(--app-subtle)]">Просмотр изображения и масок разметки</p>
        </div>

        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input
            type="checkbox"
            checked={showMasks}
            onChange={(e) => setShowMasks(e.target.checked)}
            className="rounded bg-[var(--app-surface)] border-[var(--app-line-strong)] text-[var(--app-accent)] focus:ring-[var(--app-accent)]"
          />
          Показывать маски
        </label>
      </div>

      <div className="flex-1 w-full flex justify-center items-center">
        <div className="w-full max-w-5xl h-[70vh] rounded-lg overflow-hidden border border-[var(--app-line)] bg-[var(--app-bg)] relative shadow-xl flex items-center justify-center">
          <Viewport
            imageUrl={imageUrl}
            annotations={annotations}
            showMasks={showMasks}
            imageWidth={naturalSize.width}
            imageHeight={naturalSize.height}
            onImageLoad={(w, h) => setNaturalSize({ width: w, height: h })}
          />
        </div>
      </div>
    </div>
  );
};