import type { Finding } from '../types.ts';

const cache = new WeakMap<readonly Finding[], Map<string, Finding[]>>();

/**
 * A scanner's findings grouped by path, original order kept within each path. Observation
 * finding lists are immutable once recorded, so one grouping serves every variant that reads them;
 * this replaces a `findings.filter(f => f.path === path)` per variant.
 */
export function findingsForPath(findings: readonly Finding[], path: string): Finding[] {
  let groups = cache.get(findings);
  if (!groups) {
    groups = new Map();
    for (const finding of findings) {
      const group = groups.get(finding.path);
      if (group) group.push(finding); else groups.set(finding.path, [finding]);
    }
    cache.set(findings, groups);
  }
  return groups.get(path) ?? [];
}
