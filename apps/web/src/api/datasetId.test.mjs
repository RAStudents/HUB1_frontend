import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isPublicDatasetId} from './datasetId.ts';
test('routes accept UUIDv4 and reject sequential IDs and MD5',()=>{
 assert.equal(isPublicDatasetId('c0dac6a2-0f93-4835-9156-a52b167ba518'),true);
 for(const id of ['1','003','c4ca4238a0b923820dcc509a6f75849b','preview','',undefined]) assert.equal(isPublicDatasetId(id),false);
});
