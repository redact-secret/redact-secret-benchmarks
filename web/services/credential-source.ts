/**
 * The data behind the credential report pages, from whichever pipeline the committed authority names (#608).
 *
 * `loadCredentialSource()` is the one seam: it asks `services/authority.ts` which pipeline is the authority and returns the same
 * shapes either way, so the pages, resolvers and blocks do not know which one they render.
 *
 *  - `legacy`: the committed fixture corpora and the legacy run files (`catalog.ts`, `run.ts`), exactly as before the switch;
 *  - `new`: the qualification view (`qualification.ts`) bridged by `credential-bridge.ts`, and only while it is the view the authorisation
 *    names (the policy revision and every population's semantic digest). A view that is absent, unreadable, built from other pins or
 *    not the authorised one yields no numbers, only the reason and the commands, never a silent fall back to the legacy files: a page
 *    that showed legacy numbers under an authority of `new` would say the wrong thing about where they came from.
 *
 * Rolling back is changing the one committed value; this module is where it takes effect for the Next app.
 */
import { validateAccounting } from '../../benchmarks/lib/accounting';
import type { AccountingConfig } from '../../benchmarks/types';
import { loadAuthority, type Authority, type QualificationAuthority } from './authority';
import { assembleCatalog, loadCatalog, loadDetectorTitles, loadFixtureBytes, loadFixtureHashes, loadTaxonomy, type BuiltFixture, type Catalog } from './catalog';
import { bridgeQualificationView } from './credential-bridge';
import { loadQualificationView, QUALIFICATION_COMMANDS, QUALIFICATION_FILE, type QualificationView } from './qualification';
import { once, readJson } from './repo';
import { loadReviewDisclosure, type ReviewDisclosureData } from './review-state';
import { loadRun, type RunLoad } from './run';

/** The one suite page a build without a usable qualification view keeps, so the export has a page for the route. */
export const NO_VIEW_SUITE = 'no-view';

export type ViewState = 'ready' | 'not-built' | 'incompatible' | 'stale' | 'unauthorised';

/** What a page says about where its numbers came from. Facts only: the words are the resolver's. */
export interface CredentialPipeline {
  authority: Authority;
  /** Whether the value was read from the committed authority file or is the default because there is none. */
  from: 'committed' | 'default';
  /** Present when the pages were built from the new path: what the view is and whether it is the authorised one. */
  view?: {
    state: ViewState;
    /** Why the view gives no numbers. Present unless `state` is `ready`. */
    reason?: string;
    /** The commands that produce the view. */
    commands: string[];
    policyRevision?: string;
    population?: string;
    semanticDigest?: string;
    engine?: string;
    evidenceTag?: string;
    release?: string;
    recordedOn?: string | null;
  };
  /** Present when the accepted evidence release records fixtures in the `maintainer-only` review state (a disclosure, not a number of the view). */
  reviewDisclosure?: ReviewDisclosureData;
}

export interface CredentialSource {
  pipeline: CredentialPipeline;
  catalog: Catalog;
  run: RunLoad;
  /** Each fixture's expected spans and assessment by slug. Its `content` is empty where `contentRecorded` is false. */
  fixtureBytes: Map<string, BuiltFixture>;
  /** sha256 of each fixture's bytes by slug; empty when the pipeline records no bytes. */
  fixtureHashes: Map<string, string>;
  /**
   * The status distribution of the families, as the new pipeline's view records it, for the page that states a stable count. Absent
   * on the legacy pipeline, whose count is the committed support record that `services/domains.ts` finds for the run's own mode and build.
   */
  support?: {
    version: string | null;
    recordedOn: string | null;
    familyCount: number;
    distribution: Record<'stable' | 'provisional' | 'pending' | 'unsupported', number>;
    stable: { documented: number; empirical: number; policyQualified: number };
    /** The committed file that records the runs the view is built from. */
    path: string;
  };
}

/** Why a view that has the right shape is not the one the authorisation names; empty when it is. */
export function viewAuthorisationProblems(file: QualificationAuthority, view: QualificationView): string[] {
  const problems: string[] = [];
  if (view.policy.revision !== file.new.policyRevision) problems.push(`the view was qualified with policy ${view.policy.revision}, the authorisation names ${file.new.policyRevision}`);
  const seen = new Set<string>();
  for (const population of view.populations) {
    const id = population.population;
    seen.add(id);
    if (file.new.semanticDigests[id] !== population.artifact.semanticDigest) problems.push(`${id} is a run other than the authorised one`);
    if (population.methodsArtifact) {
      seen.add(`${id}+methods`);
      if (file.new.semanticDigests[`${id}+methods`] !== population.methodsArtifact.semanticDigest) problems.push(`the methods run of ${id} is not the authorised one`);
    }
  }
  for (const id of Object.keys(file.new.semanticDigests)) if (!seen.has(id)) problems.push(`the authorisation names a run of ${id} that the view does not carry`);
  return problems;
}

interface Registry { runs: { id: string; canonical: boolean; recordedOn?: string }[] }

