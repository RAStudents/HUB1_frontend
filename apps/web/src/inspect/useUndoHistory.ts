import { useCallback, useState } from 'react';
import { UndoHistory } from './undoHistory';
export function useUndoHistory<T>(initial: T) {
  const [history] = useState(() => new UndoHistory(initial));
  const [snapshot, setSnapshot] = useState({ value: initial, canUndo: false, canRedo: false });
  const refresh = useCallback(() => setSnapshot({ value: history.value, canUndo: history.canUndo, canRedo: history.canRedo }), [history]);
  const setValue = useCallback((action: T | ((current: T) => T)) => {
    history.set(typeof action === 'function' ? (action as (current: T) => T)(history.value) : action); refresh();
  }, [history, refresh]);
  const begin = useCallback(() => { history.begin(); refresh(); }, [history, refresh]);
  const commit = useCallback(() => { history.commit(); refresh(); }, [history, refresh]);
  const cancel = useCallback(() => { history.cancel(); refresh(); }, [history, refresh]);
  const undo = useCallback(() => { history.undo(); refresh(); }, [history, refresh]);
  const redo = useCallback(() => { history.redo(); refresh(); }, [history, refresh]);
  const reset = useCallback((value: T) => { history.reset(value); refresh(); }, [history, refresh]);
  return { ...snapshot, setValue, begin, commit, cancel, undo, redo, reset };
}
