// @vitest-environment node
/**
 * Every import the Next app makes from the repository's legacy and benchmark trees, and every legacy data file its services read, has a recorded role, a named
 * owner and, when it is not part of the new path, the reason it stays (#658). The roles are the dispositions of the file-level inventory in
 * docs/specs/qualification-cutover.md: `keep` (the new path or a product-owned input uses it), `move` (a shared type or validator that has to be relocated before the
 * file it lives in can go), `oracle` (the legacy pipeline's own reader, kept as the one-value rollback), `other-domain` (PII, performance, the discovery evaluation:
 * not part of the credential cutover). There is no `replace` role: a reader that waited on a replacement artifact is moved onto it, or it is `oracle`.
 *
 * A new import from `src/` or `benchmarks/`, or a new read of a legacy file, is a decision: it fails here until it is listed with its role, owner and reason, and a
 * listed entry that is gone fails too, so the table cannot go stale. An `oracle` entry can be only a reader the `legacy` authority reaches (`LEGACY_READERS`), so
 * removing the rollback (#660) deletes those files and these rows together. Structure only: no value of the ledger or a run is read.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

/** Who answers for a retained entry: the rollback, or a domain the credential cutover does not touch, or the relocation of a shared type before the evaluator is removed. */
type Owner = 'legacy-rollback' | 'pii' | 'performance' | 'discovery-evaluation' | 'relocation';
type Role = 'move' | 'oracle' | 'other-domain';
type Retained = { role: Role; owner: Owner; reason: string };
type Entry = 'keep' | Retained;

const oracle = (reason: string): Retained => ({ role: 'oracle', owner: 'legacy-rollback', reason: `the legacy authority's rollback (#660 removes it with the legacy steps): ${reason}` });
const other = (owner: Exclude<Owner, 'legacy-rollback' | 'relocation'>, reason: string): Retained => ({ role: 'other-domain', owner, reason });
const move = (reason: string): Retained => ({ role: 'move', owner: 'relocation', reason: `relocated before the evaluator is removed (#660): ${reason}` });

const PII = (what: string) => other('pii', `the PII evaluation reads ${what}; its authority is independent of the credential authority (#666)`);

const ROLES: Record<string, Record<string, Entry>> = {
  'app/layout.tsx': { 'src/tokens.css': 'keep' },
  'resolvers/evaluation-hub.ts': { 'benchmarks/shared/evaluation-types.ts': 'keep' },
  'resolvers/evaluation-methods.ts': { 'benchmarks/shared/evaluation-types.ts': 'keep' },
  'resolvers/domains.ts': { 'benchmarks/evaluation/domains/pii/metric-basis.mjs': PII('its metric basis') },
  'resolvers/family-detail.ts': { 'benchmarks/support/taxonomy': 'keep' },
  'resolvers/rc-artifact.ts': { 'benchmarks/qualification/candidate-diff': 'keep' },
  'resolvers/rc.ts': { 'benchmarks/shared/evaluation-model.ts': oracle('classifies a saved-baseline candidate report (`changeRows`, `candidatePairs`), the evidence `eval:candidate` writes under `legacy`') },
  'services/authority.ts': { 'benchmarks/qualification/authority': 'keep' },
  'services/candidate-legacy.ts': {
    'benchmarks/lib/baselines': oracle('orders the saved `baselines/<version>.json` comparison points'),
    'benchmarks/shared/evaluation-model.ts': oracle('validates `candidate-evidence-v1.json` with `candidateProblem`'),
  },
  'services/candidate.ts': { 'benchmarks/qualification/candidate-diff': 'keep', 'benchmarks/qualification/candidate-freshness': 'keep' },
  'services/catalog.ts': {
    'benchmarks/lib/fixture-index': oracle('validates the legacy fixture index the legacy catalog is built from'),
    'benchmarks/support/taxonomy': 'keep',
    'benchmarks/shared/report-model.mjs': oracle('`buildCatalog` over the committed corpora, the legacy pipeline\'s catalog'),
  },
  'services/contracts.ts': { 'benchmarks/lib/assessment': 'keep' },
  'services/credential-bridge.ts': {
    'benchmarks/accounting/index': 'keep', 'benchmarks/evaluation/domains/credential/run-summary': 'keep', 'benchmarks/support/taxonomy': 'keep',
    'benchmarks/types': move('`AccountingConfig` still lives in the legacy engine\'s type module'),
  },
  'services/credential-source.ts': { 'benchmarks/accounting/index': 'keep', 'benchmarks/types': move('`AccountingConfig` still lives in the legacy engine\'s type module') },
  'services/domains.ts': {
    'benchmarks/evaluation/domains/pii/context-languages': PII('its context languages'), 'benchmarks/evaluation/domains/pii/jurisdictions': PII('its jurisdictions'),
    'benchmarks/evaluation/domains/pii/profile': PII('its profile'), 'benchmarks/evaluation/domains/pii/protected-support-binding': PII('the reviewed protected binding'),
    'benchmarks/evaluation/domains/pii/support-semantics': PII('its support semantics'), 'benchmarks/evaluation/domains/pii/support-v2': PII('its support matrix v2'),
    'benchmarks/accounting/index': 'keep', 'benchmarks/shared/evaluation-domains-v2.ts': PII('the evaluation domains v2 index'),
  },
  'services/dossiers.ts': { 'benchmarks/support/taxonomy': 'keep' },
  'services/evaluation.ts': { 'benchmarks/evaluation/bundle/bundle.ts': 'keep', 'benchmarks/shared/evaluation-model.ts': 'keep', 'benchmarks/shared/evaluation-types.ts': 'keep' },
  'services/findings.ts': { 'benchmarks/lib/promotion': 'keep' },
  'services/pii-authority.ts': { 'benchmarks/evaluation/domains/pii/authority': PII('its authority file') },
  'services/peers.ts': { 'benchmarks/lib/peer-rule-families': 'keep', 'benchmarks/support/taxonomy': 'keep' },
  'services/performance.ts': { 'benchmarks/lib/measured-performance': other('performance', 'the performance comparison reads the accepted performance run'), 'benchmarks/lib/performance-schema': other('performance', 'the performance comparison validates its reports') },
  'services/product-scope.ts': { 'benchmarks/lib/peer-rule-families': 'keep' },
  'services/qualification.ts': { 'benchmarks/qualification/canonical': 'keep', 'benchmarks/qualification/observation-origin': 'keep', 'benchmarks/qualification/scope-accounting': 'keep' },
  'services/run.ts': {
    'benchmarks/shared/report-model.mjs': oracle('re-checks the legacy suite reports against the corpora'),
    'benchmarks/shared/run-data.ts': oracle('the legacy run\'s summary validators'), 'benchmarks/shared/run-types.ts': oracle('the legacy run\'s types'),
  },
  'services/runtime.ts': { 'benchmarks/evaluation/domains/pii/peer-runtime-throughput': PII('the runtime throughput comparison'), 'benchmarks/evaluation/domains/pii/runtime-comparison': PII('the runtime comparison') },
  'services/scanners.ts': {
    'benchmarks/lib/peer-observations': oracle('validates the committed peer snapshots, which the scanner page reads only under `legacy`; under `new` it reads the official run'),
    'benchmarks/lib/peer-rule-families': 'keep',
  },
  'theme/tokens.ts': { 'src/tokens.json': 'keep' },
};

