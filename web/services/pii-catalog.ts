import { loadPiiCoveragePage } from './pii-coverage';

/** A missing publication has no catalog. Invalid source commitments still fail closed. */
export async function loadPiiCatalogSource() {
  try { return await loadPiiCoveragePage(); }
  catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
}
