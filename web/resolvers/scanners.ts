/**
 * `/evaluation/scanner` (#612): the scanners the benchmark ran with and the environment each one ran in. Pure:
 * the services' raw facts in, block props out.
 *
 * Boundary rule: this states what the repository records (a pin, a command, a platform, a count of rules) and says
 * "Not recorded" for what it does not. It reads no outcome and never orders scanners by anything but the run's own
 * order. A scanner is described the same way as every other: the same four groups, in the same order.
 */
import type { ScannerFact, ScannerFactGroup, ScannerLink, ScannerModeNoteData, ScannerOverviewProps, ScannerProfileData, ScannerRosterRow } from '../components/evaluation/scanner';
import type { PeerProfile } from '../services/peers';
import type { PeerRuntime, RuntimeTool } from '../services/runtime';
import type { MeasuredRun, RunScanner } from '../services/run';
import type { ScannerEnvironment, ScannerSource, SnapshotFacts } from '../services/scanners';
import { defaultQuery, pairHref, type PairOptions } from './accuracy';
import { count, int, isoDate } from './format';
import { DEFAULT_SETTING, performanceHref, PEERS, type Peer } from './performance';
import { modeText } from './report';

const PRODUCT = 'redact-secret';
const NAMES: Record<string, string> = { 'redact-secret': 'redact-secret', 'flare-redact': 'flare-redact', openredaction: 'OpenRedaction', gitleaks: 'Gitleaks', trufflehog: 'TruffleHog' };
const KIND_LABEL = { 'repository-scanner': 'Repository scanner', 'runtime-library': 'Runtime library' } as const;

export interface ScannerInput {
  environment: ScannerEnvironment;
  profiles: Map<string, PeerProfile>;
  run: MeasuredRun | undefined;
  runtime: PeerRuntime | undefined;
  /** Detectors the product registers (`benchmarks/detectors.json`), or `null` when the catalog could not be read. */
  productDetectors: number | null;
}

const short = (digest: string): string => `${digest.slice(0, 12)}…`;
const TERMS: Record<string, string> = {
  detectors: 'Detectors enabled', rules: 'Rules enabled', runtime: 'Runs on', verification: 'Verification', update: 'Self-update',
  environmentRuleOverrides: 'Environment rule overrides', engine: 'Engine', options: 'Options',
};
const label = (key: string): string => TERMS[key] ?? key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').toLowerCase();
const fact = (term: string, value: string | null, extra: Partial<ScannerFact> = {}): ScannerFact => ({ term, value, ...extra });

function kindOf(id: string, profile: PeerProfile | undefined, runtime: PeerRuntime | undefined): string | null {
  if (profile) return profile.kindLabel;
  // The product is not a peer, so the registry does not list it; the runtime comparison plan names it a runtime library.
  return runtime?.tools.some(t => t.id === id) ? KIND_LABEL['runtime-library'] : null;
}

