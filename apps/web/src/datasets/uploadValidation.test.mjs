import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateFrame, MAX_FRAME_BYTES } from './uploadValidation.ts';
test('accepts server-supported image extensions and the exact size limit', () => {
 for (const ext of ['jpg','JPEG','png','webp','bmp','tiff','tif','HEIC','heif']) assert.equal(validateFrame({name:`image.${ext}`,size:MAX_FRAME_BYTES}),undefined);
});
test('rejects oversized, empty and unsupported files before uploading', () => {
 assert.equal(validateFrame({name:'large.jpg',size:MAX_FRAME_BYTES+1}),'Файл больше 25 МБ');
 assert.equal(validateFrame({name:'empty.png',size:0}),'Файл пуст');
 assert.equal(validateFrame({name:'image.svg',size:100}),'Формат не поддерживается');
 assert.equal(validateFrame({name:'readme',size:100}),'Формат не поддерживается');
});
