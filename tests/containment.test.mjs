import test from 'node:test';
import assert from 'node:assert/strict';
import { score } from '../benchmarks/lib/scoring.mjs';

const f = {id:'url',path:'url.txt',group:'url',content:'🔑\r\npostgres://user:synthetic_password@db.invalid/test',expected:[]};
// Derive byte positions independently from the synthetic source value.
f.expected = [{start:Buffer.byteLength(f.content.slice(0,f.content.indexOf('synthetic_password'))),end:Buffer.byteLength(f.content.slice(0,f.content.indexOf('@db')))}];
const finding = (start,end) => ({path:f.path,start,end});
test('whole database URL contains a password but remains an exact FP + FN', () => {
  const result = score([f],[finding(6,Buffer.byteLength(f.content))]);
  assert.deepEqual([result.tp,result.fp,result.fn,result.contained,result.broader],[0,1,1,1,1]);
});
test('exact match wins over broader ranges; duplicate findings never multiply containment', () => {
  const exact = finding(f.expected[0].start,f.expected[0].end);
  const result = score([f],[exact,exact,finding(6,Buffer.byteLength(f.content))]);
  assert.deepEqual([result.tp,result.fp,result.contained,result.broader],[1,1,1,0]);
});
test('partial overlap does not contain the expected secret', () => {
  const result = score([f],[finding(f.expected[0].start,f.expected[0].end-1)]);
  assert.deepEqual([result.contained,result.broader,result.fn],[0,0,1]);
});
test('one broad finding may contain two secrets; negative findings are never contained secrets', () => {
  const fixture = {id:'multiple',path:'multi.txt',group:'multiple',content:'aaa bbb',expected:[{start:0,end:3},{start:4,end:7}]};
  const negative = {...fixture,id:'negative',path:'negative.txt',expected:[]};
  const result = score([fixture,negative],[{path:'multi.txt',start:0,end:7},{path:'negative.txt',start:0,end:7}]);
  assert.deepEqual([result.contained,result.broader,result.fp,result.fn],[2,2,2,2]);
  assert.equal(result.rows[1].contained,0);
});
