import { beta8Corpus } from "./helpers.mjs";

// Issue #208 corpus (category `beta8-208`). See docs/specs/beta8-evidence.md.
export function build208({ fixture, synthetic }) {
  const c = beta8Corpus(208, { fixture, synthetic });
  return c.fixtures;
}
