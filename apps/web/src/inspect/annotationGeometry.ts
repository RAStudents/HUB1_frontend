export interface Point { x: number; y: number }
interface Rect { x: number; y: number; width: number; height: number }
export interface EditableAnnotation {
  id?: number | null;
  class_id: number;
  box?: Rect | null;
  obb?: (Rect & { angle_deg: number }) | null;
  polygon?: { points: Point[] } | null;
}
export interface ImageSize { width: number; height: number }
const clamp = (n: number, min = 0, max = 1) => Math.max(min, Math.min(max, n));
const signs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];

export function annotationHandles(annotation: EditableAnnotation, size: ImageSize): Point[] {
  const rect = annotation.box ?? annotation.obb;
  if (!rect) return annotation.polygon?.points ?? [];
  const angle = (annotation.obb?.angle_deg ?? 0) * Math.PI / 180;
  return signs.map(([sx, sy]) => {
    const x = sx * rect.width * size.width / 2;
    const y = sy * rect.height * size.height / 2;
    return {
      x: rect.x + (x * Math.cos(angle) - y * Math.sin(angle)) / size.width,
      y: rect.y + (x * Math.sin(angle) + y * Math.cos(angle)) / size.height,
    };
  });
}

export function editAnnotation<T extends EditableAnnotation>(
  original: T, start: Point, current: Point, handle: number | 'move' | 'rotate', size: ImageSize,
): T {
  if (handle === 'rotate') {
    const { obb } = original;
    if (!obb || (current.x === obb.x && current.y === obb.y)) return original;
    const direction = (point: Point) => Math.atan2(
      (point.y - obb.y) * size.height,
      (point.x - obb.x) * size.width,
    );
    const delta = (direction(current) - direction(start)) * 180 / Math.PI;
    if (delta === 0) return original;
    const angle = obb.angle_deg + delta;
    const angle_deg = ((angle + 180) % 360 + 360) % 360 - 180;
    return { ...original, obb: { ...obb, angle_deg } };
  }
  if (handle === 'move') {
    const points = annotationHandles(original, size);
    if (!points.length) return original;
    const xs = points.map(p => p.x), ys = points.map(p => p.y);
    const dx = clamp(current.x - start.x, -Math.min(...xs), 1 - Math.max(...xs));
    const dy = clamp(current.y - start.y, -Math.min(...ys), 1 - Math.max(...ys));
    if (original.box) return { ...original, box: { ...original.box, x: original.box.x + dx, y: original.box.y + dy } };
    if (original.obb) return { ...original, obb: { ...original.obb, x: original.obb.x + dx, y: original.obb.y + dy } };
    return { ...original, polygon: { points: points.map(p => ({ x: p.x + dx, y: p.y + dy })) } };
  }
  if (original.polygon) {
    return { ...original, polygon: { points: original.polygon.points.map((p, index) => index === handle ? { x: clamp(current.x), y: clamp(current.y) } : p) } };
  }
  const rect = original.box ?? original.obb;
  if (!rect || !signs[handle]) return original;
  const anchor = annotationHandles(original, size)[(handle + 2) % 4];
  const [sx, sy] = signs[handle];
  const angle = (original.obb?.angle_deg ?? 0) * Math.PI / 180;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  // Project onto the rotated axes in image pixels (also works for non-square images).
  const dx = (current.x - anchor.x) * size.width;
  const dy = (current.y - anchor.y) * size.height;
  const width = clamp(sx * (dx * cos + dy * sin), Math.min(3, size.width), size.width);
  const height = clamp(sy * (-dx * sin + dy * cos), Math.min(3, size.height), size.height);
  const candidate = {
    ...rect,
    x: anchor.x + (sx * width * cos - sy * height * sin) / (2 * size.width),
    y: anchor.y + (sx * width * sin + sy * height * cos) / (2 * size.height),
    width: width / size.width,
    height: height / size.height,
  };
  const result = original.box ? { ...original, box: candidate } : { ...original, obb: { ...original.obb!, ...candidate } };
  // Keep the entire shape inside the image, including the corners of rotated boxes.
  const inside = (value: T) => annotationHandles(value, size).every(p => p.x >= -1e-9 && p.x <= 1 + 1e-9 && p.y >= -1e-9 && p.y <= 1 + 1e-9);
  if (inside(result)) return result;
  if (!inside(original)) return original;
  let low = 0, high = 1;
  let best = original;
  for (let i = 0; i < 24; i++) {
    const t = (low + high) / 2;
    const lerp = (a: number, b: number) => a + (b - a) * t;
    const resized = { ...candidate, x: lerp(rect.x, candidate.x), y: lerp(rect.y, candidate.y), width: lerp(rect.width, candidate.width), height: lerp(rect.height, candidate.height) };
    const value = original.box ? { ...original, box: resized } : { ...original, obb: { ...original.obb!, ...resized } };
    if (inside(value)) { low = t; best = value; } else high = t;
  }
  return best;
}
