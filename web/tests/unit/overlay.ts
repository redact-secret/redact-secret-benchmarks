/**
 * A repository root that is the real one except for a few files. Everything else is a symlink to
 * the real file, so nothing large is copied and nothing real is touched. Used to put the services in
 * a state the committed tree is not in: a run that was never published, a summary that does not
 * validate, a snapshot that is absent. The content written into it is synthetic.
 */
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll } from 'vitest';

export const REAL_ROOT = path.resolve(import.meta.dirname, '../../..');
const made: string[] = [];
afterAll(() => { for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true }); });

/** A root where each `overrides` path is replaced by the given text, or removed when `null`. */
export function overlay(overrides: Record<string, string | null>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'web-overlay-'));
  made.push(root);
  const keys = Object.keys(overrides);
  const mirror = (rel: string) => {
    mkdirSync(path.join(root, rel), { recursive: true });
    for (const entry of readdirSync(path.join(REAL_ROOT, rel))) {
      const child = rel ? `${rel}/${entry}` : entry;
      if (keys.includes(child)) continue;
      if (keys.some(k => k.startsWith(`${child}/`))) mirror(child);
      else symlinkSync(path.join(REAL_ROOT, child), path.join(root, child));
    }
  };
  mirror('');
  for (const [file, content] of Object.entries(overrides)) {
    if (content === null) continue;
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), content);
  }
  return root;
}

export const real = (file: string): string => readFileSync(path.join(REAL_ROOT, file), 'utf8');

/** The real JSON file with `change` applied, as text. */
export function edited(file: string, change: (value: Record<string, any>) => void): string {
  const value = JSON.parse(real(file));
  change(value);
  return JSON.stringify(value);
}
