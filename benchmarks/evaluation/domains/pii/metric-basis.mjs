// The measurement-to-product boundary of the ten PII metrics (#795). One definition per quantity, one owner, and a distinct name for
// quantities that share a metric id but not a meaning. This module states; it measures nothing and sets no threshold, tolerance,
// membership or verdict. The decision that picks which protocol defines a product value is docs/decisions/2026-10-07-propose-the-pii-scorer-basis-and-metric-semantics.md
// (status: proposed, owner decision pending), so both protocols are listed and neither is declared the product's.
//
// Two protocols use the same ten ids:
//   - `pii-v1`: the neutral accounting owned by pii-eval (revision 2). Populations are authored occurrences of a metric's own kind.
//   - `b11`: the benchmark's product scorer `b11ScoreTable`, owned by benchmarks. Populations are scored cases by authored sensitivity.
// A product consumer must name a quantity by `quantity` (protocol + id) and show `name`, never the bare metric id.

export const PII_PROTOCOLS = Object.freeze({
  'pii-v1': Object.freeze({ owner: 'pii-eval', contract: 'pii-v1 revision 2 (matching pii-v1-canonical, accounting pii-v1-canonical-accounting, statistics pii-v1-wilson-exact)' }),
  b11: Object.freeze({ owner: 'redact-secret-benchmarks', contract: 'benchmarks/evaluation/domains/pii/beta11-qualification.ts b11ScoreTable' }),
});

/** [population, numerator, denominator] per protocol and metric id; the pii-v1 strings are PII_METRIC_LABELS verbatim. */
const row = (name, population, numerator, denominator, extra = {}) => Object.freeze({ name, population, numerator, denominator, ...extra });

export const PII_V1_QUANTITIES = Object.freeze({
  'type-miss-rate': row('valid-type occurrence miss rate (generic, every context)', 'scanner-source × authored valid-type occurrence', 'type state is miss', 'resolved type assertions for authored valid types',
    { sensitiveOnly: false, note: 'counts a valid-type occurrence in a benign context that is correctly left unflagged; it is not a miss of sensitive data' }),
  'wrong-family-rate': row('valid-type occurrence wrong-family rate', 'scanner-source × authored valid-type occurrence', 'type state is wrong-family', 'resolved type assertions for authored valid types'),
  'wrong-jurisdiction-rate': row('jurisdictional valid-type occurrence wrong-jurisdiction rate', 'scanner-source × authored jurisdictional valid-type occurrence', 'type state is wrong-jurisdiction', 'resolved jurisdictional type assertions'),
  'sensitive-miss-rate': row('authored-sensitive occurrence miss rate', 'scanner-source × authored sensitive occurrence', 'sensitivity state is miss', 'resolved sensitivity assertions for authored sensitive occurrences', { sensitiveOnly: true }),
  'non-sensitive-flag-rate': row('authored-non-sensitive occurrence flag rate', 'scanner-source × authored non-sensitive occurrence', 'sensitivity state is false-positive', 'resolved sensitivity assertions for authored non-sensitive occurrences'),
  'context-discrimination-rate': row('complete context-trio discrimination rate', 'complete scanner-source × authored context trios', 'both sensitive and non-sensitive endpoints pass', 'resolved complete context trios', { method: 'context-discrimination' }),
  'benign-suppression-rate': row('authored benign case suppression rate', 'scanner-source × distinct authored benign case', 'non-sensitive assertion passes', 'resolved authored benign cases', { method: 'pii-benign' }),
  'jurisdiction-collision-rate': row('jurisdiction collision pass rate', 'scanner-source × authored jurisdiction collision case', 'target family and jurisdiction assertion passes', 'resolved collision type assertions', { method: 'jurisdiction-collision' }),
  'range-collateral-rate': row('reported-span collateral rate', 'scanner-source × reported span for authored valid type', 'range is overbroad or partial', 'exact, overbroad, or partial reported spans'),
  'measurable-share': row('resolved axis-assertion share', 'all scanner-source × authored axis assertions', 'resolved pass or fail assertions', 'all eligible authored axes including unresolved axes', { unit: 'axis assertion (two per membership)' }),
});

export const B11_QUANTITIES = Object.freeze({
  'type-miss-rate': row('sensitive case without any finding rate', 'scored sensitive cases of a family and view', 'sensitive case with no overlapping finding and no other-family PII at the target', 'scored sensitive cases', { sensitiveOnly: true }),
  'wrong-family-rate': row('sensitive case found as another family rate', 'scored sensitive cases of a family and view', 'sensitive case with no overlapping finding but other-family PII at the target', 'scored sensitive cases', { sensitiveOnly: true }),
  'wrong-jurisdiction-rate': row('sensitive case flagged under the foreign selection rate', 'scored sensitive cases (SSN lane with a foreign selection only)', 'finding under the foreign selectors', 'scored sensitive cases', { sensitiveOnly: true }),
  'sensitive-miss-rate': row('sensitive case not detected exactly rate', 'scored sensitive cases of a family and view', 'outcome is not detected (missed, range mismatch or action mismatch)', 'scored sensitive cases', { sensitiveOnly: true }),
  'non-sensitive-flag-rate': row('authored non-sensitive case flagged rate', 'scored non-sensitive cases', 'any finding', 'scored non-sensitive cases'),
  'context-discrimination-rate': row('twin-pair discrimination rate', 'scored twin pairs of opposite sensitivity inside the view', 'both twins correct', 'twin pairs'),
  'benign-suppression-rate': row('benign case suppression rate (not-established counted as benign)', 'scored cases that are not authored sensitive, including authored not-established', 'no finding', 'those cases', { coercesNotEstablished: true }),
  'jurisdiction-collision-rate': row('SSN case unflagged under the foreign selection rate', 'scored SSN cases (foreign selection only)', 'no finding under the foreign selectors', 'scored cases'),
  'range-collateral-rate': row('collateral finding rate', 'findings of the family over scored cases', 'findings that do not overlap the case target', 'findings of the family over scored cases'),
  'measurable-share': row('scored case share', 'cases of the view', 'cases the benchmark scores', 'cases of the view', { unit: 'case' }),
});

export const PII_QUANTITIES = Object.freeze({ 'pii-v1': PII_V1_QUANTITIES, b11: B11_QUANTITIES });

/** The product-facing name of a quantity: protocol and id are both in it, so a bare metric id is never a label. */
export const quantityId = (protocol, id) => `${protocol}:${id}`;
export function quantityOf(protocol, id) {
  const entry = PII_QUANTITIES[protocol]?.[id];
  if (!entry) throw new Error(`unknown PII quantity ${protocol}:${id}`);
  return { quantity: quantityId(protocol, id), protocol, id, owner: PII_PROTOCOLS[protocol].owner, ...entry };
}

/** Quantities that carry one metric id and differ in meaning between the two protocols (names differ, so a label cannot be mistaken). */
export function ambiguousIds() {
  return Object.keys(PII_V1_QUANTITIES).filter(id => JSON.stringify([PII_V1_QUANTITIES[id].population, PII_V1_QUANTITIES[id].numerator, PII_V1_QUANTITIES[id].denominator])
    !== JSON.stringify([B11_QUANTITIES[id].population, B11_QUANTITIES[id].numerator, B11_QUANTITIES[id].denominator]));
}
