export const MAX_FRAME_BYTES = 25 * 1024 * 1024;
export const FRAME_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tiff', 'tif', 'heic', 'heif'];
export function validateFrame(file: { name: string; size: number }): string | undefined {
  if (!FRAME_EXTENSIONS.includes(file.name.split('.').pop()?.toLowerCase() ?? '')) return 'Формат не поддерживается';
  if (!file.size) return 'Файл пуст';
  if (file.size > MAX_FRAME_BYTES) return 'Файл больше 25 МБ';
}
