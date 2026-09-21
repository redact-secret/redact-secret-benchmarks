import type { Fixture, FormatContract } from '../types.ts';
// docs/measurement-v4.md §2.5 amendment, 2026-09-21 (#84) and
// docs/decisions/2026-09-21-check-lexical-separability.md: no fixture pair may
// be lexically inseparable. A frozen contract pattern already encodes what
// discriminates a family's positives — leading literals, segment structure,
// per-segment length and alphabet class — so a `must-not-flag` fixture whose
// content satisfies that same pattern would force one pattern-based detector
// to both fire and stay silent on the same shape.
//
// Two fixtures are only in conflict when a single detector, at a single
// contract, would have to reconcile them: the positive's `kind` must be
// `must-redact` (never `policy` — a policy-layer finding is satisfied beneath
// the contract and never conflicts with it) at a scored tier, and the
// negative must declare that same `contract` (a twin scoped to family A says
// nothing about family B firing). Structural contracts (`private-key`, `jwt`)
// are verified by parsing, not a lexical pattern, and are out of scope here.
//
// A match only counts when it is isolated: not immediately continued by
// another identifier character on either side. The `*-identifier-embedding`
// controls (#64) glue a fully-formed, contracted token directly into a wider
// identifier with no delimiter — the same "confirmed-boundary-false-positive"
// shape the product scanner is deliberately boundary-gated against — so a
// pattern occurring only as a substring of a longer identifier is not a
// contradiction; that boundary is the control's whole point, not an
// unresolved collision.

export interface LexicalSeparabilityViolation {
  negativeId: string;
  contract: string;
  examplePositiveId?: string;
  reason: string;
}

const IDENTIFIER_CONTINUATION = '[A-Za-z0-9_-]';
const unanchored = (pattern: string) =>
  new RegExp(`(?<!${IDENTIFIER_CONTINUATION})(?:${pattern.replace(/^\^/, '').replace(/\$$/, '')})(?!${IDENTIFIER_CONTINUATION})`);
const collides = (f: Fixture, contract: FormatContract | undefined) =>
  Boolean(contract?.pattern) && !contract!.structural && unanchored(contract!.pattern!).test(f.content);

/** The scored `must-redact` families a `must-not-flag` fixture can actually conflict with. */
function scoredFamilies(fixtures: Fixture[]): Set<string> {
  const families = new Set<string>();
  for (const f of fixtures)
    if (f.assessment.kind === 'must-redact' && f.assessment.tier !== 'T0' && f.assessment.contract)
      families.add(f.assessment.contract);
  return families;
}

export function checkLexicalSeparability(fixtures: Fixture[], contracts: Record<string, FormatContract>): LexicalSeparabilityViolation[] {
  const families = scoredFamilies(fixtures);
  const violations: LexicalSeparabilityViolation[] = [];
  for (const f of fixtures) {
    if (f.assessment.kind !== 'must-not-flag' || !f.assessment.contract || f.assessment.lexicalExemption) continue;
    if (!families.has(f.assessment.contract)) continue;
    const contract = contracts[f.assessment.contract];
    if (!collides(f, contract)) continue;
    const example = fixtures.find(p => p.assessment.kind === 'must-redact' && p.assessment.tier !== 'T0' && p.assessment.contract === f.assessment.contract);
    violations.push({
      negativeId: f.id,
      contract: f.assessment.contract,
      examplePositiveId: example?.id,
      reason: `"${f.id}" satisfies the ${f.assessment.contract} contract's frozen pattern (${contract!.pattern}), the same shape a scored must-redact positive (e.g. "${example?.id ?? '<none found>'}") is measured against. Mutate it to fall outside the pattern, or record a lexicalExemption citing why this exact vocabulary is unavoidable.`,
    });
  }
  return violations;
}

/** No exemption without a citation, and none left recorded once it no longer applies. */
export function validateLexicalExemptions(fixtures: Fixture[], contracts: Record<string, FormatContract>) {
  for (const f of fixtures) {
    const exemption = f.assessment.lexicalExemption;
    if (!exemption) continue;
    if (f.assessment.kind !== 'must-not-flag') throw new Error(`Lexical exemption on a non-control fixture: ${f.id}`);
    if (!exemption.reason?.trim() || !exemption.citation?.trim()) throw new Error(`Lexical exemption without a reason or citation: ${f.id}`);
    if (!collides(f, contracts[f.assessment.contract ?? ''])) throw new Error(`Unused lexical exemption, fixture no longer collides: ${f.id}`);
  }
}
