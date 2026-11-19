import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';

interface AvatarCropDialogProps {
  file: File;
  isSaving: boolean;
  onCancel: () => void;
  onSave: (croppedFile: File) => Promise<void>;
}

interface Point {
  x: number;
  y: number;
}

const OUTPUT_SIZE = 512;
const MAX_ZOOM = 4;

const clampOffset = (offset: Point, imageWidth: number, imageHeight: number, viewportSize: number): Point => ({
  x: Math.max(-Math.max(0, imageWidth - viewportSize) / 2, Math.min(Math.max(0, imageWidth - viewportSize) / 2, offset.x)),
  y: Math.max(-Math.max(0, imageHeight - viewportSize) / 2, Math.min(Math.max(0, imageHeight - viewportSize) / 2, offset.y)),
});

export const AvatarCropDialog = ({ file, isSaving, onCancel, onSave }: AvatarCropDialogProps) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ pointerId: number; start: Point; offset: Point } | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [imageSize, setImageSize] = useState<Point | null>(null);
  const [viewportSize, setViewportSize] = useState(320);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState('');

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const observer = new ResizeObserver(([entry]) => {
      setViewportSize(entry.contentRect.width);
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSaving, onCancel]);

  const baseScale = imageSize
    ? Math.max(viewportSize / imageSize.x, viewportSize / imageSize.y)
    : 1;
  const imageWidth = (imageSize?.x || 0) * baseScale * zoom;
  const imageHeight = (imageSize?.y || 0) * baseScale * zoom;
  const boundedOffset = clampOffset(offset, imageWidth, imageHeight, viewportSize);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!imageSize || isSaving) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      offset: boundedOffset,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setOffset(clampOffset({
      x: drag.offset.x + event.clientX - drag.start.x,
      y: drag.offset.y + event.clientY - drag.start.y,
    }, imageWidth, imageHeight, viewportSize));
  };

  const finishDragging = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  const handleZoomChange = (nextZoom: number) => {
    setZoom(nextZoom);
    setOffset((current) => clampOffset(
      current,
      (imageSize?.x || 0) * baseScale * nextZoom,
      (imageSize?.y || 0) * baseScale * nextZoom,
      viewportSize,
    ));
  };

  const handleSave = async () => {
    const image = imageRef.current;
    if (!image || !imageSize) return;

    setError('');
    const scale = baseScale * zoom;
    const cropSize = viewportSize / scale;
    const centerX = imageSize.x / 2 - boundedOffset.x / scale;
    const centerY = imageSize.y / 2 - boundedOffset.y / scale;
    const sourceX = Math.max(0, Math.min(imageSize.x - cropSize, centerX - cropSize / 2));
    const sourceY = Math.max(0, Math.min(imageSize.y - cropSize, centerY - cropSize / 2));
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;

    try {
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Не удалось подготовить изображение.');
      context.drawImage(image, sourceX, sourceY, cropSize, cropSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
      const cropped = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Не удалось обработать изображение.'));
        }, 'image/webp', 0.92);
      });
      await onSave(new File([cropped], 'avatar.webp', { type: 'image/webp' }));
    } catch (saveError: unknown) {
      const detail = (saveError as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      setError(detail || (saveError instanceof Error ? saveError.message : 'Не удалось сохранить аватар.'));
    }
  };

  const imageStyle: CSSProperties = {
    width: imageWidth,
    height: imageHeight,
    left: `calc(50% + ${boundedOffset.x}px)`,
    top: `calc(50% + ${boundedOffset.y}px)`,
  };

  return (
    <div className="avatar-crop-dialog" onClick={onCancel} role="presentation">
      <section
        aria-label="Настройка кадрирования аватара"
        aria-modal="true"
        className="avatar-crop-dialog__panel"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="avatar-crop-dialog__header">
          <div>
            <h2>Настройка аватара</h2>
            <p>Перетащите фото и выберите нужный фрагмент</p>
          </div>
          <button aria-label="Закрыть" className="avatar-crop-dialog__close" onClick={onCancel} type="button">×</button>
        </header>

        <div className="avatar-crop-dialog__body">
          <div
            ref={viewportRef}
            className={`avatar-crop-dialog__viewport${imageSize ? ' is-ready' : ''}`}
            onLostPointerCapture={finishDragging}
            onPointerCancel={finishDragging}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishDragging}
          >
            {imageUrl && (
              <img
                ref={imageRef}
                alt="Выбранное изображение"
                className="avatar-crop-dialog__image"
                draggable={false}
                onLoad={(event) => {
                  setError('');
                  setImageSize({ x: event.currentTarget.naturalWidth, y: event.currentTarget.naturalHeight });
                  setOffset({ x: 0, y: 0 });
                  setZoom(1);
                }}
                onError={() => {
                  setImageSize(null);
                  setError('Не удалось открыть выбранное изображение.');
                }}
                src={imageUrl}
                style={imageStyle}
              />
            )}
            {imageSize && <div aria-hidden="true" className="avatar-crop-dialog__mask" />}
          </div>

          <label className="avatar-crop-dialog__zoom" htmlFor="avatar-crop-zoom">
            <span>Масштаб</span>
            <input
              id="avatar-crop-zoom"
              max={MAX_ZOOM}
              min={1}
              onChange={(event) => handleZoomChange(Number(event.target.value))}
              step={0.01}
              type="range"
              value={zoom}
            />
          </label>

          {error && <p className="profile-message profile-message--error" role="alert">{error}</p>}
        </div>

        <footer className="avatar-crop-dialog__footer">
          <button className="button button--quiet" disabled={isSaving} onClick={onCancel} type="button">Отмена</button>
          <button className="button button--primary" disabled={!imageSize || isSaving} onClick={handleSave} type="button">
            {isSaving ? 'Сохраняем...' : 'Сохранить аватар'}
          </button>
        </footer>
      </section>
    </div>
  );
};
