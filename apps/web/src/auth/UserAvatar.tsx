import { useEffect, useState, type CSSProperties } from 'react';

const FALLBACK_COLOR = 'var(--app-accent)';

const getDominantColor = (image: HTMLImageElement): string => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return FALLBACK_COLOR;

  try {
    const size = 32;
    canvas.width = size;
    canvas.height = size;
    context.drawImage(image, 0, 0, size, size);
    const pixels = context.getImageData(0, 0, size, size).data;
    const colors = new Map<number, number>();
    let dominant = 0;
    let dominantCount = 0;

    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] < 128) continue;

      const color = (pixels[index] >> 4) << 8
        | (pixels[index + 1] >> 4) << 4
        | (pixels[index + 2] >> 4);
      const count = (colors.get(color) || 0) + 1;
      colors.set(color, count);
      if (count > dominantCount) {
        dominant = color;
        dominantCount = count;
      }
    }

    if (dominantCount === 0) return FALLBACK_COLOR;

    const channels = [
      (dominant >> 8) & 0xf,
      (dominant >> 4) & 0xf,
      dominant & 0xf,
    ].map((channel) => (channel * 17).toString(16).padStart(2, '0'));
    return `#${channels.join('')}`;
  } catch (error) {
    console.warn('Не удалось определить основной цвет аватара:', error);
    return FALLBACK_COLOR;
  }
};

interface UserAvatarProps {
  src?: string | null;
  name?: string;
  email?: string;
  className: string;
}

export const UserAvatar = ({ src, name, email, className }: UserAvatarProps) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [borderColor, setBorderColor] = useState(FALLBACK_COLOR);
  const initial = (name || email || 'U').slice(0, 1).toUpperCase();

  useEffect(() => {
    setImageLoaded(false);
    setBorderColor(FALLBACK_COLOR);
  }, [src]);

  return (
    <span
      className={className}
      style={{ '--avatar-border-color': borderColor } as CSSProperties}
      aria-hidden="true"
    >
      {src && (
        <img
          alt=""
          crossOrigin="anonymous"
          onError={() => setImageLoaded(false)}
          onLoad={(event) => {
            setBorderColor(getDominantColor(event.currentTarget));
            setImageLoaded(true);
          }}
          src={src}
        />
      )}
      {!imageLoaded && <span>{initial}</span>}
    </span>
  );
};
