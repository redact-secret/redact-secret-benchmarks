import { mkdir, writeFile, rename } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Ajv from 'ajv';
import schema from '../schemas/provider-dossiers-v1.json' with { type: 'json' };
import { taxonomy } from './support/taxonomy.ts';
import type { Taxonomy } from './support/taxonomy.ts';
import { parseFrontmatter, providersWithFamilies, run as checkDossiers } from '../scripts/scaffold-dossiers.mjs';
import { shortfall } from '../scripts/family-status.mjs';

/**
 * Provider dossiers roadmap (#478, epic #473). Joins each dossier's hand-written
 * research judgement (verdict, tier, blockedBy, researchedAt, links) with what is
 * already derivable — taxonomy.json, detectors.json, the fixture-profile coverage
 * report and, when given, the generated support matrix — into
 * `public/results/provider-dossiers-v1.json`. Nothing here decides a status, the
 * stage reuses `family:status`'s shortfall derivation, the output holds counts and
 * ids only (never a fixture value), and it carries no date a family is expected
 * to reach a stage: the answer to "when" is a stage and a blocker.
 */
export const STAGES = ['researched', 'in-taxonomy', 'benchmarked', 'core-detector', 'measured'] as const;
export type Stage = (typeof STAGES)[number];
const MEASURED_STATUSES = ['stable', 'provisional'];

const root = fileURLToPath(new URL('../', import.meta.url));
const readJson = (file: string) => JSON.parse(readFileSync(file, 'utf8'));

interface CoverageRow { cells: Record<string, number>; target: string }
export interface Inputs {
  taxonomy: Taxonomy;
  dossiersDir: string;
  detectorIds: Set<string>;
  criteria: unknown;
  coverage: Map<string, CoverageRow>;
  /** The legacy matrix (`sourceReport`) or the published matrix of the validated view (`source`, #657); only family and status are read, and the identity is carried. */
  matrix: ({ sourceReport: { runId: string; generatedAt: string; revision: string }; families: { family: string; status: string }[] } | { schema: string; source: { view: { policyRevision: string }; populations: { population: string; semanticDigest: string }[] }; families: { family: string; status: string }[] }) | null;
}

export function defaultInputs(matrixPath: string | null): Inputs {
  const matrix = matrixPath && existsSync(matrixPath) ? readJson(matrixPath) : null;
  return {
    taxonomy,
    dossiersDir: path.join(root, 'benchmarks/support/dossiers'),
    detectorIds: new Set(readJson(path.join(root, 'benchmarks/detectors.json')).detectors.map((d: { id: string }) => d.id)),
    criteria: readJson(path.join(root, 'benchmarks/support/status-criteria.json')),
    coverage: new Map(readJson(path.join(root, 'docs/generated/fixture-profile-coverage.json')).families.map((f: CoverageRow & { family: string }) => [f.family, f])),
    matrix,
  };
}

