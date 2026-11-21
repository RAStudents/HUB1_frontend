import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../api/client';
import { getApiErrorMessage } from '../api/errorMessage';
import { annotationHandles, editAnnotation } from './annotationGeometry';
import { AnnotationShape } from './AnnotationShape';
import { annotationColor } from './annotationStyle';
import { EditorComments } from './EditorComments';
import { EditorIcon } from './EditorIcon';
import { GALLERY_PAGE_SIZE as PAGE_SIZE } from './galleryPagination';
import { EditorFrames, type FrameSplitFilter } from './EditorFrames';
import { useUndoHistory } from './useUndoHistory';
import { useAuth } from '../auth/AuthContext';

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
  dataset_id: string;
  split: string;
  status: string;
  image_url: string;
  thumb_url?: string | null;
  objects_count?: number;
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


const clamp = (value: number) => Math.min(1, Math.max(0, value));

export const AnnotationEditorPage = () => {
  const { datasetId, sampleId } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const [framesOpen, setFramesOpen] = useState(true);
  const [framesWidth, setFramesWidth] = useState<number | null>(null);
  const [frameNavigating, setFrameNavigating] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'classes' | 'layers' | 'comments'>('comments');
  const [commentCount, setCommentCount] = useState(0);
  const [annotationsVisible, setAnnotationsVisible] = useState(true);
  const [browseSplit, setBrowseSplit] = useState<FrameSplitFilter | null>(() => {
    const split = new URLSearchParams(location.search).get('split');
    return split && ['all', 'train', 'val', 'test'].includes(split) ? split as FrameSplitFilter : null;
  });
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
  const { value: annotationState, setValue: setAnnotationState, canUndo, canRedo,
    begin: beginHistoryGesture, commit: commitHistoryGesture, cancel: cancelHistoryGesture,
    undo: undoHistory, redo: redoHistory, reset: resetHistory,
  } = useUndoHistory<{ annotations: Annotation[]; polygonPoints: Point[] }>({ annotations: [], polygonPoints: [] });
  const { annotations, polygonPoints } = annotationState;
  const setAnnotations = useCallback((action: Annotation[] | ((current: Annotation[]) => Annotation[])) => {
    setAnnotationState(state => ({ ...state, annotations: typeof action === 'function' ? action(state.annotations) : action }));
  }, [setAnnotationState]);
  const setPolygonPoints = useCallback((action: Point[] | ((current: Point[]) => Point[])) => {
    setAnnotationState(state => ({ ...state, polygonPoints: typeof action === 'function' ? action(state.polygonPoints) : action }));
  }, [setAnnotationState]);
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [tool, setTool] = useState<Tool>('select');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<number | null>(null);
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
  const editDragRef = useRef<{
    pointerId: number; sampleId: string | undefined; original: Annotation;
    start: Point; handle: number | 'move' | 'rotate';
  } | null>(null);
  const isDirty = JSON.stringify(annotations) !== savedSnapshot;
  const isEditableRole = datasetRole === 'owner' || datasetRole === 'labeler';
  const canEdit = isEditableRole && sample?.status !== 'in_review';
  const readOnly = !canEdit || !lockHeld || saving;
  const classes = useMemo(
    () => Object.entries(classNames).map(([id, name]) => ({ id: Number(id), name })).sort((a, b) => a.id - b.id),
    [classNames],
  );
  const selectedClassId = selectedClassIdState ?? classes[0]?.id ?? null;
  const selectedAnnotation = annotations.find((item) => item.id === selectedAnnotationId);

  const withClientIds = (itemsToNormalize: Annotation[], previous: Annotation[] = []) => (
    itemsToNormalize.map((item, index) => ({
      ...item,
      id: previous[index]?.id ?? item.id ?? annotationIdRef.current--,
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

  const loadSplitPage = useCallback(async (split: Split | 'all', page: number, signal?: AbortSignal) => {
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
    if (!data.items.length) return data.items;
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
        const requestedSplit = new URLSearchParams(location.search).get('split') as Split | 'all' | null;
        const split = requestedSplit && ['all', 'train', 'val', 'test'].includes(requestedSplit)
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
          id: string;
          name: string;
          is_owner?: boolean;
          my_role?: string;
        }> }>('/datasets/', { signal: controller.signal });
        const dataset = datasetResponse.data.items.find((item) => item.id === datasetId);
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
      resetHistory({ annotations: [], polygonPoints: [] });
      editDragRef.current = null;
      drawStartRef.current = null;
      setDraftRect(null);
      try {
        const { data } = await apiClient.get<{ sample_id: number; items: Annotation[] }>(
          `/datasets/${datasetId}/samples/${id}/annotations`,
          { signal: controller.signal },
        );
        if (!active) return;
        const loaded = withClientIds(data.items || []);
        resetHistory({ annotations: loaded, polygonPoints: [] });
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
  }, [canEdit, datasetId, datasetRole, sample, resetHistory]);

  const applyHistory = useCallback((direction: 'undo' | 'redo') => {
    if (readOnly || (direction === 'redo' && !canRedo)) return;
    editDragRef.current = null;
    drawStartRef.current = null;
    setDraftRect(null);
    setSelectedAnnotationId(null);
    if (direction === 'undo') undoHistory(); else redoHistory();
    setNotice('');
  }, [readOnly, canRedo, undoHistory, redoHistory]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('input, select, textarea, [contenteditable="true"]')) {
        return;
      }
      const undoKey = event.code === 'KeyZ';
      const redoKey = event.code === 'KeyY' || (undoKey && event.shiftKey);
      if ((event.ctrlKey || event.metaKey) && !event.altKey && (undoKey || redoKey)) {
        event.preventDefault();
        applyHistory(redoKey ? 'redo' : 'undo');
        return;
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedAnnotationId !== null && !readOnly) {
        event.preventDefault();
        setAnnotations((current) => current.filter((item) => item.id !== selectedAnnotationId));
        setSelectedAnnotationId(null);
      }
      if (event.key === 'Escape') {
        const drag = editDragRef.current;
        if (drag) cancelHistoryGesture();
        editDragRef.current = null;
        drawStartRef.current = null;
        setPolygonPoints([]);
        setDraftRect(null);
        setTool('select');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [readOnly, selectedAnnotationId, applyHistory, cancelHistoryGesture, setAnnotations, setPolygonPoints]);

  const toNormalizedPoint = (event: React.PointerEvent<SVGSVGElement>, limitToImage = true): Point => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const scale = Math.min(bounds.width / naturalSize.width, bounds.height / naturalSize.height);
    const displayedWidth = naturalSize.width * scale;
    const displayedHeight = naturalSize.height * scale;
    const offsetX = (bounds.width - displayedWidth) / 2;
    const offsetY = (bounds.height - displayedHeight) / 2;
    const x = (event.clientX - bounds.left - offsetX) / displayedWidth;
    const y = (event.clientY - bounds.top - offsetY) / displayedHeight;
    return limitToImage ? { x: clamp(x), y: clamp(y) } : { x, y };
  };

  const handleCanvasPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 || editDragRef.current || drawStartRef.current || naturalSize.width === 0 || naturalSize.height === 0) return;
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

    const target = event.target as SVGElement;
    const handleName = target.closest<SVGElement>('[data-edit-handle]')?.dataset.editHandle;
    if (tool === 'select' || (tool === 'obb' && handleName === 'rotate')) {
      const annotationId = target.closest<SVGGElement>('[data-annotation-id]')?.dataset.annotationId;
      const annotation = annotations.find(item => item.id === Number(annotationId));
      setSelectedAnnotationId(annotationId ? Number(annotationId) : null);
      if (annotationId && annotation) {
        setSelectedClassId(annotation.class_id);
        if (!readOnly) {
          event.preventDefault();
          const handle = handleName === 'rotate' ? 'rotate' : handleName === undefined ? 'move' : Number(handleName);
          beginHistoryGesture();
          editDragRef.current = {
            pointerId: event.pointerId, sampleId, original: annotation,
            start: toNormalizedPoint(event, handle !== 'rotate'), handle,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }
      }
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

  const updateDraggedAnnotation = (event: React.PointerEvent<SVGSVGElement>) => {
    const drag = editDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return false;
    if (readOnly || drag.sampleId !== sampleId) {
      editDragRef.current = null;
      if (drag.sampleId === sampleId) cancelHistoryGesture();
      return true;
    }
    const point = toNormalizedPoint(event, drag.handle !== 'rotate');
    const updated = editAnnotation(drag.original, drag.start, point, drag.handle, naturalSize);
    setAnnotations(current => current.map(item => item.id === drag.original.id ? updated : item));
    return true;
  };

  const handleCanvasPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (updateDraggedAnnotation(event)) return;
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
    if (updateDraggedAnnotation(event)) {
      commitHistoryGesture();
      editDragRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }
    if (tool === 'pan') {
      panStartRef.current = null;
      return;
    }
    if (drawStartRef.current) addRectangle(toNormalizedPoint(event));
    drawStartRef.current = null;
    setDraftRect(null);
  };

  const handleCanvasPointerCancel = (event: React.PointerEvent<SVGSVGElement>) => {
    const drag = editDragRef.current;
    if (drag && drag.pointerId !== event.pointerId) return;
    if (drag && drag.sampleId === sampleId) cancelHistoryGesture();
    editDragRef.current = null;
    drawStartRef.current = null;
    panStartRef.current = null;
    setDraftRect(null);
  };

  const finishPolygon = () => {
    if (selectedClassId === null || polygonPoints.length < 3) return;
    const id = annotationIdRef.current--;
    beginHistoryGesture();
    setAnnotations((current) => [...current, {
      id,
      class_id: selectedClassId,
      polygon: { points: polygonPoints },
    }]);
    setSelectedAnnotationId(id);
    setPolygonPoints([]);
    commitHistoryGesture();
    setError('');
  };

  const withCurrentAnnotations = (frames: Sample[]) => frames.map(frame =>
    (frame.sample_id ?? frame.id) === (sample?.sample_id ?? sample?.id)
      ? { ...frame, annotations, objects_count: annotations.length }
      : frame,
  );

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
      await apiClient.put<{ sample_id: number; items: Annotation[] }>(
        `/datasets/${datasetId}/samples/${sampleIdValue}/annotations`,
        { sample_id: sampleIdValue, items: payloadItems },
      );
      setSavedSnapshot(JSON.stringify(annotations));
      setItems(withCurrentAnnotations);
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

  const navigateToSample = (nextSample: Sample, nextItems = withCurrentAnnotations(items), nextPage = galleryPage) => {
    setError('');
    setNotice('');
    updateRoute(nextSample, nextItems, nextPage, browseSplit ?? nextSample.split);
  };

  const moveToPage = async (direction: -1 | 1) => {
    if (frameNavigating || saving) return;
    if (isDirty && !await saveAnnotations()) return;
    const currentIndex = items.findIndex((item) => (item.sample_id ?? item.id) === (sample?.sample_id ?? sample?.id));
    const nextInPage = items[currentIndex + direction];
    if (nextInPage) {
      navigateToSample(nextInPage);
      return;
    }
    const nextPage = galleryPage + direction;
    if (nextPage < 1) return;
    setFrameNavigating(true);
    try {
      const nextItems = await loadSplitPage(browseSplit ?? sample?.split as Split, nextPage);
      if (nextItems.length === 0) return;
      navigateToSample(direction > 0 ? nextItems[0] : nextItems[nextItems.length - 1], nextItems, nextPage);
    } catch (pageError) {
      setError(getApiErrorMessage(pageError, 'Не удалось загрузить соседние кадры.'));
    } finally {
      setFrameNavigating(false);
    }
  };

  const changeSplit = async (split: FrameSplitFilter) => {
    if (!sample || frameNavigating || saving || split === (browseSplit ?? sample.split)) return;

    setFrameNavigating(true);
    setError('');
    try {
      if (isDirty && !await saveAnnotations()) return;
      const nextItems = await loadSplitPage(split, 1);
      if (!nextItems.length) return 'В этой выборке нет подходящих кадров.';

      const currentId = sample.sample_id ?? sample.id;
      const currentFrame = nextItems.find(item => (item.sample_id ?? item.id) === currentId);
      setBrowseSplit(split);
      setNotice('');
      updateRoute(currentFrame ? sample : nextItems[0], nextItems, 1, split);
    } catch (splitError) {
      return getApiErrorMessage(splitError, 'Не удалось загрузить кадры выбранной выборки.');
    } finally {
      setFrameNavigating(false);
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
  const selectedObb = selectedAnnotation?.obb;
  const rotationFrame = draftBox
    ? { x: draftBox.x + draftBox.width / 2, y: draftBox.y + draftBox.height / 2, top: draftBox.y, angle: 0 }
    : selectedObb && {
      x: selectedObb.x * naturalSize.width,
      y: selectedObb.y * naturalSize.height,
      top: (selectedObb.y - selectedObb.height / 2) * naturalSize.height,
      angle: selectedObb.angle_deg,
    };
  const rotationRadius = Math.max(10, naturalSize.width * 0.01) / zoom;

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
  const frameSplit = sample.split === 'val' || sample.split === 'valid' ? 'val' : sample.split === 'test' ? 'test' : 'train';
  const selectedSplit = browseSplit ?? frameSplit;
  const splitLabels = { all: 'Все', train: 'Train', val: 'Val', test: 'Test' };
  const splitLabel = splitLabels[selectedSplit];
  const currentIndex = items.findIndex((item) => (item.sample_id ?? item.id) === (sample.sample_id ?? sample.id));
  const isFirstFrame = currentIndex <= 0 && galleryPage <= 1;
  const isLastFrame = currentIndex >= items.length - 1
    && galleryPage >= Math.max(1, Math.ceil(imageCountOnSplit / PAGE_SIZE));

  return (
    <section className={`annotation-editor annotation-editor--frames${framesOpen ? '' : ' is-frames-collapsed'}`} style={framesWidth === null ? undefined : { '--frames-width': `${framesWidth}px` } as React.CSSProperties}>
      <header className="annotation-editor__topbar">
        <Link aria-label="Вернуться в галерею" className="annotation-editor__back" to={`/datasets/${datasetId}/gallery`}><EditorIcon name="back" /></Link>
        <div className="annotation-editor__breadcrumbs">
          <strong>{datasetName || `Датасет #${datasetId}`}</strong>
          <span>/</span>
          <span>{sample.filename || `Кадр ${sample.id}`}</span>
          <span className="annotation-editor__task"><EditorIcon name="box" />{sample.task === 'segment' ? 'Polygon' : sample.task === 'obb' ? 'Oriented Box' : 'Bounding Box'}</span>
        </div>
        <span className={`annotation-editor__save-state${isDirty ? ' is-dirty' : ''}`}>
          {!isDirty && !error && <EditorIcon name="check" />}{error ? 'Ошибка' : saving ? 'Сохраняем...' : isDirty ? 'Есть изменения' : notice || 'Сохранено'}
        </span>
        <button
          className="button button--primary annotation-editor__action annotation-editor__save"
          disabled={readOnly || !isDirty || saving}
          onClick={() => void saveAnnotations()}
          type="button"
        >
          {saving ? 'Сохраняем...' : 'Сохранить'}
        </button>
        <button
          className="button annotation-editor__action annotation-editor__review"
          disabled={readOnly || saving}
          onClick={() => void submitForReview()}
          type="button"
        >
          <EditorIcon name="shield" /> Отправить на проверку
        </button>
        <span className="annotation-editor__user" title={user?.display_name || user?.email}>{(user?.display_name || user?.email || 'U').slice(0, 1).toUpperCase()}</span>
      </header>

      <aside className="annotation-editor__sidebar">
        <div className="annotation-editor__split-summary">
          {splitLabel} · {imageCountOnSplit} кадров
          <span>размечено {labeledSamples}</span>
        </div>
        <div className="annotation-editor__progress">
          <span style={{ width: `${imageCountOnSplit ? Math.min(100, (labeledSamples / imageCountOnSplit) * 100) : 0}%` }} />
        </div>
        <div className="annotation-editor__panel-tabs" role="tablist" aria-label="Панель редактора">
          {([['classes', 'Классы', classes.length], ['layers', 'Слои', annotations.length], ['comments', 'Комментарии', commentCount]] as const).map(([value, label, count]) => (
            <button key={value} role="tab" aria-selected={sidebarTab === value} aria-controls={`editor-panel-${value}`} id={`editor-tab-${value}`} onClick={() => setSidebarTab(value)} type="button">{label}<span>{count}</span></button>
          ))}
        </div>
        <div className="annotation-editor__sidebar-content" id="editor-panel-classes" role="tabpanel" aria-labelledby="editor-tab-classes" hidden={sidebarTab !== 'classes'}>
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
              onPointerDown={beginHistoryGesture}
              onPointerUp={commitHistoryGesture}
              onLostPointerCapture={commitHistoryGesture}
              onPointerCancel={cancelHistoryGesture}
              onBlur={commitHistoryGesture}
              onChange={(event) => updateSelectedAngle(Number(event.target.value))}
              step="1"
              type="range"
              value={selectedAnnotation.obb.angle_deg}
            />
            <span>{Math.round(selectedAnnotation.obb.angle_deg)}°</span>
          </label>
        )}
        </div>
        <div className="annotation-editor__annotation-list" id="editor-panel-layers" role="tabpanel" aria-labelledby="editor-tab-layers" hidden={sidebarTab !== 'layers'}>
          <div className="annotation-editor__section-title">Разметка <span>{annotations.length}</span></div>
          {annotations.map((annotation, index) => (
            <button
              className={`annotation-editor__annotation${annotation.id === selectedAnnotationId ? ' is-active' : ''}`}
              key={annotation.id ?? index}
              onClick={() => {
                setSelectedAnnotationId(annotation.id ?? null);
                setSelectedClassId(annotation.class_id);
                setTool('select');
                setAnnotationsVisible(true);
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
        <div className="annotation-editor__comments-panel" id="editor-panel-comments" role="tabpanel" aria-labelledby="editor-tab-comments" hidden={sidebarTab !== 'comments'}>
          {datasetId && <EditorComments key={`${datasetId}/${sample.id}`} datasetId={datasetId} sampleId={sample.sample_id ?? sample.id} annotationIndex={selectedAnnotation ? annotations.findIndex(item => item.id === selectedAnnotation.id) : null} canWrite={isEditableRole} isOwner={datasetRole === 'owner'} onCountChange={setCommentCount} />}
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
                style={{ visibility: annotationsVisible ? 'visible' : 'hidden' }}
                aria-label="Холст разметки"
                className="annotation-canvas__overlay"
                onPointerDown={handleCanvasPointerDown}
                onPointerMove={handleCanvasPointerMove}
                onPointerUp={handleCanvasPointerUp}
                onPointerCancel={handleCanvasPointerCancel}
                onLostPointerCapture={handleCanvasPointerCancel}
                ref={svgRef}
                viewBox={`0 0 ${naturalSize.width} ${naturalSize.height}`}
                preserveAspectRatio="xMidYMid meet"
              >
                {annotations.map((annotation, index) => (
                  <AnnotationShape
                    key={annotation.id ?? index}
                    annotation={annotation}
                    size={naturalSize}
                    label={classNames[annotation.class_id] || `Класс ${annotation.class_id}`}
                    selected={annotation.id === selectedAnnotationId}
                  />
                ))}
                {selectedAnnotation && tool === 'select' && !readOnly && (
                  <g data-annotation-id={selectedAnnotation.id}>
                    {annotationHandles(selectedAnnotation, naturalSize).map((point, index) => (
                      <rect
                        aria-label={selectedAnnotation.polygon ? `Вершина ${index + 1}` : `Угол ${index + 1}`}
                        className="annotation-canvas__edit-handle"
                        x={point.x * naturalSize.width - Math.max(4, naturalSize.width * 0.004) / zoom}
                        y={point.y * naturalSize.height - Math.max(4, naturalSize.width * 0.004) / zoom}
                        data-edit-handle={index}
                        key={index}
                        width={Math.max(8, naturalSize.width * 0.008) / zoom}
                        height={Math.max(8, naturalSize.width * 0.008) / zoom}
                        strokeWidth={Math.max(1, naturalSize.width * 0.0015) / zoom}
                      />
                    ))}
                  </g>
                )}
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
                {rotationFrame && !readOnly && (tool === 'select' || tool === 'obb') && (
                  <g
                    data-annotation-id={draftBox ? undefined : selectedAnnotationId}
                    transform={`rotate(${rotationFrame.angle} ${rotationFrame.x} ${rotationFrame.y})`}
                  >
                    <line
                      pointerEvents="none"
                      stroke="var(--app-accent)"
                      strokeWidth={rotationRadius / 5}
                      x1={rotationFrame.x}
                      x2={rotationFrame.x}
                      y1={rotationFrame.top}
                      y2={rotationFrame.top - rotationRadius * 2.5}
                    />
                    <g transform={`translate(${rotationFrame.x} ${rotationFrame.top - rotationRadius * 2.5}) scale(${rotationRadius})`}>
                      <circle
                        aria-label="Повернуть рамку"
                        className={draftBox ? 'annotation-canvas__rotate-preview' : 'annotation-canvas__rotate-handle'}
                        data-edit-handle={draftBox ? undefined : 'rotate'}
                        r={1}
                        strokeWidth={0.15}
                      >
                        {!draftBox && <title>Перетащите, чтобы повернуть рамку</title>}
                      </circle>
                      <path
                        d="M -.48 -.18 A .52 .52 0 1 1 -.35 .38 M -.53 -.50 L -.48 -.18 L -.16 -.23"
                        fill="none"
                        pointerEvents="none"
                        stroke="var(--app-accent)"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={0.16}
                      />
                    </g>
                  </g>
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

        <div className="editor-workspace-controls" aria-label="Вид холста">
          <span className="editor-workspace-controls__frame-split">Кадр в выборке {splitLabels[frameSplit]}</span>
          <button type="button" title={annotationsVisible ? 'Скрыть разметку' : 'Показать разметку'} aria-label="Видимость разметки" aria-pressed={annotationsVisible} onClick={() => setAnnotationsVisible(value => !value)}><EditorIcon name="eye" /></button>
          <span className="editor-workspace-controls__divider" aria-hidden="true" />
          <button type="button" title={framesOpen ? 'Скрыть панель кадров' : 'Показать панель кадров'} aria-label="Панель кадров" aria-expanded={framesOpen} onClick={() => setFramesOpen(value => !value)}><EditorIcon name="panels" /></button>
        </div>
        <div aria-label="Инструменты разметки" className="annotation-editor__tools">
          {([
            ['pan', 'Перемещение', 'hand'],
            ['select', 'Выбор и редактирование объекта', 'select'],
            [sample.task === 'obb' ? 'obb' : sample.task === 'segment' ? 'polygon' : 'box',
              sample.task === 'segment' ? 'Многоугольник' : sample.task === 'obb' ? 'Поворотная рамка' : 'Прямоугольник',
              sample.task === 'segment' ? 'polygon' : 'box'],
          ] as Array<[Tool, string, string]>).map(([value, label, icon]) => (
            <button
              aria-label={label}
              aria-pressed={tool === value}
              className={tool === value ? 'is-active' : ''}
              disabled={readOnly && value !== 'pan' && value !== 'select'}
              key={value}
              onClick={() => {
                setTool(value);
                setAnnotationsVisible(true);
                setPolygonPoints([]);
                setDraftRect(null);
              }}
              title={label}
              type="button"
            >
              <EditorIcon name={icon} />
            </button>
          ))}
          <span className="annotation-editor__tool-divider" />
          <button aria-label="Отменить действие" disabled={readOnly || !canUndo} onClick={() => applyHistory('undo')} title="Отменить (Ctrl+Z)" type="button"><EditorIcon name="undo" /></button>
          <button aria-label="Повторить действие" disabled={readOnly || !canRedo} onClick={() => applyHistory('redo')} title="Повторить (Ctrl+Shift+Z / Ctrl+Y)" type="button"><EditorIcon name="redo" /></button>
          <button aria-label="Удалить выбранный объект" disabled={readOnly || selectedAnnotationId === null} onClick={removeSelectedAnnotation} title="Удалить объект" type="button"><EditorIcon name="delete" /></button>
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
        </div>
      </main>
      {framesOpen && <EditorFrames split={selectedSplit} onSplitChange={changeSplit} onResize={setFramesWidth} items={items} selectedId={sample.sample_id ?? sample.id} currentAnnotations={annotations} classNames={classNames} position={(galleryPage - 1) * PAGE_SIZE + Math.max(1, currentIndex + 1)} total={Math.max(totalSamples, imageCountOnSplit)} busy={saving || frameNavigating} isFirst={isFirstFrame} isLast={isLastFrame} onMove={direction => void moveToPage(direction)} onSelect={async frame => {
        if ((frame.sample_id ?? frame.id) === (sample.sample_id ?? sample.id) || saving || frameNavigating) return;
        if (isDirty && !await saveAnnotations()) return;
        const next = items.find(item => (item.sample_id ?? item.id) === (frame.sample_id ?? frame.id));
        if (next) navigateToSample(next);
      }} />}
    </section>
  );
};
