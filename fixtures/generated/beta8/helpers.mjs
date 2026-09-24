import { arrivalIds } from "../../../benchmarks/lib/beta8/index.ts";
import { POSITIVE_AXES } from "../../../benchmarks/lib/beta8/profiles.ts";

/**
 * Authoring helpers for one Beta.8 issue corpus (`beta8-<issue>`, #207–#212).
 * Conventions (docs/specs/beta8-evidence.md):
 *   - every fixture id starts with its target, so ids never collide across targets;
 *   - a positive names its positive-context axis (`contextAxis`, POSITIVE_AXES);
 *   - a control's id ends in its control-axis suffix (CONTROL_SUFFIXES), which is
 *     how benchmarks/lib/assessment.ts classifies it;
 *   - a twin ends in `-twin`, points at its positive and records one mutation.
 * A registry detector target lands in `detectors`; an arrival family (no product
 * detector) lands in `arrivalTargets` and is assigned [] in fixture-detectors.json.
 * Values come from `synthetic` seeds or independent construction, never from a
 * provider-issued or scanner-reported credential.
 */
export const CONTROL_SUFFIXES = ["near-miss", "public-id", "encoded-value", "reference", "placeholder", "prose"];

export function beta8Corpus(issue, { fixture }) {
  const fixtures = [];
  const byId = new Map();
  const targetFields = target => arrivalIds.has(target) ? { arrivalTargets: [target] } : { detectors: [target] };
  const push = f => {
    if (byId.has(f.id)) throw new Error(`beta8-${issue}: duplicate fixture id ${f.id}`);
    byId.set(f.id, f);
    fixtures.push(f);
    return f;
  };
  const group = (target, label) => `#${issue} · ${target} · ${label}`;
  return {
    fixtures,
    /** A positive: `parts` carries at least one `{ secret }` span. */
    positive(target, axis, slug, parts, extension = "txt") {
      if (!POSITIVE_AXES.includes(axis)) throw new Error(`beta8-${issue}: unknown positive axis ${axis} (${slug})`);
      return push({ ...fixture(`${target}-${slug}`, group(target, axis), parts, extension), ...targetFields(target), contextAxis: axis });
    },
    /** An independent benign control; `axis` is one of CONTROL_SUFFIXES and ends the id. */
    control(target, axis, slug, parts, extension = "txt") {
      if (!CONTROL_SUFFIXES.includes(axis)) throw new Error(`beta8-${issue}: unknown control axis ${axis} (${slug})`);
      return push({ ...fixture(`${target}-${slug}-${axis}`, group(target, `control · ${axis}`), parts, extension), ...targetFields(target) });
    },
    /** A negative twin of `positiveSlug` differing by exactly one documented property. */
    twin(target, positiveSlug, slug, parts, mutation, mutationKind, extension = "txt") {
      const positive = byId.get(`${target}-${positiveSlug}`);
      if (!positive) throw new Error(`beta8-${issue}: twin ${slug} names no authored positive ${positiveSlug}`);
      return push({
        ...fixture(`${target}-${slug}-twin`, group(target, `twin · ${mutationKind}`), parts, extension),
        ...targetFields(target), contextAxis: positive.contextAxis,
        twinOf: positive.id, mutation, mutationKind,
      });
    },
  };
}
