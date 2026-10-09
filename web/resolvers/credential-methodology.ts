import type { DomainViewData } from '../components/evaluation/domain';
import type { CredentialMethodologyData } from '../components/evaluation/credential';

/** Preserve validated provenance while projecting away inventories and operational result explorers. */
export function resolveCredentialMethodology(data: DomainViewData): CredentialMethodologyData {
  const methods = [
    { term: 'twin', text: 'Pairs a credential with a structural negative control authored before scanner execution.' },
    { term: 'benign', text: 'Checks authored non-secret controls and accidental look-alikes.' },
    { term: 'mutation', text: 'Changes one authored structural property and records the response.' },
    { term: 'metamorphic', text: 'Applies a transformation with a declared expected relation between outcomes.' },
    { term: 'differential', text: 'Records disagreements between scanners; peers remain observations, not truth.' },
    { term: 'holdout', text: 'Uses a frozen, separate population; protected execution needs its own accepted evidence.' },
  ].map(method => data.method.methods.find(recorded => recorded.term === method.term) ?? method);
  return {
    head: { ...data.head, lede: 'How authored credential evidence becomes scanner observations, and how benchmarks applies its own qualification policy.' },
    method: { ...data.method, methods, metrics: { ...data.method.metrics, summary: 'Metric definitions and separate denominators' },
      recorded: { title: 'Qualification belongs to benchmarks', text: 'The evaluator records outcomes against authored answers. Benchmarks applies published evidence floors and interval thresholds to classify support; evidence class and product capability remain separate. A policy-qualified route requires its own accepted evidence and protected holdout, never an inferred approval from scanner observations.' } },
    reading: data.reading,
    limits: data.status.groups.flatMap(group => group.rows).filter(row => ['policy-qualified', 'validity', 'real-world', 'kept-apart'].includes(row.id))
      .map(row => ({ label: row.label, text: `${row.statusWord}. ${row.detail}`, ...(row.link ? { href: row.link.href } : {}) })),
  };
}