/**
 * The legacy data files a service reads by name (not an import): the same table, the same owners. `legacy` files are read only for the `legacy` authority (the
 * rollback) or, for the corpus registry, by the discovery evaluation's staleness check, which both authorities use and which reads no legacy catalog file (#658).
 */
const FILE_READS: Record<string, Record<string, Retained>> = {
  'services/catalog.ts': {
    'fixture-index.json': oracle('the legacy catalog\'s fixture index (the legacy pipeline\'s catalog; the new path takes case metadata from the view)'),
    'fixture-detectors.json': oracle('the legacy catalog\'s detector assignments'),
    'scenarios.json': oracle('the legacy catalog\'s scenario titles'),
    'categories.json': other('discovery-evaluation', 'the published corpus registry: the evaluation bundle states the corpus hashes it was measured over, whichever credential authority is committed'),
  },
  'services/scanners.ts': { 'peer-observations': oracle('the committed peer snapshots, read under `legacy` only (`loadScannerEnvironment(\'snapshots\')`)') },
  'services/candidate-legacy.ts': {
    'baselines/': oracle('the saved release comparison points of the Workbench'),
    'candidate-evidence-v1.json': oracle('the evidence the legacy publish\'s `eval:candidate` step writes; the `new` publish does not write it'),
  },
  'services/run.ts': { 'run.json': oracle('the legacy benchmark run, written by `npm run bench`') },
  'services/domains.ts': { 'run.json': oracle('the legacy run\'s evaluation and accounting profile names, read only when the legacy pipeline is the authority') },
  'services/evaluation.ts': { 'evaluation-v1.json': oracle('the whole-file evaluation the oracle and the rollback read when no bundle pointer exists') },
};
/** Only these files may hold an `oracle` entry: the readers the `legacy` authority (and nothing under `new`) reaches. */
const LEGACY_READERS = ['resolvers/rc.ts', 'services/candidate-legacy.ts', 'services/catalog.ts', 'services/domains.ts', 'services/evaluation.ts', 'services/run.ts', 'services/scanners.ts'];
const LEGACY_TOKENS = Object.values(FILE_READS).flatMap(tokens => Object.keys(tokens));

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
const reads = new Map<string, Set<string>>();
for (const root of ROOTS) {
  for (const file of walk(path.join(process.cwd(), root))) {
    const text = readFileSync(file, 'utf8');
    const rel = path.relative(process.cwd(), file);
    const specs = [...text.matchAll(SPEC)].map(m => m[1].replace(/^(\.\.\/)+/, ''));
    if (specs.length) found.set(rel, new Set(specs));
    if (!rel.startsWith('services/')) continue;
    // Code only: a comment may name a file it does not read.
    const code = text.split('\n').filter(line => !/^\s*(\*|\/\/|\/\*)/.test(line)).join('\n');
    const tokens = LEGACY_TOKENS.filter(token => code.includes(token));
    if (tokens.length) reads.set(rel, new Set(tokens));
  }
}

