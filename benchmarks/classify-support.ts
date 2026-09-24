import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { platform, arch } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanners as available } from '../scanners/index.mjs';
import { assertPinnedPeers } from '../scanners/pins.mjs';
import { candidateConfiguration, installCandidate, loadCandidate, removeCandidate } from '../scanners/candidate.mjs';
import { createMethods } from './methods/index.ts';
import { createOperators } from './operators/index.ts';
import { loadCases } from './engine/cases.ts';
import type { ReviewLedger, Scanner } from './engine/types.ts';
import { runEvaluation } from './engine/runner.ts';
import { contracts, registryContractIds } from './lib/assessment.ts';
import { classifyFamilySupport, statusCriteria, type SupportStatus } from './support/status.ts';
import { familiesForDetector } from './support/taxonomy.ts';
import { familyEvidence } from './support/evidence.ts';
import { fixtureProfileReport, fixtureProfiles } from './support/profiles.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const CANDIDATE_KEYS = ['candidate-package', 'candidate-node-package', 'candidate-wasm-package', 'candidate-source-commit'] as const;
const usage = 'Usage: npm run eval:classify -- [--output=results-output/support-status.json] '
  + '[--candidate-package=<core.tgz> --candidate-node-package=<node.tgz> --candidate-wasm-package=<wasm.tgz> --candidate-source-commit=<40-hex>]';
const sha256File = async (file: string) => createHash('sha256').update(await readFile(file)).digest('hex');

