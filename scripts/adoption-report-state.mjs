/**
 * The current state an adoption report states (#700), derived from the structured adoption record and the registry, never from prose.
 *
 * A report is generated while an adoption is a candidate and regenerated after it is accepted, so every sentence about acceptance, deployment, the scanned
 * product and measured capability comes from here: the record's `state`, `candidate.ownerAcceptance`, `candidate.deployment`, `candidate.replay` and the
 * registry's scanner pins. A deployment receipt is shown only when the record holds one; an absent receipt is reported as absent.
 */

/** Maintainer-only disclosure wording (credential-evidence ADR 0020; the UI uses the same words). */
export const MAINTAINER_REVIEWED_KO = '메인테이너 검토 (독립 검토 대기)';
export const MAINTAINER_REVIEWED_EN = 'Maintainer-reviewed (independent review pending)';

/** Representation capability as the engine contract states it (credential-eval representation/1, ADR 0005). One text for every generator. */
export const REPRESENTATION_CAPABILITY =
  'Representation capability follows the engine contract (credential-eval representation/1): a bounded, re-derivable base64 or hex finding (up to four layers) is mapped to the whole original encoded segment and scored by the unchanged lattice; ' +
  'a fragmented expected span is scored on its enclosing range, and there is no fragment-aware scoring; decoded findings in other codecs (percent-encoding, UTF-16, escaped Unicode) and any mapping the engine cannot re-derive are unmeasured, never a miss and in no denominator (credential-eval#34, credential-evidence#150).';

export const SCOPE_LINE =
  'Reporting only: nothing here is an assertion about the product. Denominators count measured cases only: pending (T0, not assertable) and not-measured cases are in none, and an unmeasured case is never a zero detection. ' +
  REPRESENTATION_CAPABILITY;

const tagShort = tag => String(tag ?? '').replace(/^v0\.1\.0-/, '');

/**
 * `adoption` is benchmarks/evidence-adoption.json, `registry` benchmarks/official-runs.json (the scanner pins the accepted runs used). Pure.
 * `product.measured` is the product release the replayed adapters scanned; `product.claimedByThisRun` is therefore only that release.
 */
export function adoptionReportState(adoption, registry) {
  const c = adoption?.candidate ?? {};
  const state = adoption?.state ?? 'none';
  const product = registry?.scanners?.find(s => s.id === 'redact-secret')?.version ?? null;
  return {
    state,
    accepted: state === 'accepted',
    evidenceRelease: c.evidenceRelease ?? null,
    engine: c.engine?.tag ?? null,
    ownerAcceptance: c.ownerAcceptance ?? null,
    replay: { ciRun: c.replay?.ciRun ?? null, archive: c.replay?.archive ?? null, benchmarkRevision: c.replay?.benchmarkRevision ?? null },
    deployment: { staging: c.deployment?.staging ?? null, production: c.deployment?.production ?? null },
    product: {
      measured: product ? `@redact-secret/core@${product}` : null,
      note: `${tagShort(c.engine?.tag)} measured ${product ? `core ${product}` : 'the pinned core release'} (the adapters of the engine tag pin it). Any claim about another core release (an unpublished build, or a release later than this one) needs the pinned replay of this identical snapshot against that release (#697); nothing here is evidence about it.`,
    },
  };
}

/** The labels of the two sides of every comparison: before acceptance the old population is "Accepted" and the new one "Candidate"; after, the old one is the baseline. */
export const sideLabels = state => (state.accepted ? { base: 'Baseline', current: 'Accepted' } : { base: 'Accepted', current: 'Candidate' });

const receipt = (r, none) => (r ? (typeof r === 'string' ? r : JSON.stringify(r)) : none);

/** The "Status" section of the report: lines of Markdown that agree with the record. */
export function statusLines(state, { previousRelease, reviewRelease }) {
  const a = state.ownerAcceptance;
  const adr = a?.decision ? `[${a.decision.split('/').pop()}](../../decisions/${a.decision.split('/').pop()})` : null;
  const none = 'not recorded in the adoption record';
  const rows = [
    ['Adoption state', state.accepted ? '`accepted` (owner decision recorded)' : state.state === 'candidate' ? '`candidate` (no owner acceptance; the previous accepted runs stay the public numbers)' : `\`${state.state}\``],
    ['Owner acceptance', state.accepted && a ? `${a.acceptedBy}, ${a.acceptedOn}: ${adr}. The acceptance adopts this evidence population for measurement; it is not an independent review of the evidence.` : 'none'],
    ['Evidence review', `${MAINTAINER_REVIEWED_EN} / ${MAINTAINER_REVIEWED_KO}${reviewRelease ? `: ${reviewRelease.maintainerOnly} fixtures are maintainer-only (finalized by the sole maintainer), ${reviewRelease.reviewed} are independently reviewed` : ''}. Owner acceptance is not independent evidence review.`],
    ['Comparison baseline', `${previousRelease ?? 'the previous accepted population'} (kept as the baseline of every comparison below)`],
    ['Official replay', state.replay.ciRun ? `${state.replay.ciRun}${state.replay.archive ? `; archive release \`${state.replay.archive.release}\` (\`${state.replay.archive.sha256}\`)` : ''}` : 'none recorded'],
    ['Product measured', state.product.note],
    ['Deployment receipts', `staging: ${receipt(state.deployment.staging, none)}; production: ${receipt(state.deployment.production, none)}. A receipt is recorded only from a real deployment verification (#680 collects them); production promotion (\`go-production\`) is a separate owner decision.`],
  ];
  return ['| Item | Current state |', '| --- | --- |', ...rows.map(([k, v]) => `| ${k} | ${v} |`)];
}
