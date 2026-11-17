import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../api/client';
import { getApiErrorMessage } from '../api/errorMessage';

type Tool = 'pan' | 'select' | 'box' | 'obb' | 'polygon';
type Split = 'train' | 'val' | 'test';

interface Point {
  x: number;
  y: number;
}

interface DatasetClass {
  id: number;
  name: string;
}

interface Annotation {
  id?: number | null;
  class_id: number;
  box?: { x: number; y: number; width: number; height: number } | null;
  obb?: { x: number; y: number; width: number; height: number; angle_deg: number } | null;
  polygon?: { points: Point[] } | null;
}

interface Sample {
  id: number;
  sample_id?: number | null;
  dataset_id: number;
  split: string;
  status: string;
  image_url: string;
  filename: string;
  task: string;
  annotations: Annotation[];
}

interface GalleryPage {
  total: number;
  labeled_count: number;
  unlabeled_count: number;
  classes: Array<{ id: number; name: string; count: number }>;
  items: Sample[];
}

interface RouteState {
  sample?: Sample;
  items?: Sample[];
  datasetName?: string;
  classNames?: Record<number, string>;
  datasetRole?: string;
  page?: number;
  totalSamples?: number;
  labeledSamples?: number;
  filters?: {
    status?: string;
    objectCount?: string;
    labeled?: boolean;
    classIds?: number[];
  };
}

interface DraftRect {
  start: Point;
  end: Point;
}

const PAGE_SIZE = 12;
const COLORS = ['#ef4444', '#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899'];

const clamp = (value: number) => Math.min(1, Math.max(0, value));