async function legacySource(): Promise<Omit<CredentialSource, 'pipeline'>> {
  const [catalog, run, fixtureBytes, fixtureHashes] = await Promise.all([loadCatalog(), loadRun(), loadFixtureBytes(), loadFixtureHashes()]);
  return { catalog, run, fixtureBytes, fixtureHashes };
}

/** The legacy pipeline's data whatever the authority is: what the oracle pages (the comparison pages) read. */
export function loadLegacySource(): Promise<CredentialSource> {
  return once('credential-source:legacy', async () => ({ pipeline: { authority: 'legacy' as const, from: (await loadAuthority()).from }, ...(await legacySource()) }));
}

async function unavailable(authority: QualificationAuthority, state: Exclude<ViewState, 'ready'>, reason: string): Promise<CredentialSource> {
  // A build that publishes the new pipeline sets WEB_REQUIRE_QUALIFICATION=1: a missing view then fails it, instead of publishing pages that say there is none.
  if (process.env.WEB_REQUIRE_QUALIFICATION === '1') throw new Error(`WEB_REQUIRE_QUALIFICATION=1 and the authority is new, but the qualification view cannot be used (${state}): ${reason}`);
  const [taxonomy, titles] = await Promise.all([loadTaxonomy(), loadDetectorTitles()]);
  // `output: export` refuses a dynamic route with no params, so the suite route keeps one page that says why there is nothing to list.
  const suites = [{ id: NO_VIEW_SUITE, title: 'No qualification view for this build', description: 'No usable qualification view backs this build, so no suite is listed and no fixture is measured.', reviewStatus: '' }];
  const catalog = assembleCatalog({ fixtures: [], taxonomy, suites, detectors: [...titles].map(([id, title]) => ({ id, title })), scenarioTitles: new Map() });
  return {
    pipeline: { authority: 'new', from: 'committed', view: { state, reason, commands: QUALIFICATION_COMMANDS, policyRevision: authority.new.policyRevision, release: authority.new.release } },
    catalog, run: { state: 'not-published', reason }, fixtureBytes: new Map(), fixtureHashes: new Map(),
  };
}

async function newSource(authority: QualificationAuthority): Promise<CredentialSource> {
  const load = await loadQualificationView();
  if (load.state !== 'ready') return unavailable(authority, load.state, load.reason);
  const problems = viewAuthorisationProblems(authority, load.view);
  if (problems.length) return unavailable(authority, 'unauthorised', `${QUALIFICATION_FILE} is not the view the authorisation names: ${problems.join('; ')}.`);

  const [taxonomy, detectorTitles, suite, registry] = await Promise.all([
    loadTaxonomy(), loadDetectorTitles(), readJson<{ accounting: unknown }>('qualification/suite-v1.json'), readJson<Registry>('benchmarks/official-runs.json'),
  ]);
  const accounting: AccountingConfig = validateAccounting(suite.accounting);
  const reportPopulationId = load.view.populations.find(p => p.role === 'floors-and-gates')?.population;
  const recorded = registry.runs.find(r => r.canonical && r.id.startsWith(`${reportPopulationId}@`));
  const bridged = bridgeQualificationView(load.view, { taxonomy, detectorTitles, accounting, recordedOn: recorded?.recordedOn ?? null });
  if ('problem' in bridged) return unavailable(authority, 'incompatible', `${QUALIFICATION_FILE} cannot be read as a report: ${bridged.problem}.`);
  const { population } = bridged;
  const reviewDisclosure = await loadReviewDisclosure(population.artifact.evidence.release?.tag);
  return {
    pipeline: {
      authority: 'new', from: 'committed', ...(reviewDisclosure ? { reviewDisclosure } : {}),
      view: {
        state: 'ready', commands: QUALIFICATION_COMMANDS, policyRevision: load.view.policy.revision, population: population.population,
        semanticDigest: population.artifact.semanticDigest, engine: `${population.artifact.engine.name} ${population.artifact.engine.version}`,
        evidenceTag: population.artifact.evidence.release?.tag, release: authority.new.release, recordedOn: recorded?.recordedOn ?? null,
      },
    },
    catalog: bridged.catalog, run: bridged.run, fixtureBytes: bridged.fixtureBytes, fixtureHashes: new Map(),
    support: {
      version: bridged.run.productVersion, recordedOn: recorded?.recordedOn ?? null, familyCount: load.view.families.length,
      distribution: { stable: load.view.distribution.stable ?? 0, provisional: load.view.distribution.provisional ?? 0, pending: load.view.distribution.pending ?? 0, unsupported: load.view.distribution.unsupported ?? 0 },
      stable: { documented: load.view.stableDistribution.documented ?? 0, empirical: load.view.stableDistribution.empirical ?? 0, policyQualified: load.view.stableDistribution['policy-qualified'] ?? 0 },
      path: 'benchmarks/official-runs.json',
    },
  };
}

export function loadCredentialSource(): Promise<CredentialSource> {
  return once('credential-source', async () => {
    const state = await loadAuthority();
    if (state.authority === 'new' && state.file) return newSource(state.file);
    return { pipeline: { authority: 'legacy' as const, from: state.from }, ...(await legacySource()) };
  });
}
