import type { FamilyFormatData } from '../components/family/types';
import type { EvidenceClass, Research } from '../services/research';
import { provenanceText } from './family-research';

const CLASS: Record<EvidenceClass, string> = {
  'provider-documented': 'Provider documented', 'tool-corroborated': 'Tool corroborated',
  'project-policy': 'Project policy', unresolved: 'Unresolved',
};

/** Never infer segments from a regex or assign evidence classes by matching claim text. */
export function resolveFamilyFormat(research: Research, familyId: string): FamilyFormatData {
  const empty = (provenance: string, absent: string): FamilyFormatData => ({ provenance, absent, shape: [], claims: [], questions: [] });
  if (research.state === 'absent') return empty('credential-evidence', 'No research projection is recorded.');
  if (research.state === 'stale') return empty(provenanceText(research.release), `The projection is from ${research.release.release}; the benchmark pins ${research.pinned}.`);
  const provenance = provenanceText(research.release);
  const family = research.families.get(familyId);
  if (!family?.contract) return empty(provenance, 'No format contract is recorded for this family in the pinned release.');
  const contract = family.contract;
  const s = contract.structure;
  const shape: FamilyFormatData['shape'] = [];
  if (s.prefixes?.length) shape.push({ label: 'Prefixes', value: s.prefixes.join(' · ') });
  for (const c of s.components ?? []) shape.push({ label: `${c.name} (${c.role})`, value: c.description ?? 'Description not recorded' });
  if (s.separators?.length) shape.push({ label: 'Separators', value: s.separators.join(' · ') });
  if (s.length) shape.push({ label: 'Length', value: s.length.exact !== undefined ? String(s.length.exact) : [s.length.min !== undefined && `min ${s.length.min}`, s.length.max !== undefined && `max ${s.length.max}`].filter(Boolean).join(' · ') || 'Not recorded' });
  if (s.alphabet) shape.push({ label: 'Alphabet', value: [s.alphabet.name, s.alphabet.characters].filter(Boolean).join(' · ') || 'Not recorded' });
  if (s.checksum) shape.push({ label: 'Checksum', value: s.checksum });
  if (s.descriptivePattern) shape.push({ label: 'Descriptive pattern', value: s.descriptivePattern });
  const claims = contract.claims.map(c => ({
    id: c.id, text: c.statement, evidenceClass: c.evidenceClass, evidenceLabel: CLASS[c.evidenceClass], date: c.observedAt, temporality: c.temporality,
    sources: c.sources.map(ref => {
      const source = research.sources.get(ref.sourceId)!;
      return { id: ref.sourceId, label: source.title, href: source.url, detail: `${source.sourceType} · last read ${source.lastReadAt ?? 'not recorded'} · latest outcome ${source.lastOutcome} · supports ${ref.supports}${ref.locator ? ` · ${ref.locator}` : ''}` };
    }),
  }));
  return { provenance, shape, claims, questions: contract.openQuestions.map(q => ({ ref: `${contract.id}#${q.id}`, at: q.raisedAt, text: q.question })) };
}
