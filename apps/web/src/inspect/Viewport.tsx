// apps/web/src/inspect/Viewport.tsx
import { useState, useRef, WheelEvent, MouseEvent, SyntheticEvent } from 'react';

export interface Annotation {
  id: string;
  classId: number;
  className: string;
  geometry: 'box' | 'obb' | 'polygon';
  points: { x: number; y: number }[]; // Нормализованные [0, 1]
}

interface ViewportProps {
  imageUrl: string;
  annotations: Annotation[];
  showMasks: boolean;
  imageWidth: number;
  imageHeight: number;
  onImageLoad?: (width: number, height: number) => void;
}

const COLORS = ['#ef4444', '#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899'];

export const Viewport = ({ 
  imageUrl, 
  annotations, 
  showMasks, 
  imageWidth, 
  imageHeight, 
  onImageLoad 
}: ViewportProps) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const containerRef = useRef<HTMLDivElement>(null);

  // Обработчик загрузки изображения для получения реальных размеров
  const handleImageLoad = (e: SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (onImageLoad && img.naturalWidth && img.naturalHeight) {
      onImageLoad(img.naturalWidth, img.naturalHeight);
    }
  };

  // Зум колесиком мыши
  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(scale * delta, 0.1), 10);
    setScale(newScale);
  };

  // Начало перетаскивания (пан)
  const handleMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return; // Только левая кнопка
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  // Перетаскивание
  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  // Конец перетаскивания
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  return (
    <div 
      ref={containerRef}
      className="w-full h-full bg-gray-900 overflow-hidden cursor-grab active:cursor-grabbing relative"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {/* Контейнер с трансформацией для зума и пана */}
      <div
        className="absolute top-1/2 left-1/2 origin-center transition-transform duration-75 ease-out"
        style={{
          transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px)) scale(${scale})`,
          width: imageWidth,
          height: imageHeight,
        }}
      >
        {/* Оригинальное изображение */}
        <img
          src={imageUrl}
          alt="Sample"
          onLoad={handleImageLoad}
          className="block w-full h-full object-contain select-none pointer-events-none"
          draggable={false}
        />

        {/* SVG слой с масками */}
        {showMasks && (
          <svg
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
            viewBox={`0 0 ${imageWidth} ${imageHeight}`}
            preserveAspectRatio="none"
          >
            {annotations.map((ann) => {
              const color = COLORS[ann.classId % COLORS.length];
              
              // Точный расчет точек полигона без разрывов строк
              const pointsStr = ann.points
                .map(p => `${p.x * imageWidth},${p.y * imageHeight}`)
                .join(' ');

              return (
                <g key={ann.id}>
                  {/* Полигон / OBB / Box */}
                  <polygon
                    points={pointsStr}
                    fill={`${color}33`} // 20% прозрачности
                    stroke={color}
                    strokeWidth={2 / scale} // Толщина линии не меняется при зуме
                    vectorEffect="non-scaling-stroke"
                  />
                  {/* Подпись класса */}
                  <text
                    x={ann.points[0]?.x * imageWidth || 0}
                    y={(ann.points[0]?.y * imageHeight || 0) - (5 / scale)}
                    fill={color}
                    fontSize={12 / scale}
                    fontWeight="bold"
                    style={{ textShadow: '0px 0px 2px rgba(0,0,0,0.8)' }}
                  >
                    {ann.className}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {/* Подсказка по управлению */}
      <div className="absolute bottom-4 left-4 bg-black/70 text-white text-xs px-3 py-2 rounded pointer-events-none select-none">
        Колесико: зум • Зажать ЛКМ: перемещение
      </div>
    </div>
  );
};