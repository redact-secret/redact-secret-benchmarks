import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalDigest, parseBuffer } from '../benchmarks/qualification/large-json.ts';
import { semanticDigestOf } from '../benchmarks/qualification/run-artifact.ts';

// A document with floats written as serde_json writes them, escapes, non-ASCII keys and values, unsorted keys, nesting and an existing non_semantic.
const doc = '{"schema":"x","scanners":[{"scanner":"b","cases":[{"id":"é\\n\\"q\\"","score":1.0,"n":0.10},{"id":"\\u00e9","score":1.96,"e":1E3}],"empty":[],"o":{}},{"z":null,"a":true}],"manifest":{"k":[1,2,3],"é":"ü","b":false},"non_semantic":{"wall_ms":123.0}}';

test('parseBuffer equals JSON.parse', () => {
  assert.deepEqual(parseBuffer(Buffer.from(doc)), JSON.parse(doc));
  assert.deepEqual(parseBuffer(Buffer.from(` ${doc}\n`)), JSON.parse(doc));
  assert.throws(() => parseBuffer(Buffer.from('{"a":1} x')));
});

test('the streamed canonical digest equals the whole-string digest at every piece size, with or without non_semantic', () => {
  for (const text of [doc, doc.replace(',"non_semantic":{"wall_ms":123.0}', '')]) {
    const expected = semanticDigestOf(text).slice('sha256:'.length);
    for (const piece of [1, 8, 40, 1 << 20]) assert.equal(canonicalDigest(Buffer.from(text), piece), expected, `piece ${piece}`);
  }
});
