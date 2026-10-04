/**
 * Add the official replay to an evidence-adoption change report (#680): outcome drift of the previous population's common cases apart from the
 * added cases, split into the corpus effect (same engine, old versus new corpus) and the engine effect (same corpus, old versus new engine), and the
 * unmeasured cases of both runs. Unmeasured is never zero detections and sits in no denominator.
 *
 *   node --import tsx scripts/summarize-adoption-replay.ts --report FILE --accepted DIR --replay-old DIR --replay-new DIR [--identity JSON]
 *
 * Each DIR holds `artifact.json` (plain) and `methods/artifact.json` of one official run (the archive layout). `accepted` is the previous accepted
 * run on the previous engine, `replay-old` the previous population on the new engine, `replay-new` the candidate population on the new engine.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { diffRunArtifacts } from './evidence-adoption.mjs';
import { readRunArtifact, unmeasuredByScanner, type RunArtifact } from '../benchmarks/qualification/run-artifact.ts';

const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); if (i < 0) throw new Error(`--${name} is required`); return process.argv[i + 1]; };
const report = JSON.parse(readFileSync(arg('report'), 'utf8'));
const load = (dir: string, methods = false): RunArtifact => readRunArtifact(readFileSync(path.join(dir, methods ? 'methods/artifact.json' : 'artifact.json'))).artifact;
const addedIds: string[] = report.diff.added;
const arg2 = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i < 0 ? undefined : process.argv[i + 1]; };
const record = JSON.parse(readFileSync('benchmarks/evidence-adoption.json', 'utf8')).candidate ?? {};
const engineTo: string = arg2('engine-to') ?? record.engine?.tag ?? 'the new engine';

const accepted = load(arg('accepted')), oldReplay = load(arg('replay-old')), newReplay = load(arg('replay-new'));
const methodsSummary = (a: RunArtifact) => Object.fromEntries(a.scanners.map(s => {
  const byStatus: Record<string, number> = {};
  for (const x of s.assertions ?? []) byStatus[`${x.method}:${x.status}`] = (byStatus[`${x.method}:${x.status}`] ?? 0) + 1;
  const variantsByMethod: Record<string, number> = {};
  for (const u of s.unmeasured_cases ?? []) { const m = String(u.case_id).split('--').pop() ?? '?'; variantsByMethod[m] = (variantsByMethod[m] ?? 0) + 1; }
  return [s.scanner, { status: s.status, variants: s.cases.length, unmeasuredVariants: s.unmeasured_cases?.length ?? 0, unmeasuredVariantsBySeedSuffix: variantsByMethod, assertionsByMethodAndStatus: byStatus }];
}));

report.replay = {
  state: 'compared',
  scope: `The replay changes two things at once: the corpus (${report.evidenceRelease}) and the engine (credential-eval ${engineTo}; scanner versions and the configuration file are fixed, but a newer engine can add an opt-in key to the official configuration, which changes the config hash). They are reported apart: corpusEffect holds the engine fixed, engineEffect holds the corpus fixed. A larger denominator is not an improvement. Decoded and fragment semantics are NOT measured (credential-eval#34, credential-evidence#150); cases the engine could not map are unmeasured, never zero detections, and in no denominator.`,
  corpusEffect: { note: 'previous population versus candidate population, both on the new engine; common cases apart from added cases', scanners: diffRunArtifacts(oldReplay, newReplay, { addedIds }) },
  engineEffect: { note: 'previous population on the previous engine (accepted run) versus on the new engine; the same cases', scanners: diffRunArtifacts(accepted, oldReplay, { addedIds: [] }) },
  combined: { note: 'previous accepted run versus candidate replay: both effects together', scanners: diffRunArtifacts(accepted, newReplay, { addedIds }) },
  unmeasured: {
    plain: { candidate: unmeasuredByScanner(newReplay), previousPopulationOnNewEngine: unmeasuredByScanner(oldReplay) },
    plainCases: Object.fromEntries(newReplay.scanners.filter(s => s.unmeasured_cases?.length).map(s => [s.scanner, s.unmeasured_cases])),
  },
  methods: { candidate: methodsSummary(load(arg('replay-new'), true)), previousPopulationOnNewEngine: methodsSummary(load(arg('replay-old'), true)), previousAccepted: methodsSummary(load(arg('accepted'), true)) },
  ...(process.argv.includes('--identity') ? (() => {
    const runs = JSON.parse(readFileSync(arg('identity'), 'utf8'));
    return {
      runs,
      // Data for the owner's authority renewal, never an authority change: the semantic digests of the four candidate runs. The policy revision is
      // derived from the qualification view, which needs the product-owned overlays regenerated for the new corpus (qualification:axis-overlay,
      // twin-scope, ledger-rekey) on the acceptance branch; it is not computed here.
      authorityRenewalData: {
        note: 'Prepared for the owner. the authority file is not edited by the adoption; renewing it is the owner\'s reviewed commit after acceptance.',
        semanticDigests: Object.fromEntries(Object.entries(runs.candidate as Record<string, { semanticDigest: string }>).map(([k, v]) => [k, v.semanticDigest]).sort(([a], [b]) => (a < b ? -1 : 1))),
        engine: runs.candidate['public-evidence-snapshot'].engine,
        configHash: { plain: runs.candidate['public-evidence-snapshot'].configHash, methods: runs.candidate['public-evidence-snapshot+methods'].configHash },
        policyRevision: 'to be derived on the acceptance branch from the qualification view',
        release: 'to be set by the owner to the product release the accepted view qualifies',
      },
    };
  })() : {}),
};
writeFileSync(arg('report'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ corpusEffect: Object.fromEntries(Object.entries(report.replay.corpusEffect.scanners).map(([k, v]: any) => [k, { common: v.commonCases, unchanged: v.commonUnchanged, drift: v.commonDrift, unmeasured: v.unmeasured }])) }, null, 1));
