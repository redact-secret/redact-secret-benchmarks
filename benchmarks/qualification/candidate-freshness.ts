/**
 * Whether a candidate diff is bound to the CURRENT pins (#657, #658). `qualification:candidate-diff` proves the candidate and its control differ in the product build
 * only; it does not say the control is the release this checkout accepts. A diff measured against an earlier release or engine (a beta.13 control on alpha.15 when the
 * registry pins beta.14 on alpha.16) is true history and not a statement about the current release, so it is refused, never read as current:
 *  - the control's product is the pinned `redact-secret` release;
 *  - every population of the control carries the semantic digest of the canonical official run of the registry (a re-measurement of the accepted release at the accepted
 *    engine, evidence, configuration and scanner roster hashes to the same value);
 *  - the candidate is a build of that release or a later one, never an earlier one.
 *
 * Two readers share it so they cannot disagree: the publication seam (`scripts/credential-publication.ts candidate`, which fails the publish) and the Next app's
 * release-candidate page (`web/services/candidate.ts`, which states why it shows no candidate). Pure: no file, no network.
 */

/** The parts of a candidate diff (`CandidateDiff`, ./candidate-diff.ts) the binding reads; structural so a hand-made or older shape is judged, not trusted. */
export interface DiffForFreshness {
  candidate?: { version?: string };
  baseline?: { productVersion?: string; archive?: { release?: string; sha256?: string; semanticDigests?: Record<string, string> } };
  /** Each plain population's control digest is `semanticDigest.baseline`; the methods run's is `methods.baselineSemanticDigest`. */
  populations?: { population?: string; semanticDigest?: { baseline?: string } }[];
  methods?: { baselineSemanticDigest?: string | null };
}
export interface RegistryForFreshness { scanners: { id: string; version: string }[]; runs: { id: string; canonical?: boolean; platform: string; artifact: { semanticDigest: string } }[] }

const prerelease = (version: string) => /^(\d+\.\d+\.\d+)-([a-z]+)\.(\d+)$/.exec(version);

/**
 * The control's semantic digest of each run, by the registry's run key (`public-evidence-snapshot`, `public-evidence-snapshot+methods`, ...). A real diff records them
 * on its populations and its methods entry (its `baseline.archive` is only the release and archive digest); an explicit `baseline.archive.semanticDigests` is honoured too.
 */
export function controlDigestsOf(diff: DiffForFreshness): Record<string, string> {
  const digests: Record<string, string> = { ...(diff.baseline?.archive?.semanticDigests ?? {}) };
  for (const p of diff.populations ?? []) if (p.population && p.semanticDigest?.baseline) digests[p.population] = p.semanticDigest.baseline;
  if (diff.methods?.baselineSemanticDigest) digests['public-evidence-snapshot+methods'] = diff.methods.baselineSemanticDigest;
  return digests;
}

/** Every reason the diff is not bound to the pins of this checkout, empty when it is current. */
export function candidateDiffFreshnessProblems(diff: DiffForFreshness, registry: RegistryForFreshness): string[] {
  const problems: string[] = [];
  const pinned = registry.scanners.find(s => s.id === 'redact-secret')?.version;
  const control = diff.baseline?.productVersion;
  if (!pinned) return ['the registry pins no redact-secret release'];
  if (control !== pinned) problems.push(`the control is redact-secret ${String(control)}, the registry pins ${pinned}`);
  const recorded = new Map(registry.runs.filter(r => r.canonical && r.platform === 'linux-x64').map(r => [r.id.replace(/@linux-x64$/, ''), r.artifact.semanticDigest]));
  const digests = controlDigestsOf(diff);
  for (const [key, digest] of recorded) if (digests[key] !== digest) problems.push(`the control's ${key} run is ${String(digests[key])}, the canonical official run is ${digest} (another engine, evidence, configuration or roster)`);
  const a = prerelease(String(diff.candidate?.version)), b = prerelease(pinned);
  if (!a || !b) problems.push(`the candidate version ${String(diff.candidate?.version)} cannot be ordered against the pinned release ${pinned}`);
  else if (a[1] !== b[1] || a[2] !== b[2]) problems.push(`the candidate version ${diff.candidate?.version} is not a build of the pinned release line ${pinned}`);
  else if (Number(a[3]) < Number(b[3])) problems.push(`the candidate is an earlier build (${diff.candidate?.version}) than the pinned release ${pinned}`);
  return problems;
}
