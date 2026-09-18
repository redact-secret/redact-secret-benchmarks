import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { scanners } from '../scanners/index.mjs';
import { runtimeProvenance, repositoryRoot } from './engine/provenance.ts';
import { runHoldout, contaminateHoldout } from '../holdout/lifecycle.ts';
import { sealProtectedCorpus, HoldoutError } from '../holdout/storage.ts';
import type { Candidate } from '../holdout/types.ts';

async function main() {
  const [action, ...args] = process.argv.slice(2), options: Record<string, string> = {};
  for (const arg of args) {
    const match = /^--(manifest|source|review|reason|output)=(.+)$/.exec(arg);
    if (!match || match[1] in options) throw new HoldoutError('invalid-arguments');
    options[match[1]] = match[2];
  }
  const manifest = path.resolve(repositoryRoot, options.manifest ?? 'holdout/manifest.json');
  if (action === 'seal') {
    if (!options.source) throw new HoldoutError('source-required');
    await sealProtectedCorpus(manifest, path.resolve(options.source), options.review);
    console.log('Protected corpus sealed. Commit only the manifest metadata.');
  } else if (action === 'contaminate') {
    await contaminateHoldout(manifest, options.reason);
    console.log('Corpus marked contaminated; prior qualification evidence for this corpus is invalidated.');
  } else if (action === 'run') {
    const snapshot = async (): Promise<Candidate> => {
      const p = await runtimeProvenance();
      return { sourceHash: p.sourceHash, lockHash: p.lockHash, candidateArtifactHash: p.candidateArtifactHash };
    };
    const report = await runHoldout({ manifestFile: manifest, scanners, candidate: await snapshot(), verifyCandidate: snapshot });
    // stdout contains only the schema-validated aggregate, never case rows.
    if (options.output) await writeFile(path.resolve(options.output), JSON.stringify(report, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    else console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.status !== 'complete' || report.scanners.some(s => s.assertions.fail > 0) ? 1 : 0;
  } else throw new HoldoutError('choose-seal-run-or-contaminate');
}
main().catch(error => { console.error(error instanceof HoldoutError ? error.message : 'Holdout operation failed; protected details suppressed.'); process.exitCode = 1; });
