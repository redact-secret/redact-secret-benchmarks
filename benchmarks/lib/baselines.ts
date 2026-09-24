/**
 * Which saved release baseline is "the" comparison point. The site's Workbench
 * (src/catalog.ts) and candidate evidence (benchmarks/candidate.ts) must agree,
 * or staging reads a candidate against an older release than production reads
 * its run against (#213: staging said "Since 0.1.0-beta.4" while beta.7 was
 * saved). Both take the newest `baselines/<version>.json` by this order.
 */
export const compareBaselineNames = (a: string, b: string): number => a.localeCompare(b, undefined, { numeric: true });

/** The newest baseline file name among `names` (file names or paths ending in `<version>.json`), or undefined when none is saved. */
export const newestBaselineName = (names: string[]): string | undefined =>
  names.filter(name => name.endsWith('.json')).sort(compareBaselineNames).at(-1);
