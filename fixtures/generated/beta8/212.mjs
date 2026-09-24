import { beta8Corpus } from "./helpers.mjs";

// Issue #212 corpus (category `beta8-212`). See docs/specs/beta8-evidence.md.
export function build212({ fixture, synthetic }) {
  const c = beta8Corpus(212, { fixture, synthetic });
  return c.fixtures;
}