export function buildProviderDossiers(input: Inputs) {
  const problems = checkDossiers({ dir: input.dossiersDir, check: true, taxonomy: input.taxonomy }).problems as string[];
  if (problems.length) throw new Error(`Dossiers are invalid; run npm run dossiers:check:\n${problems.join('\n')}`);
  const status = new Map((input.matrix?.families ?? []).map(f => [f.family, f.status]));
  const stageDistribution = Object.fromEntries(STAGES.map(s => [s, 0])) as Record<Stage, number>;
  const verdictDistribution: Record<string, number> = { unresearched: 0, ready: 0, 'issuance-gated': 0, 'date-gated': 0, 'not-found': 0, rejected: 0 };
  const providers = providersWithFamilies(input.taxonomy).map((provider: { id: string; name: string; families: { id: string; name: string; detectors?: string[] }[] }) => {
    const text = readFileSync(path.join(input.dossiersDir, `${provider.id}.md`), 'utf8');
    const entries = new Map<string, any>(((parseFrontmatter(text).data?.families ?? []) as any[]).map(f => [f.id, f]));
    const families = provider.families.map(family => {
      const entry = entries.get(family.id);
      const research = entry.research;
      const detectors = family.detectors ?? [];
      const gaps = detectors.flatMap(id => {
        const row = input.coverage.get(id);
        return shortfall(row?.cells, row?.target, input.criteria).rows
          .filter((r: { gap: number }) => r.gap > 0).map((r: { cell: string; actual: number; required: number }) => ({ detector: id, cell: r.cell, actual: r.actual, required: r.required }));
      });
      const reached: Record<Stage, boolean> = {
        researched: research.verdict !== 'unresearched',
        'in-taxonomy': true,
        benchmarked: detectors.length > 0 && detectors.every(id => input.coverage.has(id)) && gaps.length === 0,
        'core-detector': detectors.length > 0 && detectors.every(id => input.detectorIds.has(id)),
        measured: MEASURED_STATUSES.includes(status.get(family.id) ?? ''),
      };
      // The furthest stage a family has reached. Research and taxonomy listing
      // are the two entry stages: a researched family that nothing has been
      // built for yet reads `researched`, an unresearched one `in-taxonomy`.
      const stage = (['measured', 'core-detector', 'benchmarked', 'researched'] as const).find(s => reached[s]) ?? 'in-taxonomy';
      stageDistribution[stage] += 1;
      verdictDistribution[research.verdict] += 1;
      return {
        family: family.id, name: family.name, verdict: research.verdict, tier: research.tier ?? null,
        researchedAt: research.researchedAt ? String(research.researchedAt) : null,
        blockedBy: entry.blockedBy ?? null,
        issues: (research.issues as string[]).map(ref => ({ ref, url: `https://github.com/${ref.replace('#', '/issues/')}` })),
        sources: research.sources as string[], evidence: research.evidence ?? null,
        detectors, reached, stage, supportStatus: status.get(family.id) ?? null, fixtureGaps: gaps,
      };
    });
    return { id: provider.id, name: provider.name, families };
  });
  const matrix = input.matrix;
  const report = matrix && 'sourceReport' in matrix ? matrix.sourceReport : null;
  const supportMatrix = report ? { runId: report.runId, generatedAt: report.generatedAt, revision: report.revision }
    : matrix && 'source' in matrix ? { source: 'qualification-view' as const, policyRevision: matrix.source.view.policyRevision, populations: matrix.source.populations.map(p => ({ population: p.population, semanticDigest: p.semanticDigest })) } : null;
  const output = {
    schemaVersion: 1 as const, taxonomySchemaVersion: input.taxonomy.schemaVersion,
    supportMatrix,
    providerCount: providers.length, familyCount: providers.reduce((n: number, p: { families: unknown[] }) => n + p.families.length, 0),
    stageDistribution, verdictDistribution, providers,
  };
  const validate = new Ajv({ strict: true }).compile(schema);
  if (!validate(output)) throw new Error(`Generated provider dossiers break schemas/provider-dossiers-v1.json: ${JSON.stringify(validate.errors)}`);
  return output;
}

async function main() {
  const options: Record<string, string | boolean> = {};
  for (const arg of process.argv.slice(2)) {
    const match = /^--(matrix|output)=(.+)$/.exec(arg);
    const key = match?.[1] ?? arg.slice(2);
    if ((!match && key !== 'require-matrix') || key in options) throw new Error('Usage: npm run dossiers:publish -- [--matrix=results-output/support-matrix.json] [--output=public/results/provider-dossiers-v1.json] [--require-matrix]');
    options[key] = match ? match[2] : true;
  }
  const matrixPath = path.resolve(root, typeof options.matrix === 'string' ? options.matrix : 'results-output/support-matrix.json');
  if (options['require-matrix'] && !existsSync(matrixPath)) throw new Error(`Cannot read ${path.relative(root, matrixPath)} — run \`npm run eval:matrix\` first.`);
  const inputs = defaultInputs(matrixPath);
  if (inputs.matrix && 'schema' in inputs.matrix) {
    // The matrix of the validated view (#657): the same check a publisher applies, against the registry, the policy and the taxonomy of this checkout.
    const { loadViewSupportContext, viewMatrixProblems } = await import('./qualification/matrix-publication.ts');
    const problems = viewMatrixProblems(inputs.matrix, await loadViewSupportContext());
    if (problems.length) throw new Error(`Refusing to read ${path.relative(root, matrixPath)} as the view support matrix: ${problems.join('; ')}`);
  }
  const output = buildProviderDossiers(inputs);
  const target = path.resolve(root, typeof options.output === 'string' ? options.output : 'public/results/provider-dossiers-v1.json');
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(output) + '\n', { mode: 0o600, flag: 'wx' });
  await rename(temporary, target);
  console.log(`Providers: ${output.providerCount}, families: ${output.familyCount}; stages ${JSON.stringify(output.stageDistribution)}; verdicts ${JSON.stringify(output.verdictDistribution)}${output.supportMatrix ? '' : '; no support matrix, so nothing reads as measured'}`);
  console.log(`Report: ${path.relative(root, target)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
