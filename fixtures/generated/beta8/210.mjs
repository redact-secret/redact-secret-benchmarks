import { beta8Corpus } from "./helpers.mjs";

// Issue #210 corpus (category `beta8-210`). See docs/specs/beta8-evidence.md.
export function build210({ fixture, synthetic }) {
  const c = beta8Corpus(210, { fixture, synthetic });
  return c.fixtures;
}
