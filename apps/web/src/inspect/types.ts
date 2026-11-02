export type TaskType = 'detect' | 'obb' | 'segment';

export interface BoundingBoxGeometry {
  // YOLO format: [x_center, y_center, width, height] (нормализованы 0..1)
  center_x: number;
  center_y: number;
  width: number;
  height: number;
}

export interface OBBGeometry {
  // Повёрнутая рамка: центр, размеры и угол поворота (в градусах или радианах)
  center_x: number;
  center_y: number;
  width: number;
  height: number;
  angle: number; // угол поворота
}

export interface PolygonGeometry {
  // Точки полигона: [[x1, y1], [x2, y2], ...] (все 0..1)
  points: Array<[number, number]>;
}

export interface AnnotationItem {
  id: string;
  class_id: number;
  class_name: string;
  color?: string;
  // Один из типов геометрии в зависимости от типа задачи датасета
  box?: BoundingBoxGeometry;
  obb?: OBBGeometry;
  polygon?: PolygonGeometry;
}

export interface SampleData {
  id: string;
  image_url: string;
  filename: string;
  task: TaskType;
  annotations: AnnotationItem[];
}