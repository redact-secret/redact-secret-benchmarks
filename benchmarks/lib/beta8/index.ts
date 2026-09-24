import type { ArrivalFamily, FixtureProfile, FormatContract } from '../../types.ts';
import * as i207 from './207.ts';
import * as i208 from './208.ts';
import * as i209 from './209.ts';
import * as i210 from './210.ts';
import * as i211 from './211.ts';
import * as i212 from './212.ts';
import * as i213c from './213c.ts';
import * as i213b from './213b.ts';
import * as i213d from './213d.ts';

/**
 * Beta.8 evidence modules, one per consumer issue (#207–#212) or #213 corpus key (213b, 213c, 213d). Each owns its
 * arrival families, their contracts and its profile declarations, so parallel
 * issue work never edits a shared table. See docs/specs/beta8-evidence.md.
 */
export const BETA8_MODULES = [i207, i208, i209, i210, i211, i212, i213c, i213b, i213d];
export const arrivalFamilies: ArrivalFamily[] = BETA8_MODULES.flatMap(m => m.arrivalFamilies);
export const arrivalIds = new Set(arrivalFamilies.map(f => f.id));
export const arrivalContracts: Record<string, FormatContract> = {};
for (const m of BETA8_MODULES)
  for (const [id, contract] of Object.entries(m.contracts)) {
    if (Object.hasOwn(arrivalContracts, id)) throw new Error(`Arrival contract declared twice: ${id}`);
    arrivalContracts[id] = contract;
  }
/** target → { issue, profile }. A target is declared by exactly one issue. */
export const beta8Profiles: Record<string, { issue: number | string; profile: FixtureProfile }> = {};
for (const m of BETA8_MODULES)
  for (const [target, profile] of Object.entries(m.profiles)) {
    if (Object.hasOwn(beta8Profiles, target)) throw new Error(`Beta.8 profile declared by two issues: ${target}`);
    beta8Profiles[target] = { issue: m.issue, profile };
  }

/** Structural checks that need the registry; the registry is passed in so this module stays import-cycle free. */
export function validateBeta8(registryIds: Iterable<string>, taxonomyIds: Iterable<string>): string[] {
  const registry = new Set(registryIds), taxonomy = new Set(taxonomyIds), problems: string[] = [];
  const seen = new Set<string>();
  for (const m of BETA8_MODULES)
    for (const f of m.arrivalFamilies) {
      if (!/^[a-z0-9-]+$/.test(f.id)) problems.push(`${f.id}: arrival id must be a case target ([a-z0-9-]+)`);
      if (seen.has(f.id)) problems.push(`${f.id}: arrival family declared twice`);
      seen.add(f.id);
      if (registry.has(f.id)) problems.push(`${f.id}: collides with a registry detector id; target the detector instead`);
      if (f.issue !== m.issue) problems.push(`${f.id}: declared in #${m.issue}'s module with issue #${f.issue}`);
      if (!taxonomy.has(f.taxonomy)) problems.push(`${f.id}: taxonomy family ${f.taxonomy} is not in benchmarks/support/taxonomy.json`);
      if (!f.reason?.trim()) problems.push(`${f.id}: no reason recorded for targeting no registry detector`);
      if (!Object.hasOwn(m.contracts, f.id)) problems.push(`${f.id}: arrival family without a contract in #${m.issue}'s module`);
    }
  for (const m of BETA8_MODULES) {
    for (const id of Object.keys(m.contracts))
      if (!m.arrivalFamilies.some(f => f.id === id)) problems.push(`${id}: contract in #${m.issue}'s module for an undeclared arrival family`);
    for (const target of Object.keys(m.profiles))
      if (!registry.has(target) && !arrivalIds.has(target)) problems.push(`${target}: #${m.issue} declares a profile for an unknown target`);
  }
  return problems;
}