async function main() {
  const options: Record<string, string | boolean> = {};
  for (const arg of process.argv.slice(2)) {
    const match = /^--(output|candidate-package|candidate-node-package|candidate-wasm-package|candidate-source-commit)=(.+)$/.exec(arg);
    const key = match?.[1] ?? arg.slice(2);
    if (!match || key in options) throw new Error(usage);
    options[key] = match[2];
  }
  const candidatePresent = CANDIDATE_KEYS.filter(key => key in options);
  if (candidatePresent.length !== 0 && candidatePresent.length !== CANDIDATE_KEYS.length) throw new Error(usage);
  const useCandidate = candidatePresent.length === CANDIDATE_KEYS.length;
  if (useCandidate && !/^[a-f0-9]{40}$/.test(options['candidate-source-commit'] as string)) throw new Error(usage);

  const suite = JSON.parse(await readFile(path.join(root, 'qualification/suite-v1.json'), 'utf8'));
  const ledger: ReviewLedger = JSON.parse(await readFile(path.join(root, 'benchmarks/review-ledger.json'), 'utf8'));
  // A classification is a claim: refuse before evaluating, and before writing anything, unless every peer is the pinned version.
  await assertPinnedPeers(available, suite, root);

  let installation: Awaited<ReturnType<typeof installCandidate>> | undefined;
  let product: { sourceCommit: string; packageName: string; declaredVersion: string; artifacts: { role: string; sha256: string }[] } | null = null;
  try {
    let productScanner: Scanner | null = null;
    if (useCandidate) {
      installation = await installCandidate({
        core: path.resolve(options['candidate-package'] as string),
        node: path.resolve(options['candidate-node-package'] as string),
        wasm: path.resolve(options['candidate-wasm-package'] as string),
      });
      const candidate = await loadCandidate(installation);
      productScanner = {
        id: 'redact-secret', mode: 'Candidate build · isolated npm tarballs with overrides',
        capabilities: { ranges: true, classification: true }, configuration: candidateConfiguration,
        version: async () => candidate.version, scan: candidate.scan,
      };
      const artifacts = await Promise.all(
        ([['candidate-package', 'package'], ['candidate-node-package', 'node'], ['candidate-wasm-package', 'wasm']] as const)
          .map(async ([key, role]) => ({ role, sha256: await sha256File(path.resolve(options[key] as string)) })),
      );
      product = {
        sourceCommit: options['candidate-source-commit'] as string,
        packageName: installation.packageName, declaredVersion: installation.declaredVersion, artifacts,
      };
    }
    // The suite's pinned scanner set: what the checked-in review ledger was triaged against.
    // Peer scanners stay exactly the pinned entries; only `redact-secret` is ever substituted.
    const scanners = available
      .map((s: Scanner) => (s.id === 'redact-secret' && productScanner ? productScanner : s))
      .filter((s: { id: string }) => Object.hasOwn(suite.scanners, s.id));
    const operators = createOperators(), methods = createMethods();
    const cases = (await loadCases(operators)).map(c => ({ ...c, provenance: { ...c.provenance, seed: `${suite.developmentSeed}/${c.provenance.seed}` } }));
    let revision = 'unknown', dirty: boolean | null = null;
    try {
      revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      dirty = Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim());
    } catch {}
    console.log(`Running every registered family's evidence through the profile: ${cases.length} cases with ${scanners.map((s: { id: string }) => s.id).join(', ')}…`);
    const report = await runEvaluation({ cases, methods, operators, scanners, ledger, onProgress: console.log });
    // The unit is a registered detector (issue #504's "42" at filing time; the count follows
    // `detectors.json`, 46 as of 2026-09-21), not a taxonomy sub-family. Beta.8 arrival families
    // (#207–#212) have contracts but no product detector, so they carry no support status here.
    const families = [...registryContractIds].sort();
    const results = families.map(family => {
      const evidence = familyEvidence(family, report.byDetector, report.axesByDetector, report.reviewQueue, ledger, cases);
      const assessment = classifyFamilySupport(evidence);
      // Un-probeable (#33) is carried alongside the status, never folded silently
      // into a bare "not enough twins" reading: zero twin pairs reads differently
      // when the provider gives nothing a twin could mutate.
      const unprobeable = contracts[family].unprobeable ?? null;
      const { fixtureProfile: measured, ...scored } = evidence;
      return {
        ...assessment,
        evidenceTier: evidence.positiveContractTier,
        evidenceBasis: evidence.evidenceBasis,
        taxonomyFamilies: familiesForDetector(family).map(f => f.id), evidence: scored, unprobeable,
        fixtureProfile: fixtureProfileReport(measured!.claim, measured!.cells),
      };
    });
    const distribution = results.reduce((d, r) => { d[r.status] = (d[r.status] ?? 0) + 1; return d; },
      { stable: 0, provisional: 0, pending: 0, unsupported: 0 } as Record<SupportStatus, number>);
    const stableDistribution = {
      documented: results.filter(result => result.status === 'stable' && result.qualificationProfile === 'documented').length,
      empirical: results.filter(result => result.status === 'stable' && result.qualificationProfile === 'empirical').length,
    };
    const output = {
      schemaVersion: 1, generatedAt: new Date().toISOString(), runId: report.runId,
      revision, dirty, criteriaSchemaVersion: statusCriteria.schemaVersion, fixtureProfilesVersion: fixtureProfiles.profilesVersion,
      // Null except on a candidate run: default behaviour (and its output shape
      // for every other field) is unchanged from before candidate support existed.
      product,
      scanners: scanners.map((s: { id: string }) => s.id), caseCount: report.caseCount, variantCount: report.variantCount,
      familyCount: families.length, distribution, stableDistribution, families: results,
    };
    const target = path.resolve(root, typeof options.output === 'string' ? options.output : 'results-output/support-status.json');
    await mkdir(path.dirname(target), { recursive: true });
    const temporary = `${target}.${report.runId}.tmp`;
    await writeFile(temporary, JSON.stringify(output, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    await rename(temporary, target);
    console.log(`Distribution: ${JSON.stringify(distribution)} of ${families.length} families; stable profiles ${JSON.stringify(stableDistribution)}.`);
    console.log(`Report: ${path.relative(root, target)}`);
  } finally {
    if (installation) await removeCandidate(installation);
  }
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