export const AnnotationEditorPage = () => {
  const { datasetId, sampleId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const routeState = location.state as RouteState | null;
  const initialSample = routeState?.sample?.id === Number(sampleId) ? routeState.sample : null;
  const [sample, setSample] = useState<Sample | null>(initialSample);
  const [items, setItems] = useState<Sample[]>(routeState?.items || (initialSample ? [initialSample] : []));
  const [galleryPage, setGalleryPage] = useState(routeState?.page || Number(new URLSearchParams(location.search).get('page')) || 1);
  const [totalSamples, setTotalSamples] = useState(routeState?.totalSamples || 0);
  const [labeledSamples, setLabeledSamples] = useState(routeState?.labeledSamples || 0);
  const [datasetName, setDatasetName] = useState(routeState?.datasetName || '');
  const [datasetRole, setDatasetRole] = useState(routeState?.datasetRole || '');
  const [classNames, setClassNames] = useState<Record<number, string>>(routeState?.classNames || {});
  const [classFormMode, setClassFormMode] = useState<'add' | 'rename' | null>(null);
  const [classNameDraft, setClassNameDraft] = useState('');
  const [editingClassId, setEditingClassId] = useState<number | null>(null);
  const [classError, setClassError] = useState('');
  const [classSaving, setClassSaving] = useState(false);
  const [filters] = useState<RouteState['filters']>(routeState?.filters);
  const [selectedClassIdState, setSelectedClassId] = useState<number | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [tool, setTool] = useState<Tool>('select');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<number | null>(null);
  const [polygonPoints, setPolygonPoints] = useState<Point[]>([]);
  const [draftRect, setDraftRect] = useState<DraftRect | null>(null);
  const [loading, setLoading] = useState(!initialSample);
  const [saving, setSaving] = useState(false);
  const [lockHeld, setLockHeld] = useState(false);
  const [lockError, setLockError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const svgRef = useRef<SVGSVGElement>(null);
  const annotationIdRef = useRef(-1);
  const panStartRef = useRef<{ pointerId: number; x: number; y: number; originX: number; originY: number } | null>(null);
  const drawStartRef = useRef<Point | null>(null);
  const isDirty = JSON.stringify(annotations) !== savedSnapshot;
  const isEditableRole = datasetRole === 'owner' || datasetRole === 'labeler';
  const canEdit = isEditableRole && sample?.status !== 'in_review';
  const readOnly = !canEdit || !lockHeld;
  const classes = useMemo(
    () => Object.entries(classNames).map(([id, name]) => ({ id: Number(id), name })).sort((a, b) => a.id - b.id),
    [classNames],
  );
  const selectedClassId = selectedClassIdState ?? classes[0]?.id ?? null;
  const selectedAnnotation = annotations.find((item) => item.id === selectedAnnotationId);

  const withClientIds = (itemsToNormalize: Annotation[], previous: Annotation[] = []) => (
    itemsToNormalize.map((item, index) => ({
      ...item,
      id: item.id ?? previous[index]?.id ?? annotationIdRef.current--,
    }))
  );

  const updateClassNames = (nextClassNames: Record<number, string>) => {
    setClassNames(nextClassNames);
    navigate(`${location.pathname}${location.search}`, {
      replace: true,
      state: { ...(routeState || {}), classNames: nextClassNames },
    });
  };

  const openClassForm = (mode: 'add' | 'rename') => {
    const classId = selectedAnnotation?.class_id ?? selectedClassId;
    setClassFormMode(mode);
    setEditingClassId(mode === 'rename' ? classId : null);
    setClassNameDraft(mode === 'rename' && classId !== null ? classNames[classId] || '' : '');
    setClassError('');
  };

  const saveClass = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!datasetId || !classFormMode) return;
    const name = classNameDraft.trim();
    if (!name) {
      setClassError('Введите название класса.');
      return;
    }

    const classId = classFormMode === 'rename'
      ? editingClassId
      : selectedAnnotation?.class_id ?? selectedClassId;
    if (classFormMode === 'rename' && classId === null) return;
    setClassSaving(true);
    setClassError('');
    try {
      const { data } = classFormMode === 'add'
        ? await apiClient.post<DatasetClass>(`/datasets/${datasetId}/classes`, { name })
        : await apiClient.patch<DatasetClass>(`/datasets/${datasetId}/classes/${classId}`, { name });
      const nextClassNames = { ...classNames, [data.id]: data.name };
      updateClassNames(nextClassNames);
      setSelectedClassId(data.id);
      if (classFormMode === 'add') setSelectedAnnotationId(null);
      setClassFormMode(null);
      setClassNameDraft('');
      setEditingClassId(null);
    } catch (saveError) {
      setClassError(getApiErrorMessage(
        saveError,
        classFormMode === 'add' ? 'Не удалось добавить класс.' : 'Не удалось переименовать класс.',
      ));
    } finally {
      setClassSaving(false);
    }
  };

  const updateRoute = (nextSample: Sample, nextItems: Sample[], nextPage: number, split: string) => {
    if (!datasetId) return;
    setSample(nextSample);
    setItems(nextItems);
    setGalleryPage(nextPage);
    navigate(`/datasets/${datasetId}/annotate/${nextSample.sample_id ?? nextSample.id}?split=${split}&page=${nextPage}`, {
      replace: true,
      state: {
        sample: nextSample,
        items: nextItems,
        datasetName,
        classNames,
        datasetRole,
        page: nextPage,
        totalSamples,
        labeledSamples,
        filters,
      } satisfies RouteState,
    });
  };

  const loadSplitPage = useCallback(async (split: Split, page: number, signal?: AbortSignal) => {
    if (!datasetId) throw new Error('Не указан датасет');
    const params = new URLSearchParams({
      split,
      page: String(page),
      page_size: String(PAGE_SIZE),
    });
    if (filters?.status && filters.status !== 'all') params.set('status', filters.status);
    if (filters?.objectCount && filters.objectCount !== 'all') params.set('object_count', filters.objectCount);
    if (filters?.labeled !== undefined) params.set('labeled', String(filters.labeled));
    filters?.classIds?.forEach((classId) => params.append('class_ids', String(classId)));
    const { data } = await apiClient.get<GalleryPage>(`/datasets/${datasetId}/samples?${params.toString()}`, { signal });
    setTotalSamples(data.total);
    setLabeledSamples(data.labeled_count);
    setClassNames(Object.fromEntries(data.classes.map(({ id, name }) => [id, name])));
    return data.items;
  }, [datasetId, filters]);

  useEffect(() => {
    if (!datasetId || !sampleId || initialSample) return;
    const controller = new AbortController();
    const loadSample = async () => {
      setLoading(true);
      setError('');
      try {
        const requestedSplit = new URLSearchParams(location.search).get('split') as Split | null;
        const split = requestedSplit && ['train', 'val', 'test'].includes(requestedSplit)
          ? requestedSplit
          : 'train';
        const requestedPage = Math.max(1, Number(new URLSearchParams(location.search).get('page')) || 1);
        const { data } = await apiClient.get<GalleryPage>(`/datasets/${datasetId}/samples`, {
          params: { split, page: requestedPage, page_size: PAGE_SIZE },
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        const found = data.items.find((item) => String(item.sample_id ?? item.id) === sampleId);
        if (!found) throw new Error('Кадр не найден на этой странице галереи. Откройте редактор из карточки кадра.');
        setSample(found);
        setItems(data.items);
        setGalleryPage(requestedPage);
        setTotalSamples(data.total);
        setLabeledSamples(data.labeled_count);
        setClassNames(Object.fromEntries(data.classes.map(({ id, name }) => [id, name])));
        const datasetResponse = await apiClient.get<{ items: Array<{
          id: number;
          name: string;
          is_owner?: boolean;
          my_role?: string;
        }> }>('/datasets/', { signal: controller.signal });
        const dataset = datasetResponse.data.items.find((item) => item.id === Number(datasetId));
        if (dataset) {
          setDatasetName(dataset.name);
          setDatasetRole(dataset.is_owner ? 'owner' : dataset.my_role || '');
        }
      } catch (loadError) {
        if (!controller.signal.aborted) setError(getApiErrorMessage(loadError, 'Не удалось открыть кадр.'));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void loadSample();
    return () => controller.abort();
  }, [datasetId, initialSample, location.search, sampleId]);

  useEffect(() => {
    if (!datasetId || !sample) return;
    const id = sample.sample_id ?? sample.id;
    const controller = new AbortController();
    let active = true;
    let acquired = false;
    let heartbeat: number | undefined;

    const loadAnnotationsAndLock = async () => {
      setError('');
      setLockError('');
      setLockHeld(false);
      setSelectedAnnotationId(null);
      setPolygonPoints([]);
      setDraftRect(null);
      try {
        const { data } = await apiClient.get<{ sample_id: number; items: Annotation[] }>(
          `/datasets/${datasetId}/samples/${id}/annotations`,
          { signal: controller.signal },
        );
        if (!active) return;
        const loaded = withClientIds(data.items || []);
        setAnnotations(loaded);
        setSavedSnapshot(JSON.stringify(loaded));
        if (!canEdit) {
          setLockError(sample.status === 'in_review'
            ? 'Кадр находится на проверке и доступен только для просмотра.'
            : 'У вас нет прав на изменение разметки.');
          return;
        }

        try {
          await apiClient.post(`/datasets/${datasetId}/samples/${id}/lock`, undefined, { signal: controller.signal });
          if (!active) return;
          acquired = true;
          setLockHeld(true);
          heartbeat = window.setInterval(() => {
            void apiClient.post(`/datasets/${datasetId}/samples/${id}/lock`)
              .catch((lockRefreshError: unknown) => {
                if (active) {
                  setLockHeld(false);
                  setLockError(getApiErrorMessage(lockRefreshError, 'Блокировка кадра истекла.'));
                  if (heartbeat) window.clearInterval(heartbeat);
                  heartbeat = undefined;
                }
              });
          }, 5 * 60 * 1000);
        } catch (lockRequestError) {
          if (active) setLockError(getApiErrorMessage(lockRequestError, 'Не удалось заблокировать кадр для разметки.'));
        }
      } catch (loadError) {
        if (active && !controller.signal.aborted) {
          setError(getApiErrorMessage(loadError, 'Не удалось загрузить разметку кадра.'));
        }
      }
    };

    void loadAnnotationsAndLock();
    return () => {
      active = false;
      controller.abort();
      if (heartbeat) window.clearInterval(heartbeat);
      if (acquired) {
        void apiClient.delete(`/datasets/${datasetId}/samples/${id}/lock`)
          .catch((releaseError: unknown) => {
            console.error('Не удалось снять блокировку кадра:', releaseError);
          });
      }
    };
  }, [canEdit, datasetId, datasetRole, sample]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('input, select, textarea, [contenteditable="true"]')) {
        return;
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedAnnotationId !== null && !readOnly) {
        event.preventDefault();
        setAnnotations((current) => current.filter((item) => item.id !== selectedAnnotationId));
        setSelectedAnnotationId(null);
      }
      if (event.key === 'Escape') {
        setPolygonPoints([]);
        setDraftRect(null);
        setTool('select');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [readOnly, selectedAnnotationId]);

  const toNormalizedPoint = (event: React.PointerEvent<SVGSVGElement>): Point => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const scale = Math.min(bounds.width / naturalSize.width, bounds.height / naturalSize.height);
    const displayedWidth = naturalSize.width * scale;
    const displayedHeight = naturalSize.height * scale;
    const offsetX = (bounds.width - displayedWidth) / 2;
    const offsetY = (bounds.height - displayedHeight) / 2;
    return {
      x: clamp((event.clientX - bounds.left - offsetX) / displayedWidth),
      y: clamp((event.clientY - bounds.top - offsetY) / displayedHeight),
    };
  };

  const handleCanvasPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (naturalSize.width === 0 || naturalSize.height === 0) return;
    if (tool === 'pan') {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      panStartRef.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        originX: pan.x,
        originY: pan.y,
      };
      return;
    }
    if (readOnly && tool !== 'select') return;

    if (tool === 'select') {
      const target = event.target as SVGElement;
      const annotationId = target.closest<SVGGElement>('[data-annotation-id]')?.dataset.annotationId;
      setSelectedAnnotationId(annotationId ? Number(annotationId) : null);
      return;
    }
    if (selectedClassId === null) {
      setError('Сначала выберите класс.');
      return;
    }
    if (tool === 'polygon') {
      const point = toNormalizedPoint(event);
      setPolygonPoints((current) => [...current, point]);
      return;
    }
    drawStartRef.current = toNormalizedPoint(event);
    setDraftRect({ start: drawStartRef.current, end: drawStartRef.current });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleCanvasPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (tool === 'pan' && panStartRef.current?.pointerId === event.pointerId) {
      setPan({
        x: panStartRef.current.originX + event.clientX - panStartRef.current.x,
        y: panStartRef.current.originY + event.clientY - panStartRef.current.y,
      });
      return;
    }
    if (drawStartRef.current && (tool === 'box' || tool === 'obb')) {
      setDraftRect({ start: drawStartRef.current, end: toNormalizedPoint(event) });
    }
  };

  const addRectangle = (end: Point) => {
    const start = drawStartRef.current;
    if (!start || selectedClassId === null) return;
    const left = Math.min(start.x, end.x);
    const top = Math.min(start.y, end.y);
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);
    if (width < 0.003 || height < 0.003) return;
    const id = annotationIdRef.current--;
    const item: Annotation = tool === 'obb'
      ? {
        id,
        class_id: selectedClassId,
        obb: { x: left + width / 2, y: top + height / 2, width, height, angle_deg: 0 },
      }
      : {
        id,
        class_id: selectedClassId,
        box: { x: left + width / 2, y: top + height / 2, width, height },
      };
    setAnnotations((current) => [...current, item]);
    setSelectedAnnotationId(id);
    setError('');
  };

  const handleCanvasPointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    if (tool === 'pan') {
      panStartRef.current = null;
      return;
    }
    if (drawStartRef.current) addRectangle(toNormalizedPoint(event));
    drawStartRef.current = null;
    setDraftRect(null);
  };

  const finishPolygon = () => {
    if (selectedClassId === null || polygonPoints.length < 3) return;
    const id = annotationIdRef.current--;
    setAnnotations((current) => [...current, {
      id,
      class_id: selectedClassId,
      polygon: { points: polygonPoints },
    }]);
    setSelectedAnnotationId(id);
    setPolygonPoints([]);
    setError('');
  };

  const saveAnnotations = async () => {
    if (!sample || !datasetId || readOnly) return false;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const sampleIdValue = sample.sample_id ?? sample.id;
      const payloadItems = annotations.map((item) => ({
        class_id: item.class_id,
        ...(item.box ? { box: item.box } : {}),
        ...(item.obb ? { obb: item.obb } : {}),
        ...(item.polygon ? { polygon: item.polygon } : {}),
      }));
      const { data } = await apiClient.put<{ sample_id: number; items: Annotation[] }>(
        `/datasets/${datasetId}/samples/${sampleIdValue}/annotations`,
        { sample_id: sampleIdValue, items: payloadItems },
      );
      const savedItems = withClientIds(data.items, annotations);
      setAnnotations(savedItems);
      setSavedSnapshot(JSON.stringify(savedItems));
      setNotice('Разметка сохранена');
      return true;
    } catch (saveError) {
      setError(getApiErrorMessage(saveError, 'Не удалось сохранить разметку.'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const submitForReview = async () => {
    if (!sample || !datasetId) return;
    const saved = isDirty ? await saveAnnotations() : true;
    if (!saved) return;
    setSaving(true);
    setError('');
    try {
      const sampleIdValue = sample.sample_id ?? sample.id;
      await apiClient.post(`/datasets/${datasetId}/samples/${sampleIdValue}/submit-review`);
      setSample((current) => current ? { ...current, status: 'in_review' } : current);
      setItems((current) => current.map((item) => (
        (item.sample_id ?? item.id) === sampleIdValue
          ? { ...item, status: 'in_review' }
          : item
      )));
      setNotice('Кадр отправлен на проверку');
      window.dispatchEvent(new Event('review-queue:changed'));
    } catch (submitError) {
      setError(getApiErrorMessage(submitError, 'Не удалось отправить кадр на проверку.'));
    } finally {
      setSaving(false);
    }
  };

  const removeSelectedAnnotation = () => {
    if (selectedAnnotationId === null) return;
    setAnnotations((current) => current.filter((item) => item.id !== selectedAnnotationId));
    setSelectedAnnotationId(null);
  };

  const updateSelectedClass = (classId: number) => {
    setError('');
    if (selectedAnnotationId === null) {
      setSelectedClassId(classId);
      return;
    }
    setAnnotations((current) => current.map((item) => (
      item.id === selectedAnnotationId ? { ...item, class_id: classId } : item
    )));
    setSelectedClassId(classId);
  };

  const updateSelectedAngle = (angle_deg: number) => {
    if (selectedAnnotationId === null) return;
    setAnnotations((current) => current.map((item) => (
      item.id === selectedAnnotationId && item.obb
        ? { ...item, obb: { ...item.obb, angle_deg } }
        : item
    )));
  };

  const navigateToSample = (nextSample: Sample, nextItems = items, nextPage = galleryPage) => {
    setError('');
    setNotice('');
    updateRoute(nextSample, nextItems, nextPage, nextSample.split as Split);
  };

  const moveToPage = async (direction: -1 | 1) => {
    const currentIndex = items.findIndex((item) => (item.sample_id ?? item.id) === (sample?.sample_id ?? sample?.id));
    const nextInPage = items[currentIndex + direction];
    if (nextInPage) {
      navigateToSample(nextInPage);
      return;
    }
    const nextPage = galleryPage + direction;
    if (nextPage < 1) return;
    try {
      const nextItems = await loadSplitPage(sample?.split as Split, nextPage);
      if (nextItems.length === 0) return;
      navigateToSample(direction > 0 ? nextItems[0] : nextItems[nextItems.length - 1], nextItems, nextPage);
    } catch (pageError) {
      setError(getApiErrorMessage(pageError, 'Не удалось загрузить соседние кадры.'));
    }
  };

  const changeSplit = async (split: Split) => {
    setError('');
    try {
      const nextItems = await loadSplitPage(split, 1);
      setItems(nextItems);
      setGalleryPage(1);
      if (nextItems.length > 0) navigateToSample(nextItems[0], nextItems, 1);
      else setSample(null);
    } catch (splitError) {
      setError(getApiErrorMessage(splitError, 'Не удалось загрузить выбранный сплит.'));
    }
  };

  const draftBox = draftRect && naturalSize.width > 0
    ? {
      x: Math.min(draftRect.start.x, draftRect.end.x) * naturalSize.width,
      y: Math.min(draftRect.start.y, draftRect.end.y) * naturalSize.height,
      width: Math.abs(draftRect.end.x - draftRect.start.x) * naturalSize.width,
      height: Math.abs(draftRect.end.y - draftRect.start.y) * naturalSize.height,
    }
    : null;

  if (loading && !sample) {
    return <div className="annotation-editor-state">Загружаем кадр...</div>;
  }
  if (!sample) {
    return (
      <section className="annotation-editor-state" role="alert">
        <p>{error || 'Кадр не найден.'}</p>
        <Link className="button button--quiet" to={`/datasets/${datasetId}/gallery`}>Вернуться в галерею</Link>
      </section>
    );
  }

  const imageCountOnSplit = totalSamples || items.length;
  const splitLabel = sample.split === 'val' ? 'Val' : sample.split === 'test' ? 'Test' : 'Train';
  const currentIndex = items.findIndex((item) => (item.sample_id ?? item.id) === (sample.sample_id ?? sample.id));
  const isFirstFrame = currentIndex <= 0 && galleryPage <= 1;
  const isLastFrame = currentIndex >= items.length - 1
    && galleryPage >= Math.max(1, Math.ceil(imageCountOnSplit / PAGE_SIZE));
  const annotationColor = (classId: number) => COLORS[(classId % COLORS.length + COLORS.length) % COLORS.length];

  return (
    <section className="annotation-editor">
      <header className="annotation-editor__topbar">
        <Link aria-label="Вернуться в галерею" className="annotation-editor__back" to={`/datasets/${datasetId}/gallery`}>←</Link>
        <div className="annotation-editor__breadcrumbs">
          <strong>{datasetName || `Датасет #${datasetId}`}</strong>
          <span>/</span>
          <span>{sample.filename || `Кадр ${sample.id}`}</span>
          <span className="annotation-editor__task">{sample.task}</span>
        </div>
        <span className={`annotation-editor__save-state${isDirty ? ' is-dirty' : ''}`}>
          {error ? 'Ошибка' : saving ? 'Сохраняем...' : isDirty ? 'Есть изменения' : notice || 'Сохранено'}
        </span>
        <label className="annotation-editor__split">
          Кадр в выборке
          <select value={sample.split as Split} onChange={(event) => void changeSplit(event.target.value as Split)}>
            <option value="train">Train</option>
            <option value="val">Val</option>
            <option value="test">Test</option>
          </select>
        </label>
        <button
          className="button button--primary"
          disabled={readOnly || saving}
          onClick={() => void submitForReview()}
          type="button"
        >
          Отправить на проверку
        </button>
      </header>

      <aside className="annotation-editor__sidebar">
        <div className="annotation-editor__split-tabs">
          {(['train', 'val', 'test'] as const).map((split) => (
            <button
              className={sample.split === split ? 'is-active' : ''}
              key={split}
              onClick={() => void changeSplit(split)}
              type="button"
            >
              {split === 'train' ? 'Train' : split === 'val' ? 'Val' : 'Test'}
            </button>
          ))}
        </div>
        <div className="annotation-editor__split-summary">
          {splitLabel} · {imageCountOnSplit} кадров
          <span>размечено {labeledSamples}</span>
        </div>
        <div className="annotation-editor__progress">
          <span style={{ width: `${imageCountOnSplit ? Math.min(100, (labeledSamples / imageCountOnSplit) * 100) : 0}%` }} />
        </div>
        <div className="annotation-editor__class-select">
          <label htmlFor="annotation-class">Класс</label>
          <select
            id="annotation-class"
            disabled={readOnly || classes.length === 0}
            onChange={(event) => updateSelectedClass(Number(event.target.value))}
            value={selectedAnnotation?.class_id ?? selectedClassId ?? ''}
          >
            <option value="" disabled>Выберите класс</option>
            {classes.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
          </select>
        </div>
        <div className="annotation-editor__class-actions">
          <button
            disabled={readOnly || classSaving}
            onClick={() => openClassForm('add')}
            type="button"
          >
            + Добавить класс
          </button>
          <button
            disabled={readOnly || classSaving || selectedClassId === null}
            onClick={() => openClassForm('rename')}
            type="button"
          >
            Переименовать
          </button>
        </div>
        {classFormMode && (
          <form className="annotation-editor__class-form" onSubmit={(event) => void saveClass(event)}>
            <label htmlFor="annotation-class-name">
              {classFormMode === 'add' ? 'Название нового класса' : 'Новое название класса'}
            </label>
            <input
              autoFocus
              id="annotation-class-name"
              maxLength={255}
              onChange={(event) => setClassNameDraft(event.target.value)}
              value={classNameDraft}
            />
            {classError && <p role="alert">{classError}</p>}
            <div>
              <button disabled={classSaving} type="submit">
                {classSaving ? 'Сохраняем...' : 'Сохранить'}
              </button>
              <button
                disabled={classSaving}
                onClick={() => {
                  setClassFormMode(null);
                  setEditingClassId(null);
                  setClassError('');
                }}
                type="button"
              >
                Отмена
              </button>
            </div>
          </form>
        )}
        {selectedAnnotation?.obb && (
          <label className="annotation-editor__angle">
            Угол поворота
            <input
              disabled={readOnly}
              max="180"
              min="-180"
              onChange={(event) => updateSelectedAngle(Number(event.target.value))}
              step="1"
              type="range"
              value={selectedAnnotation.obb.angle_deg}
            />
            <span>{Math.round(selectedAnnotation.obb.angle_deg)}°</span>
          </label>
        )}
        <div className="annotation-editor__annotation-list">
          <div className="annotation-editor__section-title">Разметка <span>{annotations.length}</span></div>
          {annotations.map((annotation, index) => (
            <button
              className={`annotation-editor__annotation${annotation.id === selectedAnnotationId ? ' is-active' : ''}`}
              key={annotation.id ?? index}
              onClick={() => {
                setSelectedAnnotationId(annotation.id ?? null);
                setSelectedClassId(annotation.class_id);
              }}
              type="button"
            >
              <i style={{ background: annotationColor(annotation.class_id) }} />
              <span>{classNames[annotation.class_id] || `Класс ${annotation.class_id}`}</span>
              <small>#{index + 1}</small>
            </button>
          ))}
          {annotations.length === 0 && <p className="annotation-editor__empty">На этом кадре пока нет объектов</p>}
        </div>
        {lockError && <p className="annotation-editor__lock-message" role="status">{lockError}</p>}
        {error && <p className="annotation-editor__error" role="alert">{error}</p>}
      </aside>

      <main className="annotation-editor__workspace">
        <div className="annotation-editor__canvas-viewport">
          {naturalSize.width === 0 && <div className="annotation-editor__canvas-loading">Загружаем изображение...</div>}
          <div
            className={`annotation-canvas${tool === 'pan' ? ' is-panning' : ''}`}
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
          >
            <img
              alt={sample.filename}
              draggable={false}
              onLoad={(event) => setNaturalSize({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              })}
              src={sample.image_url}
            />
            {naturalSize.width > 0 && naturalSize.height > 0 && (
              <svg
                aria-label="Холст разметки"
                className="annotation-canvas__overlay"
                onPointerDown={handleCanvasPointerDown}
                onPointerMove={handleCanvasPointerMove}
                onPointerUp={handleCanvasPointerUp}
                onPointerCancel={handleCanvasPointerUp}
                ref={svgRef}
                viewBox={`0 0 ${naturalSize.width} ${naturalSize.height}`}
                preserveAspectRatio="xMidYMid meet"
              >
                {annotations.map((annotation, index) => {
                  const color = annotationColor(annotation.class_id);
                  const id = annotation.id ?? index;
                  const selected = annotation.id === selectedAnnotationId;
                  const strokeWidth = Math.max(2, naturalSize.width * 0.0025);
                  const label = classNames[annotation.class_id] || `Класс ${annotation.class_id}`;
                  if (annotation.box) {
                    const { x, y, width, height } = annotation.box;
                    const left = (x - width / 2) * naturalSize.width;
                    const top = (y - height / 2) * naturalSize.height;
                    return (
                      <g data-annotation-id={annotation.id} key={id}>
                        <rect
                          className="annotation-canvas__shape"
                          fill={`${color}33`}
                          height={height * naturalSize.height}
                          onPointerDown={(event) => {
                            if (tool === 'select') {
                              event.stopPropagation();
                              setSelectedAnnotationId(annotation.id ?? null);
                              setSelectedClassId(annotation.class_id);
                            }
                          }}
                          stroke={selected ? '#fff' : color}
                          strokeWidth={selected ? strokeWidth * 1.5 : strokeWidth}
                          width={width * naturalSize.width}
                          x={left}
                          y={top}
                        />
                        <text fill={color} fontSize={Math.max(14, naturalSize.width * 0.02)} fontWeight="700" x={left} y={Math.max(16, top - 4)}>{label}</text>
                      </g>
                    );
                  }
                  if (annotation.obb) {
                    const { x, y, width, height, angle_deg } = annotation.obb;
                    return (
                      <g data-annotation-id={annotation.id} key={id}>
                        <rect
                          className="annotation-canvas__shape"
                          fill={`${color}33`}
                          height={height * naturalSize.height}
                          onPointerDown={(event) => {
                            if (tool === 'select') {
                              event.stopPropagation();
                              setSelectedAnnotationId(annotation.id ?? null);
                              setSelectedClassId(annotation.class_id);
                            }
                          }}
                          stroke={selected ? '#fff' : color}
                          strokeWidth={selected ? strokeWidth * 1.5 : strokeWidth}
                          transform={`rotate(${angle_deg} ${x * naturalSize.width} ${y * naturalSize.height})`}
                          width={width * naturalSize.width}
                          x={(x - width / 2) * naturalSize.width}
                          y={(y - height / 2) * naturalSize.height}
                        />
                        <text fill={color} fontSize={Math.max(14, naturalSize.width * 0.02)} fontWeight="700" x={x * naturalSize.width} y={y * naturalSize.height - height * naturalSize.height / 2}>{label}</text>
                      </g>
                    );
                  }
                  const points = annotation.polygon?.points || [];
                  if (points.length < 3) return null;
                  const pointsString = points.map((point) => `${point.x * naturalSize.width},${point.y * naturalSize.height}`).join(' ');
                  return (
                    <g data-annotation-id={annotation.id} key={id}>
                      <polygon
                        className="annotation-canvas__shape"
                        fill={`${color}33`}
                        onPointerDown={(event) => {
                          if (tool === 'select') {
                            event.stopPropagation();
                            setSelectedAnnotationId(annotation.id ?? null);
                            setSelectedClassId(annotation.class_id);
                          }
                        }}
                        points={pointsString}
                        stroke={selected ? '#fff' : color}
                        strokeWidth={selected ? strokeWidth * 1.5 : strokeWidth}
                      />
                      <text fill={color} fontSize={Math.max(14, naturalSize.width * 0.02)} fontWeight="700" x={points[0].x * naturalSize.width} y={points[0].y * naturalSize.height - 4}>{label}</text>
                    </g>
                  );
                })}
                {draftBox && selectedClassId !== null && (
                  <rect
                    fill={`${annotationColor(selectedClassId)}22`}
                    height={draftBox.height}
                    pointerEvents="none"
                    stroke={annotationColor(selectedClassId)}
                    strokeDasharray="8 5"
                    strokeWidth={Math.max(2, naturalSize.width * 0.0025)}
                    width={draftBox.width}
                    x={draftBox.x}
                    y={draftBox.y}
                  />
                )}
                {polygonPoints.length > 0 && (
                  <g pointerEvents="none">
                    <polyline
                      fill="none"
                      points={polygonPoints.map((point) => `${point.x * naturalSize.width},${point.y * naturalSize.height}`).join(' ')}
                      stroke={selectedClassId !== null ? annotationColor(selectedClassId) : '#fff'}
                      strokeDasharray="6 4"
                      strokeWidth={Math.max(2, naturalSize.width * 0.002)}
                    />
                    {polygonPoints.map((point, index) => (
                      <circle key={index} cx={point.x * naturalSize.width} cy={point.y * naturalSize.height} fill="#fff" r={Math.max(4, naturalSize.width * 0.004)} />
                    ))}
                  </g>
                )}
              </svg>
            )}
          </div>
        </div>

        <div className="annotation-editor__visibility">◉ Разметка · {annotations.length}</div>
        <div aria-label="Инструменты разметки" className="annotation-editor__tools">
          {([
            ['pan', 'Перемещение', '✋'],
            ['select', 'Выбор объекта', '↖'],
            [sample.task === 'obb' ? 'obb' : sample.task === 'segment' ? 'polygon' : 'box',
              sample.task === 'segment' ? 'Многоугольник' : sample.task === 'obb' ? 'Поворотная рамка' : 'Прямоугольник',
              sample.task === 'segment' ? '⬠' : '▢'],
          ] as Array<[Tool, string, string]>).map(([value, label, icon]) => (
            <button
              aria-label={label}
              aria-pressed={tool === value}
              className={tool === value ? 'is-active' : ''}
              disabled={readOnly && value !== 'pan' && value !== 'select'}
              key={value}
              onClick={() => {
                setTool(value);
                setPolygonPoints([]);
                setDraftRect(null);
              }}
              title={label}
              type="button"
            >
              {icon}
            </button>
          ))}
          <button aria-label="Отменить текущий контур" disabled={polygonPoints.length === 0} onClick={() => setPolygonPoints([])} title="Отменить контур" type="button">↶</button>
          <button aria-label="Удалить выбранный объект" disabled={readOnly || selectedAnnotationId === null} onClick={removeSelectedAnnotation} title="Удалить объект" type="button">⌫</button>
        </div>

        {polygonPoints.length >= 3 && (
          <button className="annotation-editor__finish-polygon" onClick={finishPolygon} type="button">
            Завершить контур
          </button>
        )}

        <div className="annotation-editor__bottom-bar">
          <div className="annotation-editor__zoom">
            <button aria-label="Уменьшить масштаб" disabled={zoom <= 0.5} onClick={() => setZoom((value) => Math.max(0.5, value - 0.1))} type="button">−</button>
            <span>{Math.round(zoom * 100)}%</span>
            <button aria-label="Увеличить масштаб" disabled={zoom >= 2.5} onClick={() => setZoom((value) => Math.min(2.5, value + 0.1))} type="button">+</button>
            <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} type="button">По размеру</button>
          </div>
          <div className="annotation-editor__frame-nav">
            <button aria-label="Предыдущий кадр" disabled={isFirstFrame} onClick={() => void moveToPage(-1)} type="button">‹</button>
            <span>Кадр {(galleryPage - 1) * PAGE_SIZE + Math.max(1, currentIndex + 1)} из {Math.max(totalSamples, imageCountOnSplit)} · {splitLabel}</span>
            <button aria-label="Следующий кадр" disabled={isLastFrame} onClick={() => void moveToPage(1)} type="button">›</button>
          </div>
          <button
            className="button button--primary annotation-editor__save"
            disabled={readOnly || !isDirty || saving}
            onClick={() => void saveAnnotations()}
            type="button"
          >
            {saving ? 'Сохраняем...' : 'Сохранить'}
          </button>
        </div>
      </main>
    </section>
  );
};
