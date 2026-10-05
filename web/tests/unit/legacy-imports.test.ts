// @vitest-environment node
/**
 * Every import the Next app makes from the repository's legacy and benchmark trees has a recorded role (#658). The roles are the dispositions of the
 * file-level inventory in docs/specs/qualification-cutover.md: `keep` (the new path or a product-owned input uses it), `move` (a shared type or validator
 * that has to be relocated before the file it lives in can go), `oracle` (the legacy pipeline's own reader, kept while the legacy path is the oracle),
 * `replace` (a replacement artifact has to feed it first), `other-domain` (PII, performance, runtime: not part of the credential cutover).
 *
 * A new import from `src/` or `benchmarks/` is a decision: it fails here until it is listed with its role, and a listed import that is gone fails too, so the table
 * cannot go stale. Structure only: no value of the ledger or a run is read.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

type Role = 'keep' | 'move' | 'oracle' | 'replace' | 'other-domain';

const ROLES: Record<string, Record<string, Role>> = {
  'app/layout.tsx': { 'src/tokens.css': 'keep' },
  'resolvers/evaluation-hub.ts': { 'benchmarks/shared/evaluation-types.ts': 'keep' },
  'resolvers/evaluation-methods.ts': { 'benchmarks/shared/evaluation-types.ts': 'keep' },
  'resolvers/family-detail.ts': { 'benchmarks/support/taxonomy': 'keep' },
  'resolvers/rc.ts': { 'benchmarks/shared/evaluation-model.ts': 'replace' },
  'services/authority.ts': { 'benchmarks/qualification/authority': 'keep' },
  'services/candidate.ts': { 'benchmarks/lib/baselines': 'replace', 'benchmarks/shared/evaluation-model.ts': 'replace' },
  'services/catalog.ts': { 'benchmarks/lib/fixture-index': 'oracle', 'benchmarks/support/taxonomy': 'keep', 'benchmarks/shared/report-model.mjs': 'oracle' },
  'services/contracts.ts': { 'benchmarks/lib/assessment': 'keep' },
  'services/credential-bridge.ts': { 'benchmarks/lib/accounting': 'move', 'benchmarks/lib/run-summary': 'move', 'benchmarks/support/taxonomy': 'keep', 'benchmarks/types': 'move' },
  'services/credential-source.ts': { 'benchmarks/lib/accounting': 'move', 'benchmarks/types': 'move' },
  'services/domains.ts': {
    'benchmarks/evaluation/domains/pii/context-languages': 'other-domain', 'benchmarks/evaluation/domains/pii/jurisdictions': 'other-domain', 'benchmarks/evaluation/domains/pii/profile': 'other-domain',
    'benchmarks/evaluation/domains/pii/protected-support-binding': 'other-domain', 'benchmarks/evaluation/domains/pii/support-semantics': 'other-domain', 'benchmarks/evaluation/domains/pii/support-v2': 'other-domain',
    'benchmarks/lib/accounting': 'move', 'benchmarks/shared/evaluation-domains-v2.ts': 'other-domain',
  },
  'services/dossiers.ts': { 'benchmarks/support/taxonomy': 'keep' },
  'services/evaluation.ts': { 'benchmarks/shared/evaluation-model.ts': 'keep', 'benchmarks/shared/evaluation-types.ts': 'keep' },
  'services/findings.ts': { 'benchmarks/lib/promotion': 'keep' },
  'services/pii-authority.ts': { 'benchmarks/evaluation/domains/pii/authority': 'other-domain' },
  'services/peers.ts': { 'benchmarks/lib/peer-rule-families': 'keep', 'benchmarks/support/taxonomy': 'keep' },
  'services/performance.ts': { 'benchmarks/lib/measured-performance': 'other-domain', 'benchmarks/lib/performance-schema': 'other-domain' },
  'services/product-scope.ts': { 'benchmarks/lib/peer-rule-families': 'keep' },
  'services/qualification.ts': { 'benchmarks/qualification/canonical': 'keep', 'benchmarks/qualification/scope-accounting': 'keep' },
  'services/run.ts': { 'benchmarks/shared/report-model.mjs': 'oracle', 'benchmarks/shared/run-data.ts': 'oracle', 'benchmarks/shared/run-types.ts': 'oracle' },
  'services/runtime.ts': { 'benchmarks/evaluation/domains/pii/peer-runtime-throughput': 'other-domain', 'benchmarks/evaluation/domains/pii/runtime-comparison': 'other-domain' },
  'services/scanners.ts': { 'benchmarks/lib/peer-observations': 'replace', 'benchmarks/lib/peer-rule-families': 'keep' },
  'theme/tokens.ts': { 'src/tokens.json': 'keep' },
};

const ROOTS = ['services', 'resolvers', 'app', 'lib', 'components', 'theme'];
const SPEC = /(?:from|import)\s*\(?\s*'((?:\.\.\/)+(?:src|benchmarks)\/[^']+)'/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|mjs)$/.test(name)) out.push(full);
  }
  return out;
}

const found = new Map<string, Set<string>>();
for (const root of ROOTS) {
  for (const file of walk(path.join(process.cwd(), root))) {
    const specs = [...readFileSync(file, 'utf8').matchAll(SPEC)].map(m => m[1].replace(/^(\.\.\/)+/, ''));
    if (specs.length) found.set(path.relative(process.cwd(), file), new Set(specs));
  }
}

describe('the Next app does not import the legacy Vite site (#658)', () => {
  test('the shared validators and types live in benchmarks/shared; only the design tokens still come from src/', () => {
    const fromSrc = [...found].flatMap(([file, specs]) => [...specs].filter(spec => spec.startsWith('src/') && !/^src\/tokens\.(css|json)$/.test(spec)).map(spec => `${file} -> ${spec}`));
    expect(fromSrc).toEqual([]);
  });
});

describe('the new credential path does not import the legacy site', () => {
  for (const file of ['services/authority.ts', 'services/credential-source.ts', 'services/credential-bridge.ts', 'services/qualification.ts']) {
    test(file, () => {
      expect([...(found.get(file) ?? [])].filter(spec => /^src\//.test(spec))).toEqual([]);
    });
  }
});

describe('every import of the legacy and benchmark trees has a recorded role', () => {
  test('no import is unlisted and no listed import is gone', () => {
    const actual = Object.fromEntries([...found].map(([file, specs]) => [file, [...specs].sort()]));
    const listed = Object.fromEntries(Object.entries(ROLES).map(([file, roles]) => [file, Object.keys(roles).sort()]));
    expect(actual).toEqual(listed);
  });

  test('the legacy site is imported only for a role that is not `keep`, and `oracle` only by the legacy-pipeline readers', () => {
    for (const [file, roles] of Object.entries(ROLES)) {
      for (const [spec, role] of Object.entries(roles)) {
        if (spec.startsWith('src/') && !/^src\/tokens\.(css|json)$/.test(spec)) expect(role, `${file} -> ${spec}`).not.toBe('keep');
        if (role === 'oracle') expect(['services/catalog.ts', 'services/run.ts'], `${file} -> ${spec}`).toContain(file);
      }
    }
  });
});
