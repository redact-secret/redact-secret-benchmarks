/** Engine v1.1 accounting (docs/specs/evaluation-engine-v1.1.md). Floors live in qualification/suite-v1.json. */
export type Floor = number | ({ default: number } & Record<string, number>);
export interface AccountingConfig {
  version: '1.1'; minDenominator: number; resolvedRateFloor: Floor; measurableShareFloor: Floor; twinCoverageFloor: Floor;
  replays: number; intervalZ: number; intervalPrecision: number;
}
