import type { EditableAnnotation, ImageSize } from './annotationGeometry';
import { annotationColor } from './annotationStyle';

interface Props {
  annotation: EditableAnnotation;
  size: ImageSize;
  label: string;
  selected?: boolean;
  preview?: boolean;
}

export function AnnotationShape({ annotation, size, label, selected, preview }: Props) {
  const color = annotationColor(annotation.class_id);
  const strokeWidth = preview ? 1.25 : Math.max(2, size.width * 0.0025);
  const shapeProps = {
    className: preview ? undefined : 'annotation-canvas__shape',
    fill: `${color}33`,
    stroke: color,
    strokeWidth: selected ? strokeWidth * 1.5 : strokeWidth,
  };
  const box = annotation.box ?? annotation.obb;
  const points = annotation.polygon?.points ?? [];
  if (!box && points.length < 3) return null;

  const x = (box ? box.x - box.width / 2 : points[0].x) * size.width;
  const y = (box ? box.y - box.height / 2 : points[0].y) * size.height;
  const angle = annotation.box ? undefined : annotation.obb?.angle_deg;
  const fontSize = preview ? 8 : Math.max(11, size.width * 0.014);
  const labelTop = Math.max(0, y - fontSize * 1.65);
  const labelPadding = preview ? 3 : 5;

  return (
    <g data-annotation-id={preview ? undefined : annotation.id}>
      {box ? (
        <rect
          {...shapeProps}
          x={x}
          y={y}
          width={box.width * size.width}
          height={box.height * size.height}
          transform={angle === undefined ? undefined : `rotate(${angle} ${box.x * size.width} ${box.y * size.height})`}
        />
      ) : (
        <polygon {...shapeProps} points={points.map(point => `${point.x * size.width},${point.y * size.height}`).join(' ')} />
      )}
      <g pointerEvents="none">
        <rect x={x} y={labelTop} width={Math.max(preview ? 16 : 28, label.length * fontSize * 0.62 + 2 * labelPadding)} height={fontSize * 1.45} rx={preview ? 2 : 3} fill={color} />
        <text x={x + labelPadding} y={labelTop + fontSize * 1.06} fill="#fff" fontSize={fontSize} fontWeight="600">{label}</text>
      </g>
    </g>
  );
}
