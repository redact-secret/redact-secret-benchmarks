import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { validate } from '../scripts/validate-decisions.mjs';

const record = (overrides = {}) => {
  const fields = {
    decision_id: 'decision-use-thing',
    status: 'accepted',
    scope: 'benchmarks',
    ...overrides,
  };
  const frontmatter = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
  return `---\n${frontmatter}\n---\n\n# Use the thing\n\n## Decision\n\nUse the thing.\n`;
};

async function withDecisionsDir(fn) {
  const root = await mkdtemp(path.join(tmpdir(), 'decisions-validate-'));
  const decisionsDir = pathToFileURL(path.join(root, 'docs', 'decisions') + path.sep);
  await mkdir(path.join(root, 'docs', 'decisions'), { recursive: true });
  try {
    await fn(root, decisionsDir);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

const addRecord = async (root, name, content) => {
  await writeFile(path.join(root, 'docs', 'decisions', name), content, 'utf8');
  const indexPath = path.join(root, 'docs', 'decisions', 'DECISIONS.md');
  const existing = await import('node:fs/promises')
    .then(fs => fs.readFile(indexPath, 'utf8'))
    .catch(() => '# Decisions\n\n');
  await writeFile(indexPath, `${existing}- [${name}](${name})\n`, 'utf8');
};

test('the real tree has valid ADR frontmatter, a Decision heading, and a complete index', async () => {
  assert.deepEqual(await validate(), []);
});

test('a valid record with no index problems passes', () => withDecisionsDir(async (root, decisionsDir) => {
  await addRecord(root, '2026-09-09-use-thing.md', record());
  assert.deepEqual(await validate(decisionsDir), []);
}));

test('missing frontmatter fields are reported', () => withDecisionsDir(async (root, decisionsDir) => {
  await addRecord(root, '2026-09-09-use-thing.md', record({ scope: undefined }));
  const errors = await validate(decisionsDir);
  assert.ok(errors.some(e => e.includes('missing required field scope')), errors.join('\n'));
}));

test('a scope other than benchmarks is rejected', () => withDecisionsDir(async (root, decisionsDir) => {
  await addRecord(root, '2026-09-09-use-thing.md', record({ scope: 'workspace' }));
  const errors = await validate(decisionsDir);
  assert.ok(errors.some(e => e.includes('must use benchmarks scope')), errors.join('\n'));
}));

test('an invalid decision_id is rejected', () => withDecisionsDir(async (root, decisionsDir) => {
  await addRecord(root, '2026-09-09-use-thing.md', record({ decision_id: 'Use_Thing' }));
  const errors = await validate(decisionsDir);
  assert.ok(errors.some(e => e.includes('invalid decision_id')), errors.join('\n'));
}));

test('an accepted record with no Decision/Decisions heading is rejected', () => withDecisionsDir(async (root, decisionsDir) => {
  await addRecord(root, '2026-09-09-use-thing.md', '---\ndecision_id: decision-use-thing\nstatus: accepted\nscope: benchmarks\n---\n\n# Use the thing\n\n## Context\n\nNo decision heading here.\n');
  const errors = await validate(decisionsDir);
  assert.ok(errors.some(e => e.includes('requires a Decision heading')), errors.join('\n'));
}));

test('"Decisions" (plural) and "Decision N" headings both satisfy the requirement', () => withDecisionsDir(async (root, decisionsDir) => {
  await addRecord(root, '2026-09-09-a.md', '---\ndecision_id: decision-a\nstatus: accepted\nscope: benchmarks\n---\n\n# A\n\n## Decisions\n\nSeveral.\n');
  await addRecord(root, '2026-09-09-b.md', '---\ndecision_id: decision-b\nstatus: accepted\nscope: benchmarks\n---\n\n# B\n\n## Decision 1 — the first\n\nDone.\n');
  assert.deepEqual(await validate(decisionsDir), []);
}));

test('a record missing from the index is reported', () => withDecisionsDir(async (root, decisionsDir) => {
  await writeFile(path.join(root, 'docs', 'decisions', '2026-09-09-use-thing.md'), record(), 'utf8');
  await writeFile(path.join(root, 'docs', 'decisions', 'DECISIONS.md'), '# Decisions\n', 'utf8');
  const errors = await validate(decisionsDir);
  assert.ok(errors.some(e => e.includes('is indexed 0 times')), errors.join('\n'));
}));

test('a duplicate decision_id is reported', () => withDecisionsDir(async (root, decisionsDir) => {
  await addRecord(root, '2026-09-09-a.md', record());
  await addRecord(root, '2026-09-10-b.md', record());
  const errors = await validate(decisionsDir);
  assert.ok(errors.some(e => e.includes('duplicate decision_id')), errors.join('\n'));
}));
