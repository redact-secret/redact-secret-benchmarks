import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanners as available } from '../scanners/index.mjs';
import { candidateConfiguration, installCandidate, loadCandidate, removeCandidate } from '../scanners/candidate.mjs';
import { createMethods } from './methods/index.ts';
import { createOperators } from './operators/index.ts';
import { loadCases } from './engine/cases.ts';
import { generateCase } from './engine/model.ts';
import type { ReviewLedger, Scanner } from './engine/types.ts';
import { runEvaluation } from './engine/runner.ts';

const root = fileURLToPath(new URL('../', import.meta.url));

async function main() {
  const options: Record<string, string> = {};
  for (const arg of process.argv.slice(2)) {
    const match = /^--(candidate-package|candidate-node-package|candidate-wasm-package|candidate-source-commit)=(.+)$/.exec(arg);
    if (match) options[match[1]] = match[2];
  }
  const suite = JSON.parse(await readFile(path.join(root, 'qualification/suite-v1.json'), 'utf8'));
  const ledger: ReviewLedger = JSON.parse(await readFile(path.join(root, 'benchmarks/review-ledger.json'), 'utf8'));

  const installation = await installCandidate({
    core: path.resolve(options['candidate-package']),
    node: path.resolve(options['candidate-node-package']),
    wasm: path.resolve(options['candidate-wasm-package']),
  });
  try {
    const candidate = await loadCandidate(installation);
    const productScanner: Scanner = {
      id: 'redact-secret', mode: 'Candidate build · isolated npm tarballs with overrides',
      capabilities: { ranges: true, classification: true }, configuration: candidateConfiguration,
      version: async () => candidate.version, scan: candidate.scan,
    };
    const scanners = available
      .map((s: Scanner) => (s.id === 'redact-secret' ? productScanner : s))
      .filter((s: { id: string }) => Object.hasOwn(suite.scanners, s.id));
    const operators = createOperators(), methods = createMethods();
    const allCases = await loadCases(operators);
    const cases = allCases.map(c => ({ ...c, provenance: { ...c.provenance, seed: `${suite.developmentSeed}/${c.provenance.seed}` } }));
    console.log(`Running ${cases.length} cases with ${scanners.map((s: { id: string }) => s.id).join(', ')}…`);
    const report = await runEvaluation({ cases, methods, operators, scanners, ledger, onProgress: console.log });

    const isNew = (id: string) => !ledger.entries[id];
    const diffEntries = (report.reviewQueue as any[]).filter(q => q.method === 'differential' && isNew(q.id));
    console.log(`New differential entries: ${diffEntries.length}`);

    const casesById = new Map(cases.map(c => [c.id, c]));
    const enriched = diffEntries.map(e => {
      const c = casesById.get(e.caseId)!;
      const generated = generateCase(c, methods, operators);
      const variant = generated.variants.find(v => v.id === e.variant);
      return {
        id: e.id, caseId: e.caseId, targets: e.targets, peer: e.peer, disagreement: e.disagreement,
        sourceSlug: c.source, taxonomy: c.taxonomy,
        fixturePath: variant?.fixture.path,
        fixtureContent: variant?.fixture.content,
        expectedKind: variant?.fixture.assessment.kind,
        expectedSecrets: (variant?.fixture as any)?.expected,
        observations: e.observations,
        classifications: e.classifications,
      };
    });

    const target = path.resolve(root, 'results-output/differential-dump.json');
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, JSON.stringify(enriched, null, 2));
    console.log(`Wrote ${target}`);
  } finally {
    await removeCandidate(installation);
  }
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