describe('the Next app does not import the legacy Vite site (#658)', () => {
  test('the shared validators and types live in benchmarks/shared; only the design tokens still come from src/', () => {
    const fromSrc = [...found].flatMap(([file, specs]) => [...specs].filter(spec => spec.startsWith('src/') && !/^src\/tokens\.(css|json)$/.test(spec)).map(spec => `${file} -> ${spec}`));
    expect(fromSrc).toEqual([]);
  });
});

describe('the new credential path does not import the legacy site', () => {
  for (const file of ['services/authority.ts', 'services/credential-source.ts', 'services/credential-bridge.ts', 'services/qualification.ts', 'services/candidate.ts', 'resolvers/rc-artifact.ts', 'resolvers/rc-common.ts']) {
    test(file, () => {
      expect([...(found.get(file) ?? [])].filter(spec => /^src\//.test(spec))).toEqual([]);
    });
  }

  test('the release-candidate page of the new path imports no legacy evidence model or baseline reader', () => {
    for (const file of ['services/candidate.ts', 'resolvers/rc-artifact.ts', 'resolvers/rc-common.ts']) {
      expect([...(found.get(file) ?? [])].filter(spec => /evaluation-model|lib\/baselines|fixture-index|report-model|peer-observations/.test(spec)), file).toEqual([]);
    }
  });
});

describe('every import of the legacy and benchmark trees has a recorded role', () => {
  test('no import is unlisted and no listed import is gone', () => {
    const actual = Object.fromEntries([...found].map(([file, specs]) => [file, [...specs].sort()]));
    const listed = Object.fromEntries(Object.entries(ROLES).map(([file, roles]) => [file, Object.keys(roles).sort()]));
    expect(actual).toEqual(listed);
  });

  test('the legacy site is imported only for a role that is not `keep`, and `oracle` only by the legacy-pipeline readers', () => {
    for (const [file, roles] of Object.entries(ROLES)) {
      for (const [spec, entry] of Object.entries(roles)) {
        if (spec.startsWith('src/') && !/^src\/tokens\.(css|json)$/.test(spec)) expect(entry, `${file} -> ${spec}`).not.toBe('keep');
        if (entry !== 'keep' && entry.role === 'oracle') expect(LEGACY_READERS, `${file} -> ${spec}`).toContain(file);
      }
    }
  });
});

describe('every retained legacy import and legacy file read has an owner and a reason (#658)', () => {
  const retained = [
    ...Object.entries(ROLES).flatMap(([file, roles]) => Object.entries(roles).flatMap(([spec, entry]) => (entry === 'keep' ? [] : [{ where: `${file} -> ${spec}`, entry }]))),
    ...Object.entries(FILE_READS).flatMap(([file, tokens]) => Object.entries(tokens).map(([token, entry]) => ({ where: `${file} reads ${token}`, entry }))),
  ];

  test('each names a concrete owner and says why it stays', () => {
    for (const { where, entry } of retained) {
      expect(entry.reason.length, where).toBeGreaterThan(30);
      if (entry.role === 'oracle') expect(entry.owner, where).toBe('legacy-rollback');
      if (entry.role === 'other-domain') expect(['pii', 'performance', 'discovery-evaluation'], where).toContain(entry.owner);
      if (entry.role === 'move') expect(entry.owner, where).toBe('relocation');
    }
  });

  test('a service reads a legacy data file only where it is listed, and a listed read is still there', () => {
    const actual = Object.fromEntries([...reads].map(([file, tokens]) => [file, [...tokens].sort()]));
    const listed = Object.fromEntries(Object.entries(FILE_READS).map(([file, tokens]) => [file, Object.keys(tokens).sort()]));
    expect(actual).toEqual(listed);
  });

  test('a read of a legacy file is a legacy-reader file, unless it is another domain\'s', () => {
    for (const [file, tokens] of Object.entries(FILE_READS)) {
      for (const [token, entry] of Object.entries(tokens)) if (entry.role === 'oracle') expect(LEGACY_READERS, `${file} reads ${token}`).toContain(file);
    }
  });
});
