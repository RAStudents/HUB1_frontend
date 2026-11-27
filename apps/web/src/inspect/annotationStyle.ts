const COLORS = ['#ef4444', '#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899'];

export function annotationColor(classId: number) {
  return COLORS[(classId % COLORS.length + COLORS.length) % COLORS.length];
}
