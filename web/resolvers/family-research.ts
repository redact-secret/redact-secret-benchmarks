/**
 * The family's research record from the canonical credential-evidence records (#591, #582, #590; services/research.ts). Pure: the
 * projection state and one family's projected record in, block props out.
 *
 *  - Review state is the family record's own lifecycle, in the words of the release (`maintainer-only` in the owner's fixed words of
 *    #680). Format revision is the presented contract revision and its period; a family with no current revision says so.
 *  - Research state, blockers and rulings are separate lines, never folded into one verdict, and none of them is a support status.
 *  - Nothing absent is filled in: a family the release has no record of, an absent projection and a projection from another release
 *    than the pin each show "Not recorded" with the reason.
 */
import type { FamilyRecordFact, FamilyRecordLine, FamilyResearchRecordData, FamilyRevisionItem } from '../components/family/types';
import type { Lifecycle, ProjectedFamily, Research, ResearchRelease } from '../services/research';
import { count } from './format';

export const REVIEW_STATE: Record<Lifecycle, string> = {
  draft: 'Draft, not reviewed',
  'maintainer-only': 'Maintainer-reviewed (independent review pending)',
  reviewed: 'Reviewed',
  deprecated: 'Deprecated',
  withdrawn: 'Withdrawn',
};

const RESEARCH_STATE: Record<ProjectedFamily['research']['state'], string> = {
  unresearched: 'Not researched', researched: 'Researched', 'not-found': 'Not found', rejected: 'Rejected',
};

const BLOCKER: Record<string, string> = {
  'issuance-gated': 'Issuance-gated', 'date-gated': 'Date-gated', 'documentation-gated': 'Documentation-gated', other: 'Other',
};

const AFFILIATION: Record<string, string> = { 'project-maintainer': 'project maintainer', external: 'external', unknown: 'affiliation unknown' };

const short = (contractId: string): string => contractId.slice(contractId.lastIndexOf('@'));

/** "credential-evidence snapshot-2026.10.06.4 · records at 77ce761 · schema 1.8.0". */
export const provenanceText = (release: ResearchRelease): string =>
  `credential-evidence ${release.release} · records at ${release.commit.slice(0, 7)} · schema ${release.schemaRevision}`;

/** "1 · current", "2 · proposed, none current", or `null` when the family has no format contract. */
export function revisionText(family: ProjectedFamily): string | null {
  const presented = family.contract && family.revisions.find(r => r.id === family.contract!.id);
  if (!presented) return null;
  return presented.current ? `${presented.revision} · ${presented.period}` : `${presented.revision} · ${presented.period}, none current`;
}

/** The one-line summary the provider list shows under a family: review state and format revision, or "Research record not recorded". */
export function researchLine(family: ProjectedFamily | undefined): string {
  if (!family) return 'Research record not recorded';
  const revision = revisionText(family);
  return `${REVIEW_STATE[family.lifecycle]} · ${revision ? `format revision ${revision}` : 'no format revision recorded'}`;
}

function revisions(family: ProjectedFamily): FamilyRevisionItem[] {
  if (family.revisions.length < 2) return [];
  return family.revisions.map(r => {
    const successors = family.revisions.filter(o => o.supersedes === r.id).map(o => short(o.id));
    const validity = [r.validity.from && `from ${r.validity.from}`, r.validity.until && `until ${r.validity.until}`].filter(Boolean).join(' ');
    const detail = [
      r.period, REVIEW_STATE[r.lifecycle].toLowerCase(),
      ...(r.supersedes ? [`supersedes ${short(r.supersedes)}`] : []),
      ...(successors.length ? [`superseded by ${successors.join(', ')}`] : []),
      ...(validity ? [`issued ${validity}`] : []),
      ...(r.current ? ['the family\'s current revision'] : []),
    ].join(' · ');
    return { id: r.id, label: `Revision ${r.revision}`, detail, current: r.current };
  });
}

function reviewText(family: ProjectedFamily): string {
  const { review } = family;
  if (!review.history || review.events === 0) return 'No review history is recorded for this family.';
  const kinds = Object.entries(review.byType).sort(([a], [b]) => a.localeCompare(b)).map(([type, n]) => `${n} ${type}`).join(', ');
  const latest = review.latest ? ` Latest: ${review.latest.type} on ${review.latest.at} by ${review.latest.role}, ${AFFILIATION[review.latest.affiliation] ?? review.latest.affiliation}.` : '';
  const maintained = review.latest?.affiliation === 'project-maintainer' ? ' Project-maintained review is not independent validation.' : '';
  return `${count(review.events, 'event')} in the review history: ${kinds}.${latest}${maintained}`;
}

const notRecorded = (label: string): FamilyRecordFact => ({ label, value: 'Not recorded', tone: 'not-measured' });
const EMPTY_FACTS: FamilyRecordFact[] = [notRecorded('Review state'), notRecorded('Format revision'), notRecorded('Research'), notRecorded('Researched')];

export function resolveResearchRecord(research: Research, familyId: string): FamilyResearchRecordData {
  if (research.state === 'absent') {
    return {
      provenance: 'credential-evidence', facts: EMPTY_FACTS, revisions: [], blockers: [], rulings: [],
      absent: { title: 'No research record', text: 'No research projection is committed, so nothing is stated about this family\'s research. npm run research:project writes it from the pinned evidence release.' },
    };
  }
  if (research.state === 'stale') {
    return {
      provenance: provenanceText(research.release), facts: EMPTY_FACTS, revisions: [], blockers: [], rulings: [],
      absent: { title: 'No research record for the pinned release', text: `The projection is from ${research.release.release}, and the benchmark pins ${research.pinned}; an older record is not shown as current. npm run research:project rewrites it.` },
    };
  }
  const family = research.families.get(familyId);
  const provenance = provenanceText(research.release);
  if (!family) {
    return {
      provenance, facts: EMPTY_FACTS, revisions: [], blockers: [], rulings: [],
      absent: { title: 'No research record for this family', text: `${research.release.release} has no family record for ${familyId}, so its review state, format revision and format facts are not recorded here.` },
    };
  }
  const revision = revisionText(family);
  const facts: FamilyRecordFact[] = [
    { label: 'Review state', value: REVIEW_STATE[family.lifecycle] },
    revision ? { label: 'Format revision', value: revision } : notRecorded('Format revision'),
    { label: 'Research', value: RESEARCH_STATE[family.research.state] },
    family.research.researchedAt ? { label: 'Researched', value: family.research.researchedAt } : notRecorded('Researched'),
  ];
  const blockers: FamilyRecordLine[] = family.research.blockers.map(b => ({ ref: BLOCKER[b.kind] ?? b.kind, text: b.summary }));
  const rulings: FamilyRecordLine[] = family.review.decided.map(d => ({ ref: d.ref, at: d.at, text: d.note }));
  return {
    provenance, facts, revisions: revisions(family), blockers, rulings, review: reviewText(family),
    recordHref: `https://github.com/${research.release.repository}/blob/${research.release.commit}/${family.record}`,
  };
}
