import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UndoHistory } from './undoHistory.ts';

test('undo/redo restores creation, class changes, geometry and deletion in order', () => {
  const history = new UndoHistory([]);
  const shape = { id: -1, class_id: 0, box: { x: .5, y: .5, width: .2, height: .2 } };
  const moved = { ...shape, class_id: 2, box: { ...shape.box, x: .7 } };
  history.set([shape]); history.set([moved]); history.set([]);
  history.undo(); assert.deepEqual(history.value, [moved]);
  history.undo(); assert.deepEqual(history.value, [shape]);
  history.undo(); assert.deepEqual(history.value, []); assert.equal(history.canUndo, false);
  history.redo(); history.redo(); assert.deepEqual(history.value, [moved]);
  history.redo(); assert.deepEqual(history.value, []); assert.equal(history.canRedo, false);
});

test('a drag with many pointer events is one undo step', () => {
  const history = new UndoHistory({ x: 0 });
  history.begin(); for (let x = 1; x <= 100; x++) history.set({ x }); history.commit();
  history.undo(); assert.deepEqual(history.value, { x: 0 }); assert.equal(history.canUndo, false);
  history.redo(); assert.deepEqual(history.value, { x: 100 });
});

test('cancelled gesture preserves prior redo branch and adds no history', () => {
  const history = new UndoHistory(0);
  history.set(1); history.undo(); history.begin(); history.set(2); history.cancel();
  assert.equal(history.value, 0); assert.equal(history.canUndo, false);
  history.redo(); assert.equal(history.value, 1);
});

test('new edits after undo clear redo; no-op edits do not', () => {
  const history = new UndoHistory(0);
  history.set(1); history.undo(); history.set(0); assert.equal(history.canRedo, true);
  history.set(2); assert.equal(history.canRedo, false);
});

test('polygon points can be undone and completion is atomic', () => {
  const history = new UndoHistory({ annotations: [], points: [] });
  history.set({ annotations: [], points: [1] }); history.set({ annotations: [], points: [1, 2, 3] });
  history.begin(); history.set({ annotations: [{ points: [1, 2, 3] }], points: [1, 2, 3] });
  history.set({ annotations: [{ points: [1, 2, 3] }], points: [] }); history.commit();
  history.undo(); assert.deepEqual(history.value, { annotations: [], points: [1, 2, 3] });
  history.redo(); assert.deepEqual(history.value, { annotations: [{ points: [1, 2, 3] }], points: [] });
});

test('frame reset clears both branches and active gestures', () => {
  const history = new UndoHistory(0); history.set(1); history.undo(); history.begin(); history.set(2);
  history.reset(42); history.commit(); history.undo(); history.redo();
  assert.equal(history.value, 42); assert.equal(history.canUndo, false); assert.equal(history.canRedo, false);
});

test('undo during a gesture cancels the gesture without undoing an earlier action', () => {
  const history = new UndoHistory(0); history.set(1); history.begin(); history.set(2); history.undo();
  assert.equal(history.value, 1); history.undo(); assert.equal(history.value, 0);
});

test('history retains a bounded number of edits', () => {
  const history = new UndoHistory(0, 3); for (let i = 1; i <= 5; i++) history.set(i);
  history.undo(); history.undo(); history.undo(); history.undo(); assert.equal(history.value, 2);
});
