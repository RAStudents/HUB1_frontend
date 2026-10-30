import { AnnotationItem } from '../inspect/types';

/**
 * Парсит содержимое .txt файла разметки YOLO (Segment / Polygon)
 * Каждая строка: class_id x1 y1 x2 y2 x3 y3 ... (нормализованные координаты от 0 до 1)
 */
export const parseYoloSegmentTxt = (
  txtContent: string,
  classNames: string[]
): AnnotationItem[] => {
  const lines = txtContent.split('\n');
  const annotations: AnnotationItem[] = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const parts = trimmed.split(/\s+/).map(Number);
    if (parts.length < 5) return; // Нужно как минимум класс и 2 пары точек (4 координаты)

    const classId = parts[0];
    const coords = parts.slice(1);

    // Собираем пары [x, y]
    const points: Array<[number, number]> = [];
    for (let i = 0; i < coords.length; i += 2) {
      if (i + 1 < coords.length) {
        points.push([coords[i], coords[i + 1]]);
      }
    }

    if (points.length > 0) {
      annotations.push({
        id: `parsed-${index}-${Math.random().toString(36).substr(2, 5)}`,
        class_id: classId,
        class_name: classNames[classId] || `class_${classId}`,
        polygon: {
          points,
        },
      });
    }
  });

  return annotations;
};