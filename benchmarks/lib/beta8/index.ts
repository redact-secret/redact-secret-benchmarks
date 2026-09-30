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
import * as i213e from './213e.ts';
import * as i213f from './213f.ts';
import * as i259 from './259.ts';
import * as i263 from './263.ts';
import * as i384a from './384a.ts';
import * as i384b from './384b.ts';
import * as i384c from './384c.ts';
import * as i384d from './384d.ts';
import * as i384e from './384e.ts';
import * as i434a from './434a.ts';
import * as i434b from './434b.ts';
import * as i434c from './434c.ts';
import * as i434d from './434d.ts';
import * as i434e from './434e.ts';
import * as i434f from './434f.ts';
import * as i434g from './434g.ts';
import * as i436a from './436a.ts';
import * as i436b from './436b.ts';
import * as i436c from './436c.ts';
import * as i436d from './436d.ts';
import * as i436e from './436e.ts';
import * as i436f from './436f.ts';
import * as i464a from './464a.ts';
import * as i464b from './464b.ts';
import * as i464c from './464c.ts';
import * as i464d from './464d.ts';
import * as i464e from './464e.ts';
import * as i464f from './464f.ts';
import * as i528a from './528a.ts';
import * as i528b from './528b.ts';
import * as i528c from './528c.ts';
import * as i528d from './528d.ts';
import * as i528e from './528e.ts';
import * as i528f from './528f.ts';
import * as i528g from './528g.ts';
import * as i528h from './528h.ts';
import * as i528i from './528i.ts';
import * as i528j from './528j.ts';
import * as i1012a from './1012a.ts';
import * as i1012b from './1012b.ts';
import * as i1012c from './1012c.ts';
import * as i1012d from './1012d.ts';
import * as i1012e from './1012e.ts';

/**
 * Beta.8 evidence modules, one per consumer issue (#207–#212, #259, #263), #213 corpus key (213b, 213c, 213d, 213e, 213f) Beta.10 #384 corpus key (384a–384e) Beta.11 #434 corpus key (434a–434g), Beta.11 #436 corpus key (436a–436f) Beta.12 #464 corpus key (464a–464f) Beta.12 #528 corpus key (528a–528j) or Beta.12 #1012 corpus key (1012a–1012e). Each owns its
 * arrival families, their contracts and its profile declarations, so parallel
 * issue work never edits a shared table. See docs/specs/beta8-evidence.md.
 */
export const BETA8_MODULES = [i207, i208, i209, i210, i211, i212, i213c, i213b, i213d, i213e, i213f, i259, i263, i384a, i384b, i384c, i384d, i384e, i434a, i434b, i434c, i434d, i434e, i434f, i434g, i436a, i436b, i436c, i436d, i436e, i436f, i464a, i464b, i464c, i464d, i464e, i464f, i528a, i528b, i528c, i528d, i528e, i528f, i528g, i528h, i528i, i528j, i1012a, i1012b, i1012c, i1012d, i1012e];
export const arrivalFamilies: ArrivalFamily[] = BETA8_MODULES.flatMap(m => m.arrivalFamilies);
export const arrivalIds = new Set(arrivalFamilies.map(f => f.id));
export const arrivalContracts: Record<string, FormatContract> = {};
for (const m of BETA8_MODULES)
  for (const [id, contract] of Object.entries(m.contracts)) {
    if (Object.hasOwn(arrivalContracts, id)) throw new Error(`Arrival contract declared twice: ${id}`);
    arrivalContracts[id] = contract;
  }
/**
 * Contracts a module authored for families that have since graduated to registry detectors
 * (`registryContracts`, optional per module). Keys are benchmarks/detectors.json ids;
 * benchmarks/lib/assessment.ts merges them into the registry contracts, so the contract is
 * never duplicated when a product detector lands for an arrival family.
 */
export const graduatedContracts: Record<string, FormatContract> = {};
for (const m of BETA8_MODULES)
  for (const [id, contract] of Object.entries((m as { registryContracts?: Record<string, FormatContract> }).registryContracts ?? {})) {
    if (Object.hasOwn(graduatedContracts, id) || Object.hasOwn(arrivalContracts, id)) throw new Error(`Graduated contract declared twice: ${id}`);
    graduatedContracts[id] = contract;
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
  for (const id of Object.keys(graduatedContracts))
    if (!registry.has(id)) problems.push(`${id}: graduated contract for an id that is not a registry detector`);
  for (const m of BETA8_MODULES) {
    for (const id of Object.keys(m.contracts))
      if (!m.arrivalFamilies.some(f => f.id === id)) problems.push(`${id}: contract in #${m.issue}'s module for an undeclared arrival family`);
    for (const target of Object.keys(m.profiles))
      if (!registry.has(target) && !arrivalIds.has(target)) problems.push(`${target}: #${m.issue} declares a profile for an unknown target`);
  }
  return problems;
}
