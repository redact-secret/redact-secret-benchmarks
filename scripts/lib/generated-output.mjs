import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export function generatedStage(root) {
  const parent = path.join(root, 'results-output');
  mkdirSync(parent, { recursive: true });
  return mkdtempSync(path.join(parent, 'generated-stage-'));
}

function atomicWrite(file, bytes) {
  mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.generated-tmp`;
  try {
    writeFileSync(temporary, bytes, { flag: 'wx' });
    renameSync(temporary, file);
  } finally { rmSync(temporary, { force: true }); }
}

// Read every staged file before publication. A late filesystem failure restores
// both existing reports and the registry, so no receipt points at partial data.
export function publishGeneratedFiles({ root, files, record, write = atomicWrite }) {
  const changes = files.map(({ source, target }) => ({ target, bytes: readFileSync(source) }));
  if (record) changes.push({ target: record.path, bytes: Buffer.from(`${JSON.stringify(record.value, null, 2)}\n`) });
  const seen = new Set();
  for (const change of changes) {
    if (!/^(docs\/generated\/evidence-adoption\/|benchmarks\/(evidence-adoption|product-candidates)\.json$)/.test(change.target) || change.target.split('/').includes('..') || seen.has(change.target))
      throw new Error(`invalid generated publication target: ${change.target}`);
    seen.add(change.target);
    change.file = path.join(root, change.target);
    change.previous = existsSync(change.file) ? readFileSync(change.file) : null;
  }
  const applied = [];
  try {
    for (const change of changes) { applied.push(change); write(change.file, change.bytes); }
  } catch (error) {
    const failures = [];
    for (const change of applied.reverse()) {
      try {
        const current = existsSync(change.file) ? readFileSync(change.file) : null;
        if (change.previous === null ? current === null : current?.equals(change.previous)) continue;
        if (change.previous === null) rmSync(change.file, { force: true });
        else atomicWrite(change.file, change.previous);
      } catch (restoreError) {
        failures.push({ target: change.target, previousBytes: change.previous, cause: restoreError });
      }
    }
    if (failures.length) {
      const incomplete = new AggregateError([error, ...failures.map(failure => failure.cause)],
        `Generated publication failed (${error.message}); rollback incomplete for ${failures.map(failure => `${failure.target}: ${failure.cause.message}`).join('; ')}. Restore these targets from error.recovery[].previousBytes (null means remove) before retrying.`,
        { cause: error });
      incomplete.recovery = failures;
      throw incomplete;
    }
    throw error;
  }
}