/** The process limits as the adapter configuration states them: seconds and MiB. */
function limitsText(limits: unknown): string | null {
  if (!limits || typeof limits !== 'object') return null;
  const { timeout, maxBuffer } = limits as { timeout?: number; maxBuffer?: number };
  const parts = [typeof timeout === 'number' ? `${int(timeout / 1000)} s timeout` : '', typeof maxBuffer === 'number' ? `${int(maxBuffer / (1024 * 1024))} MiB output` : ''].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

const SHOWN_ELSEWHERE = new Set(['adapterVersion', 'familyMappingVersion', 'binary', 'package', 'arguments', 'processLimits']);

/** The adapter configuration as facts: each key the benchmark recorded, as recorded. Arguments go to the disclosure. */
function configurationFacts(configuration: Record<string, unknown>): ScannerFact[] {
  const out: ScannerFact[] = [];
  const limits = limitsText(configuration.processLimits);
  if (limits) out.push(fact('Limits', limits));
  for (const [key, value] of Object.entries(configuration)) {
    if (SHOWN_ELSEWHERE.has(key)) continue;
    const text = typeof value === 'object' ? JSON.stringify(value) : typeof value === 'boolean' ? (value ? 'on' : 'off') : String(value);
    if (text === '{}') out.push(fact(label(key), 'none (package defaults)'));
    else out.push(fact(label(key), text, { code: typeof value === 'object' }));
  }
  return out;
}

function snapshotRange(s: SnapshotFacts): string {
  const from = isoDate(s.observedFrom);
  const to = isoDate(s.observedTo);
  return from === to ? from : `${from} to ${to}`;
}

function sameOrMany(values: string[], one: (v: string) => string, many: string): string {
  return values.length === 1 ? one(values[0]) : many;
}

function installFacts(source: ScannerSource, run: RunScanner | undefined): ScannerFact[] {
  const out: ScannerFact[] = [fact('Pinned version', source.pin.version, { code: true, note: source.pin.file })];
  out.push(fact('Observed in this run', run?.version ?? null, { code: true, note: run?.version ? 'the version the scanner reported' : undefined }));
  if (source.release) {
    const archives = new Map(source.release.archives.map(a => [a.platform, a]));
    const observed = source.snapshots?.observed ?? [];
    const matched = observed.map(o => ({ o, archive: archives.get(o.platform) })).filter(m => m.archive);
    out.push(fact('Installed from', 'Release archive', {
      note: `${source.release.repo} v${source.pin.version}. The SHA-256 of each platform's archive is pinned in scanners/peer-checksums.json and checked before anything is extracted or run.`,
    }));
    for (const { o, archive } of matched) {
      out.push(fact(`Archive, ${o.platform}`, archive!.archive, { code: true, note: `SHA-256 ${short(archive!.sha256)}${archive!.sha256 === o.digest ? ', the digest the snapshots recorded' : ', not the digest the snapshots recorded'}` }));
    }
    out.push(fact('Location', 'Read-only directory first on PATH', { note: 'npm run peers:provision makes the directory read-only, so the scanner cannot update itself.' }));
  } else if (source.npm) {
    out.push(fact('Installed from', `npm, ${source.npm.name}`, {
      note: source.npm.integrity ? `package-lock.json holds ${source.npm.lockedVersion ?? 'no version'} with integrity ${source.npm.integrity.slice(0, 18)}…` : 'not in package-lock.json',
    }));
  }
  return out;
}

function ranFacts(source: ScannerSource, run: RunScanner | undefined, tool: RuntimeTool | undefined): ScannerFact[] {
  const snap = source.snapshots;
  const configuration = snap?.configuration ?? source.adapter ?? null;
  const mode = run?.mode ?? (snap ? sameOrMany(snap.modes, v => v, `${snap.modes.length} mode lines`) : null);
  const out: ScannerFact[] = [fact('Mode line', mode, { note: run ? undefined : snap ? 'from the committed snapshots; no run is published' : undefined })];
  if (configuration) {
    const adapter = `adapter v${String(configuration.adapterVersion ?? '?')} · family mapping v${String(configuration.familyMappingVersion ?? '?')}`;
    out.push(fact('Adapter', adapter));
    out.push(...configurationFacts(configuration));
  } else {
    out.push(fact('Configuration', null));
  }
  if (snap) {
    out.push(fact('Configuration hash', sameOrMany(snap.configurationHashes, short, `${snap.configurationHashes.length} different hashes`), {
      code: true,
      note: snap.configurationHashes.length === 1 ? `the same in all ${count(snap.count, 'snapshot')}` : `across ${count(snap.count, 'snapshot')}`,
    }));
  }
  if (tool) out.push(fact('Runtime comparison call', `${tool.call}(), ${tool.async ? 'asynchronous' : 'synchronous'}`, { code: true }));
  return out;
}

function runtimeRunner(runtime: PeerRuntime | undefined, id: string): { text: string; note: string } | null {
  const measured = runtime?.comparison?.settings.map(s => s.run).find(r => r.state === 'measured');
  if (!measured || measured.state !== 'measured') return null;
  const tool = measured.tools.find(t => t.id === id);
  if (!tool) return null;
  const { runner } = measured;
  return {
    text: `${runner.platform} ${runner.arch} · Node ${runner.node}`,
    note: `${runner.cpuModel}, ${count(runner.cpuLimit, 'CPU')} · ${id} ${tool.version} (${tool.buildKind.replace(/-/g, ' ')}) · ${isoDate(measured.generatedAt)}`,
  };
}

function whereFacts(source: ScannerSource, run: MeasuredRun | undefined, scanner: RunScanner | undefined, runtime: PeerRuntime | undefined): ScannerFact[] {
  const out: ScannerFact[] = [];
  const snap = source.snapshots;
  const fresh = scanner?.observations.some(o => o.source === 'fresh');
  if (run && fresh) {
    out.push(fact('This run', run.hosts.map(h => `Node ${h.node} · ${h.platform} ${h.arch}`).join('; ') || null, { note: `observed fresh, ${isoDate(run.generatedAt)}; OS release and CPU are not part of the run` }));
  } else if (snap) {
    out.push(fact('Observed', `Snapshots, ${snapshotRange(snap)}`, { note: `${count(snap.count, 'committed snapshot')}${snap.invalid ? `, ${count(snap.invalid, 'snapshot')} left out because they did not validate` : ''}` }));
    out.push(fact('Installed artifact', sameOrMany(snap.observed.map(o => o.platform), p => (p === 'npm-lock' ? 'npm lockfile build' : `${p} binary`), `${snap.observed.length} artifacts`), { note: `artifact digest ${sameOrMany(snap.artifactDigests, short, 'differs between snapshots')}` }));
    out.push(fact('Replays', `${snap.replayCounts.join(', ')} per snapshot, ranges agreed`));
  } else {
    out.push(fact('Observed', null));
  }
  if (snap && !(run && fresh)) out.push(fact('Host OS release, CPU and Node of the snapshots', null));
  const runner = runtimeRunner(runtime, source.id);
  if (runner) out.push(fact('Runtime comparison', runner.text, { note: runner.note }));
  return out;
}

function rulesFacts(id: string, profile: PeerProfile | undefined, productDetectors: number | null): ScannerFact[] {
  if (profile) {
    return [fact('Rules', int(profile.ruleCount), {
      note: `rule file ${profile.ruleFileVersion}${profile.ruleFilePath ? `, ${profile.ruleFilePath}` : ''} · ${int(profile.mappedRules)} are mapped to a taxonomy family`,
    })];
  }
  if (id === PRODUCT) return [fact('Registered detectors', productDetectors === null ? null : int(productDetectors), { note: 'benchmarks/detectors.json' })];
  return [fact('Rules', null)];
}

function comparedOn(id: string, kind: string | null, run: MeasuredRun | undefined, runtime: PeerRuntime | undefined): ScannerLink[] {
  const links: ScannerLink[] = [];
  const peersInRun = run?.scanners.filter(s => s.id !== PRODUCT).map(s => s.id) ?? [];
  const runtimeIds = runtime?.tools.map(t => t.id).filter(t => t !== PRODUCT) ?? [];
  const options: PairOptions = { credentials: peersInRun, pii: runtimeIds };
  if (id === PRODUCT) {
    links.push({ label: 'Report', href: '/report/' }, { label: 'Comparison', href: '/comparison/' });
  } else {
    if (peersInRun.includes(id)) links.push({ label: 'Accuracy, credentials', href: pairHref({ ...defaultQuery(options), with: id }, options) });
    if (runtimeIds.includes(id)) links.push({ label: 'Accuracy, personal data', href: pairHref({ ...defaultQuery(options), domain: 'pii', with: id }, options) });
  }
  if (kind === KIND_LABEL['runtime-library'] && runtime?.tools.some(t => t.id === id)) {
    links.push({ label: 'Runtime', href: '/comparison/runtime/' }, { label: 'Features', href: '/comparison/feature/' });
    if ((PEERS as string[]).includes(id)) links.push({ label: 'Performance', href: performanceHref(id as Peer, DEFAULT_SETTING) });
  }
  return links;
}

function profileOf(source: ScannerSource, input: ScannerInput, scanner: RunScanner | undefined): ScannerProfileData {
  const { profiles, run, runtime, productDetectors } = input;
  const profile = profiles.get(source.id);
  const kind = kindOf(source.id, profile, runtime);
  const tool = runtime?.tools.find(t => t.id === source.id);
  const configuration = source.snapshots?.configuration ?? source.adapter;
  const args = Array.isArray(configuration?.arguments) ? (configuration!.arguments as string[]).join(' ') : null;
  const name = scanner?.name ?? NAMES[source.id] ?? source.id;
  const groups: ScannerFactGroup[] = [
    { title: 'Install and pin', facts: installFacts(source, scanner) },
    { title: 'How it ran', facts: ranFacts(source, scanner, tool) },
    { title: 'Where it ran', facts: whereFacts(source, run, scanner, runtime) },
    { title: 'Rules', facts: rulesFacts(source.id, profile, productDetectors) },
  ];
  return {
    id: source.id,
    name,
    version: scanner?.version ?? source.pin.version ?? 'unknown version',
    kind,
    description: profile?.description ?? null,
    groups,
    command: args ? { summary: 'Exact arguments', label: `${name} arguments`, text: args } : null,
    outOfScope: profile?.outOfScope ?? null,
    compared: comparedOn(source.id, kind, run, runtime),
  };
}

function modeNote(run: MeasuredRun | undefined): ScannerModeNoteData {
  const common = {
    title: 'Published and candidate',
    paragraphs: ['Published measures the released npm package. Candidate measures an unreleased redact-secret build at a named commit. The other scanners run at their pinned release in both modes, so a stable count always names which of the two it came from.'],
  };
  if (!run) return { ...common, mode: null, modeLabel: 'No benchmark run is published for this checkout, so no mode is recorded.' };
  if (run.mode === 'candidate' && run.candidate) {
    return { ...common, mode: 'candidate', modeLabel: `This run measured an unreleased ${PRODUCT} build, ${run.candidate.declaredVersion} at commit ${run.candidate.sourceCommit.slice(0, 12)}.` };
  }
  return { ...common, mode: 'published', modeLabel: `This run measured the released ${PRODUCT} ${run.productVersion ?? 'version not recorded'}.` };
}

export function resolveScanners(input: ScannerInput): ScannerOverviewProps {
  const { environment, run } = input;
  const byId = new Map(environment.sources.map(s => [s.id, s]));
  const ordered: { source: ScannerSource; scanner: RunScanner | undefined }[] = run
    ? run.scanners.flatMap(s => { const source = byId.get(s.id); return source ? [{ source, scanner: s }] : []; })
    : environment.sources.map(source => ({ source, scanner: undefined }));
  const profiles = ordered.map(({ source, scanner }) => profileOf(source, input, scanner));
  const rows: ScannerRosterRow[] = profiles.map((p, i) => ({
    id: p.id, name: p.name, kind: p.kind, version: p.version, pinnedIn: ordered[i].source.pin.file, mode: ordered[i].scanner?.mode ?? null,
  }));
  return {
    // The Evaluation hub (`/evaluation/`) is owned by the methods phase; its crumb gets an address when that page is in the app.
    breadcrumb: [{ label: 'Evaluation' }, { label: 'Scanners' }],
    eyebrow: 'Evaluation',
    title: 'Scanners and where they ran',
    lede: 'The scanners this benchmark ran with: the version of each, how it was installed, how it was run, where it was observed and what was left out. Results are on the report and comparison pages.',
    meta: run
      ? [{ label: 'Mode', value: modeText(run) }, { label: 'Run', value: `${isoDate(run.generatedAt)} · ${count(run.suiteCount, 'suite')}` }]
      : [],
    roster: {
      title: count(rows.length, 'scanner'),
      description: run ? 'In the order the run lists them. The kind and the description come from the scanner registry, the version from the run.' : 'No benchmark run is published for this checkout. Versions are the pins; the mode line is not recorded.',
      rows,
    },
    modeNote: modeNote(run),
    profiles,
  };
}
