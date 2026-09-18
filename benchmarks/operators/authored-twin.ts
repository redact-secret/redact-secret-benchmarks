import type { Operator } from '../engine/types.ts';
import { validateCorpus } from '../lib/scoring.ts';
import { validateAssessment } from '../lib/assessment.ts';
import { secrets } from '../engine/model.ts';

export const authoredTwin: Operator = {
  id: 'authored.twin', version: 1,
  supports: c => Boolean(c.twin),
  generate(c) {
    if (!c.twin) throw new Error('Authored twin requires a twin fixture');
    validateCorpus({ fixtures: [c.seed, c.twin] });
    validateAssessment(c.twin);
    if (c.twin.twinOf !== c.seed.id || c.twin.content === c.seed.content ||
        c.twin.assessment.contract !== c.seed.assessment.contract)
      throw new Error('Twin integrity failure');
    // Preserve the surrounding context (legacy twins sometimes add a final
    // blank line). The declared semantic change must live in the one secret.
    const spans = secrets(c.seed);
    if (spans.length !== 1) throw new Error('Authored twin needs one secret');
    const source = Buffer.from(c.seed.content), span = spans[0];
    const prefix = source.subarray(0, span.start).toString();
    const suffix = source.subarray(span.end).toString().trimEnd();
    const candidate = c.twin.content.trimEnd();
    if (!candidate.startsWith(prefix) || !candidate.endsWith(suffix) ||
        candidate.length <= prefix.length + suffix.length)
      throw new Error('Twin changes surrounding context');
    // Existing twins declare one semantic change, not necessarily one byte
    // edit (e.g. a public-key block derived from its private-key control).
    return { fixture: c.twin, strategy: 'authored', property: c.twin.mutationKind,
      relation: 'must-flip', integrity: { kind: 'authored-single-property', property: c.twin.mutationKind } };
  },
};
