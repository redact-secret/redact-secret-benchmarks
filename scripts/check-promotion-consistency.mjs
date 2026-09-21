/**
 * CI gate (#106): benchmarks/known-gaps.json is the authoritative promotion
 * ledger (docs/decisions/2026-09-18-govern-benchmark-promotion.md); the
 * product repository's conformance/benchmark-regressions.json is verified
 * against it live, never trusted as a second source of truth -- the same
 * authority split docs/decisions/2026-09-17-build-evaluation-engine-now.md
 * already drew for the support matrix, recorded for this pair of ledgers in
 * docs/decisions/2026-09-21-anchor-cross-repo-promotion-authority-in-known-gaps.md.
 *
 * Fails closed: a product issue or manifest record this repo cannot confirm
 * reachable, or a manifest record with no known-gaps.json record behind it,
 * is a failure, not a warning.
 *
 * Run: npm run promotion:check
 * `--local-only` skips both live `gh` calls and runs only the local schema
 * contract (benchmarks/known-gaps.json's own lifecycle rules), for fast
 * offline iteration -- it is not a substitute for the full gate in CI.
 */
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { validateKnownGaps } from '../benchmarks/lib/promotion.ts';
import { checkPromotionConsistency } from '../benchmarks/lib/lifecycle-consistency.ts';
import { PRODUCT_REPO } from '../benchmarks/lib/pin-drift.ts';

const gh = args => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });

async function main() {
  const root = new URL('../', import.meta.url);
  const knownGaps = JSON.parse(await readFile(new URL('benchmarks/known-gaps.json', root), 'utf8'));

  if (process.argv.includes('--local-only')) {
    validateKnownGaps(knownGaps);
    console.log('Local-only: benchmarks/known-gaps.json satisfies its own lifecycle schema. Cross-repo reachability and manifest cross-reference were not checked.');
    return;
  }

  const productManifest = JSON.parse(gh([
    'api', `repos/${PRODUCT_REPO}/contents/conformance/benchmark-regressions.json`,
    '-H', 'Accept: application/vnd.github.raw+json',
  ]));

  const reachable = {};
  for (const issue of knownGaps.issues) {
    if (issue.number in reachable) continue;
    try {
      gh(['issue', 'view', String(issue.number), '--repo', PRODUCT_REPO, '--json', 'number']);
      reachable[issue.number] = true;
    } catch {
      reachable[issue.number] = false;
    }
  }

  const failures = checkPromotionConsistency(knownGaps, productManifest, { reachable });
  if (failures.length) {
    console.error(`Promotion lifecycle guard failed:\n${failures.map(f => `  - ${f}`).join('\n')}`);
    process.exitCode = 1;
  } else {
    console.log('Promotion lifecycle guard passed: every product issue and manifest record is reachable and cross-referenced.');
  }
}

await main();
