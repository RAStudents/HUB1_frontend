import { test } from 'node:test';
import assert from 'node:assert/strict';
import { annotationHandles, editAnnotation } from './annotationGeometry.ts';

const size = { width: 1200, height: 600 };
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);

test('moving an existing box preserves its size, class, ID and source object', () => {
  const original = { id: 42, class_id: 3, box: { x: .4, y: .5, width: .2, height: .4 } };
  const result = editAnnotation(original, { x: .4, y: .5 }, { x: .6, y: .6 }, 'move', size);
  close(result.box.x, .6);
  close(result.box.y, .6);
  assert.equal(result.box.width, .2);
  assert.equal(result.id, 42);
  assert.equal(result.class_id, 3);
  assert.equal(original.box.x, .4);
});

test('dragging outside the image stops the whole polygon at the boundary', () => {
  const original = { class_id: 0, polygon: { points: [{ x: .1, y: .2 }, { x: .8, y: .3 }, { x: .4, y: .9 }] } };
  const result = editAnnotation(original, { x: .4, y: .4 }, { x: 1, y: 1 }, 'move', size);
  close(result.polygon.points[1].x, 1);
  close(result.polygon.points[2].y, 1);
  close(result.polygon.points[1].x - result.polygon.points[0].x, .7);
});

test('resizing a rotated box keeps the opposite corner fixed on a non-square image', () => {
  const original = { id: 7, class_id: 0, obb: { x: .5, y: .5, width: .2, height: .2, angle_deg: 35 } };
  const handles = annotationHandles(original, size);
  const result = editAnnotation(original, handles[2], { x: handles[2].x + .1, y: handles[2].y + .2 }, 2, size);
  const updatedHandles = annotationHandles(result, size);
  close(handles[0].x, updatedHandles[0].x);
  close(handles[0].y, updatedHandles[0].y);
  assert.equal(result.obb.angle_deg, 35);
  assert.ok(result.obb.width > original.obb.width);
  assert.ok(result.obb.height > original.obb.height);
});

test('crossing a box corner cannot invert or collapse it', () => {
  const original = { class_id: 1, box: { x: .5, y: .5, width: .2, height: .2 } };
  const result = editAnnotation(original, { x: .6, y: .6 }, { x: 0, y: 0 }, 2, size);
  assert.ok(result.box.width > 0);
  assert.ok(result.box.height > 0);
  const handles = annotationHandles(result, size);
  close(handles[0].x, .4);
  close(handles[0].y, .4);
});

test('polygon vertex editing changes only the selected vertex and clamps coordinates', () => {
  const original = { class_id: 0, polygon: { points: [{ x: .1, y: .2 }, { x: .8, y: .3 }, { x: .4, y: .9 }] } };
  const result = editAnnotation(original, original.polygon.points[1], { x: 2, y: -.1 }, 1, size);
  assert.deepEqual(result.polygon.points, [{ x: .1, y: .2 }, { x: 1, y: 0 }, { x: .4, y: .9 }]);
  assert.equal(original.polygon.points[1].x, .8);
});

test('resizing a rotated box at the image edge keeps all corners inside', () => {
  const original = { class_id: 0, obb: { x: .5, y: .5, width: .2, height: .2, angle_deg: 35 } };
  const handles = annotationHandles(original, size);
  const result = editAnnotation(original, handles[2], { x: 1, y: 1 }, 2, size);
  assert.ok(annotationHandles(result, size).every(p => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1));
  close(annotationHandles(result, size)[0].x, handles[0].x);
  close(annotationHandles(result, size)[0].y, handles[0].y);
});
