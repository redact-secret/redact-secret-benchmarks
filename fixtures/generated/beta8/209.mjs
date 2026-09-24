import { beta8Corpus } from "./helpers.mjs";

// Issue #209 corpus (category `beta8-209`). See docs/specs/beta8-evidence.md.
export function build209({ fixture, synthetic }) {
  const c = beta8Corpus(209, { fixture, synthetic });
  return c.fixtures;
}
