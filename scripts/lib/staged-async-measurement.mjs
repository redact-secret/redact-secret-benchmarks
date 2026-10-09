import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';

// Publish a complete measurement bundle only after every asynchronous producer succeeds.
export async function stagedAsyncMeasurementDirectory(target, write) {
  await mkdir(path.dirname(target), { recursive: true });
  const stage = `${target}.stage-${randomUUID()}`, lock = `${target}.lock`;
  await mkdir(lock);
  try {
    if (existsSync(target)) throw new Error('Measurement output already exists');
    await mkdir(stage);
    await write(stage);
    await rename(stage, target);
  } finally {
    await rm(stage, { recursive: true, force: true });
    await rm(lock, { recursive: true, force: true });
  }
}
