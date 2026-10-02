import snapshot from '../detector-finding-types.json';
import { arrivalFindingTypes } from '../../scanners/families.mjs';

/**
 * The finding-type key of a support-matrix row (#647). A matrix row is keyed by a detector id that is either a registered
 * product detector or an arrival family the adapter labels by finding type, so a shared detector with several finding types
 * cannot be joined to its rows by detector id alone. The key is the (detector, finding type) pairs the row's evidence
 * covers, derived only from data this repository already holds:
 *
 * - `benchmarks/detector-finding-types.json`: the product's finding types per registered detector, copied from the core's
 *   detector inventory at one recorded revision;
 * - `arrivalFindingTypes` (`scanners/families.mjs`, decision-map-product-finding-types-to-arrival-families): the reviewed
 *   (detector, finding type) pairs the adapter scores under an arrival family id of their own. Every other finding keeps its
 *   detector id, so the detector-id family covers the types the table does not take away.
 *
 * A key that none of these grounds is `null` ("unset"), never a guess. Scanner output and fixture content are not sources.
 */
export type FindingTypeBasis = 'sole-type-of-detector' | 'arrival-finding-type-table' | 'remaining-types-of-detector';
export interface FindingTypeKey { detector: string; type: string; basis: FindingTypeBasis }
export interface FindingTypeSource { repository: string; revision: string; path: string; sha256: string }

export const findingTypeSource: FindingTypeSource = snapshot.source;
const typesByDetector = snapshot.detectors as Record<string, string[]>;
const arrivalTable = arrivalFindingTypes as Record<string, Record<string, string>>;
const arrivalOwner = new Map<string, { detector: string; type: string }>();
for (const [detector, types] of Object.entries(arrivalTable)) for (const [type, family] of Object.entries(types)) arrivalOwner.set(family, { detector, type });

/**
 * The finding-type key of the row whose evidence is `detectors` (the matrix row's `detectors` array). Empty when the row has
 * no detector, so nothing is emitted for it; `null` when the row's detector is in neither source.
 */
export function findingTypesFor(detectors: readonly string[]): FindingTypeKey[] | null {
  if (detectors.length === 0) return [];
  if (detectors.length !== 1) return null;
  const id = detectors[0];
  const arrival = arrivalOwner.get(id);
  if (arrival) {
    if (!typesByDetector[arrival.detector]?.includes(arrival.type)) return null;
    return [{ detector: arrival.detector, type: arrival.type, basis: 'arrival-finding-type-table' }];
  }
  const types = typesByDetector[id];
  if (!types) return null;
  const taken = arrivalTable[id] ?? {};
  const kept = types.filter(type => !Object.hasOwn(taken, type));
  if (kept.length === 0) return null;
  const basis: FindingTypeBasis = types.length === 1 ? 'sole-type-of-detector' : 'remaining-types-of-detector';
  return kept.map(type => ({ detector: id, type, basis }));
}
