import { piiCoveragePublication } from '../../scripts/pii-coverage-publication.mjs';
import { once, REPO_ROOT } from './repo';

export function loadPiiCoveragePage() {
  return once('pii-full-coverage', () => piiCoveragePublication(REPO_ROOT));
}
