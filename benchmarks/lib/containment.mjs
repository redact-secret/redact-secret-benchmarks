/** Range containment is a detection observation, not a redaction accuracy rate. */
export function containment(expected, actual) {
  return {
    contained: expected.filter(e => actual.some(a => a.start <= e.start && a.end >= e.end)).length,
    broader: expected.filter(e => !actual.some(a => a.start === e.start && a.end === e.end) &&
      actual.some(a => a.start <= e.start && a.end >= e.end)).length,
  };
}
