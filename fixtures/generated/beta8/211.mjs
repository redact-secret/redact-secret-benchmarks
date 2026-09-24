import { beta8Corpus } from "./helpers.mjs";

// Issue #211 corpus (category `beta8-211`). See docs/specs/beta8-evidence.md.
export function build211({ fixture, synthetic }) {
  const c = beta8Corpus(211, { fixture, synthetic });
  return c.fixtures;
}
