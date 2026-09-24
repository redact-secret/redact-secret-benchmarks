import { beta8Corpus } from "./helpers.mjs";

// Issue #207 corpus (category `beta8-207`). See docs/specs/beta8-evidence.md.
export function build207({ fixture, synthetic }) {
  const c = beta8Corpus(207, { fixture, synthetic });
  return c.fixtures;
}
