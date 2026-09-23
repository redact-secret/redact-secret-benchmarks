const SUITE_FILE = 'qualification/suite-v1.json';
const PRODUCT = 'redact-secret';

/**
 * One problem string per peer scanner whose resolved version is not the suite's
 * pin. Claim-producing runs (support classification, review-queue coverage) are
 * only valid against the pinned peers: peer version is part of a ledger id, so
 * an incidental patch bump re-keys the ledger (#180). The product scanner is
 * excluded; it is pinned and substituted through its own paths.
 */
export async function peerVersionProblems(scanners, suite, cwd) {
  const peers = scanners.filter(s => s.id !== PRODUCT && Object.hasOwn(suite.scanners, s.id));
  const problems = [];
  for (const scanner of peers) {
    const expected = suite.scanners[scanner.id];
    let observed;
    try {
      observed = await scanner.version(cwd);
    } catch (error) {
      observed = error instanceof Error && error.message === 'unavailable' ? 'unavailable' : 'unresolvable';
    }
    if (observed === expected) continue;
    const reason = observed === 'unavailable' ? 'is not installed or not on PATH'
      : observed === 'unresolvable' ? 'failed to report a version'
      : observed === 'unknown' ? 'reported a version that could not be parsed'
      : `is ${observed}`;
    problems.push(`Peer scanner ${scanner.id} ${reason}; ${SUITE_FILE} pins ${expected} (observed: ${observed}). `
      + `Install ${scanner.id} ${expected} in a read-only directory first on PATH (peers self-update) and rerun; `
      + 'exploratory `eval` runs may use other versions, but a classification or ledger-coverage claim may not.');
  }
  return problems;
}

/** Throws one error naming every mismatched peer; resolves when all peers match the suite pins. */
export async function assertPinnedPeers(scanners, suite, cwd) {
  const problems = await peerVersionProblems(scanners, suite, cwd);
  if (problems.length) throw new Error(problems.join('\n'));
}
