import { existsSync, mkdirSync, realpathSync, linkSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';

// Normal measurement never mutates an accepted record. Resolve ancestors to prevent symlink escapes.
export function measurementOutput(file, root, { directory = false } = {}) {
  const target = resolve(file), repository = realpathSync(root), allowed = resolve(repository, 'results-output');
  let ancestor = target;
  while (!existsSync(ancestor)) ancestor = dirname(ancestor);
  const canonical = resolve(realpathSync(ancestor), relative(ancestor, target));
  const inside = (base, path) => { const rel = relative(base, path); return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel); };
  if (!inside(allowed, canonical)) throw new Error('Measurement output must be an ignored results-output/ path; accepted historical records are immutable');
  if (existsSync(target)) throw new Error('Measurement output already exists; choose a fresh run path');
  if (directory && target === allowed) throw new Error('Choose a fresh run directory');
  return target;
}

export function stagedMeasurementDirectory(target, write) {
  mkdirSync(dirname(target), { recursive: true });
  const staging = `${target}.stage-${randomUUID()}`, lock = `${target}.lock`;
  mkdirSync(lock);
  try {
    if (existsSync(target)) throw new Error('Measurement output already exists');
    mkdirSync(staging);
    write(staging);
    renameSync(staging, target);
  } finally {
    rmSync(staging, { recursive: true, force: true });
    rmSync(lock, { recursive: true, force: true });
  }
}

export function writeMeasurement(file, data) {
  mkdirSync(dirname(file), { recursive: true });
  const staging = `${file}.stage-${randomUUID()}`;
  try { writeFileSync(staging, data, { flag: 'wx' }); linkSync(staging, file); }
  finally { rmSync(staging, { force: true }); }
}
