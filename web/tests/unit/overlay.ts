/**
 * A repository root that is the real one except for a few files. Everything else is a symlink to
 * the real file, so nothing large is copied and nothing real is touched. Used to put the services in
 * a state the committed tree is not in: a run that was never published, a summary that does not
 * validate, a snapshot that is absent. The content written into it is synthetic.
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll } from 'vitest';

export const REAL_ROOT = path.resolve(import.meta.dirname, '../../..');
const made: string[] = [];
afterAll(() => { for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true }); });

export const AUTHORITY_FILE = 'benchmarks/qualification-authority.json';

/** The committed authority file with only its value changed: what a test puts in a root to choose the pipeline (#608). */
export const authorityFile = (authority: 'legacy' | 'new'): string => JSON.stringify({ ...JSON.parse(readFileSync(path.join(REAL_ROOT, AUTHORITY_FILE), 'utf8')), authority });

export const PII_AUTHORITY_FILE = 'benchmarks/pii-authority.json';

/**
 * The committed PII authority file with only its value changed (#666), independent of the credential authority. `authorised: false` removes the
 * recorded owner authorisation from the copy (the working copy only), which is how a test puts `new` in the state the service must refuse.
 */
export const piiAuthorityFile = (authority: 'legacy' | 'new', authorised = true): string => {
  const file = JSON.parse(readFileSync(path.join(REAL_ROOT, PII_AUTHORITY_FILE), 'utf8'));
  if (!authorised) file.new.authorisation = null;
  return JSON.stringify({ ...file, authority });
};

/**
 * A root where each `overrides` path is replaced by the given text, or removed when `null`. Unless the test names the authority file
 * itself, the root is pinned to the legacy pipeline: the tests that use an overlay exercise the legacy data path, and they must do so
 * whichever value is committed, so the committed value is what flips (and the legacy path stays under test after the switch).
 */
export function overlay(overrides: Record<string, string | null>, options: { materializeEvidence?: boolean } = {}): string {
  if (!(AUTHORITY_FILE in overrides)) overrides = { ...overrides, [AUTHORITY_FILE]: authorityFile('legacy') };
  // Likewise the PII authority: an overlay is the legacy PII evaluation unless the test chooses another value.
  if (!(PII_AUTHORITY_FILE in overrides)) overrides = { ...overrides, [PII_AUTHORITY_FILE]: piiAuthorityFile('legacy') };
  const root = mkdtempSync(path.join(tmpdir(), 'web-overlay-'));
  made.push(root);
  const keys = Object.keys(overrides);
  const mirror = (rel: string) => {
    mkdirSync(path.join(root, rel), { recursive: true });
    for (const entry of readdirSync(path.join(REAL_ROOT, rel))) {
      const child = rel ? `${rel}/${entry}` : entry;
      if (keys.includes(child)) continue;
      // Sealed adoption validation refuses symlinks, even in a test-only root.
      if (options.materializeEvidence && ['benchmarks/pii-evidence', 'benchmarks/pii-evidence-comparison'].includes(child)) {
        cpSync(path.join(REAL_ROOT, child), path.join(root, child), { recursive: true,
          filter: source => !keys.includes(path.relative(REAL_ROOT, source)) });
        continue;
      }
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
