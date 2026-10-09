import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PiiCoverageMatrix, type PiiCoverageMatrixData } from './PiiCoverageMatrix';

const states = ['measured-supported', 'measured-missed', 'measured-partial', 'supported-unmeasured', 'measurement-unavailable', 'product-not-supported', 'evaluator-not-representable', 'evidence-deferred', 'not-applicable'];
export const syntheticCoverage: PiiCoverageMatrixData = {
  panels: [{ id: 'synthetic-active-baseline', title: 'Active snapshot · published baseline', snapshot: 'synthetic-snapshot',
    identity: 'Snapshot synthetic-snapshot; product synthetic-product; evaluator synthetic-evaluator; run synthetic-run.', note: 'Synthetic source kinds only. Every state remains visible.',
    summaries: [{ id: 'discovered', label: 'Discovered kinds (full evidence denominator)', value: String(states.length), rowIds: [] }],
    slices: ['PII and PHI slices can overlap.'],
    rows: states.map((state, i) => ({ id: `synthetic-kind-${i}`, kind: `synthetic:${i}`, label: `Synthetic kind ${i + 1}`, state,
      domain: 'PII · jurisdiction unknown', counts: 'Authored cases 1; imported cases unavailable; fixtures 1; variants unavailable; occurrences unavailable.',
      capability: state === 'product-not-supported' ? 'explicitly-absent (bound declaration)' : 'unknown (no bound declaration)',
      mapping: state === 'evaluator-not-representable' ? 'not-representable; context not carried' : 'required axes stated in bound mapping',
      observation: state === 'measured-missed' ? 'type-identity: eligible 2; measured 1; satisfied 0; missed 1; unresolved 1; withheld 0.' : 'Unavailable where no compatible observation is recorded.',
      reasons: 'Synthetic bounded reason. No support qualification is inferred.', sources: [{ label: 'Synthetic source', href: '#synthetic-active-baseline' }], })),
  }], delta: { title: 'Active vs proposed snapshot, inactive and unmeasured', identity: 'Synthetic previous → next source identity.',
    notes: ['Evidence denominator expansion is not a product regression.'], changes: [{ id: 'added', text: 'Added synthetic kind remains unknown and unmeasured.' }] },
};
const meta = { title: 'Evaluation/PiiCoverageMatrix', component: PiiCoverageMatrix, args: syntheticCoverage, parameters: { layout: 'fullscreen' } } satisfies Meta<typeof PiiCoverageMatrix>;
export default meta;
type Story = StoryObj<typeof meta>;
export const AllStates: Story = {};
export const Empty: Story = { args: { panels: [{ ...syntheticCoverage.panels[0], rows: [], summaries: [{ id: 'discovered', label: 'Discovered kinds', value: '0', rowIds: [] }] }], delta: null } };
export const Long: Story = { args: { panels: [{ ...syntheticCoverage.panels[0], identity: 'a'.repeat(256), rows: syntheticCoverage.panels[0].rows.map(row => ({ ...row, label: `${row.label} with long jurisdiction and applicability explanations`, reasons: 'b'.repeat(256) })) }] } };
export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
