// apps/web/src/utils/localDatasetLoader.ts

export interface LocalObject {
  classId: number;
  className: string;
  points: { x: number; y: number }[];
}

export interface LocalSample {
  stem: string;
  split: 'train' | 'val' | 'test';
  imageUrl: string;
  objects: LocalObject[];
}

export interface LocalDataset {
  classNames: string[];
  samples: LocalSample[];
}

// Парсер YAML (упрощённый, только для names)
export function parseYamlNames(yaml: string): string[] {
  const names: string[] = [];
  const lines = yaml.split('\n');
  let inNames = false;

  for (const line of lines) {
    if (line.trim().startsWith('names:')) {
      inNames = true;
      continue;
    }
    if (inNames) {
      const match = line.match(/^\s*(\d+):\s*['"]?([^'"\n]+)['"]?$/);
      if (match) {
        const idx = parseInt(match[1]);
        names[idx] = match[2].trim();
      } else if (line.trim() && !line.startsWith(' ') && !line.startsWith('\t')) {
        break;
      }
    }
  }

  return names.filter(Boolean);
}

// Парсер YOLO polygon txt
// Формат: class_id x1 y1 x2 y2 ... xn yn
export function parseYoloPolygon(
  txt: string,
  classNames: string[]
): LocalObject[] {
  const objects: LocalObject[] = [];
  const lines = txt.trim().split('\n');

  for (const line of lines) {
    if (!line.trim()) continue;

    const parts = line.trim().split(/\s+/).map(Number);
    if (parts.length < 5) continue;

    const classId = parts[0];
    const coords = parts.slice(1);

    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < coords.length; i += 2) {
      if (i + 1 < coords.length) {
        points.push({ x: coords[i], y: coords[i + 1] });
      }
    }

    if (points.length >= 3) {
      objects.push({
        classId,
        className: classNames[classId] || `class_${classId}`,
        points,
      });
    }
  }

  return objects;
}

// Загрузка локального датасета через File System Access API
export async function loadLocalDataset(
  yamlFile: File,
  imageFiles: File[],
  labelFiles: File[]
): Promise<LocalDataset> {
  // Читаем yaml
  const yamlContent = await yamlFile.text();
  const classNames = parseYamlNames(yamlContent);

  // Группируем файлы по split и stem
  const samples: LocalSample[] = [];

  for (const imgFile of imageFiles) {
    // Определяем split из пути: images/train/xxx.jpg
    const pathParts = imgFile.webkitRelativePath?.split('/') || [];
    const split = (pathParts[1] as 'train' | 'val' | 'test') || 'train';
    const stem = imgFile.name.replace(/\.[^.]+$/, '');

    // Ищем соответствующий label
    const labelFile = labelFiles.find(f => {
      const labelPath = f.webkitRelativePath?.split('/') || [];
      const labelSplit = labelPath[1];
      const labelStem = f.name.replace(/\.[^.]+$/, '');
      return labelSplit === split && labelStem === stem;
    });

    let objects: LocalObject[] = [];
    if (labelFile) {
      const txt = await labelFile.text();
      objects = parseYoloPolygon(txt, classNames);
    }

    const imageUrl = URL.createObjectURL(imgFile);

    samples.push({
      stem,
      split,
      imageUrl,
      objects,
    });
  }

  return { classNames, samples };
}