/**
 * What a page says about the state of the run behind its numbers: no run, an
 * unusable run, or a usable one with suites left out. Pure.
 *
 * A missing measurement is stated, with the command that produces it. It is
 * never drawn as zero.
 */
import type { RunLoad } from '../services/run';
import type { CredentialPipeline } from '../services/credential-source';
import type { PipelineStampProps } from '../components/qualification/types';
import { count } from './format';

/** Every state carries the stamp that names the pipeline behind the page, so no number is shown without it (#608). */
export type RunState =
  | { kind: 'measured'; notes: RunNote[]; pipeline: PipelineStampProps }
  | { kind: 'not-published'; title: string; text: string; command: string; pipeline: PipelineStampProps }
  | { kind: 'unusable'; title: string; text: string; command: string; pipeline: PipelineStampProps };

export interface RunNote { title: string; text: string }

const short = (digest: string): string => `${digest.slice(0, 19)}…`;

/**
 * The stamp for a page: which pipeline its numbers come from and whether that pipeline is the authority for credential
 * qualification. `builtFrom` is the pipeline the page was built from; it differs from the authority only for a page that stays on the
 * legacy files as the oracle (the comparison pages).
 */
export function resolvePipelineStamp(pipeline: CredentialPipeline, builtFrom: 'legacy' | 'new' = pipeline.authority): PipelineStampProps {
  const authorityFact = { term: 'Authority', value: pipeline.authority };
  const link = { label: 'Every population and its qualification', href: '/evaluation/qualification/' };
  if (builtFrom === 'legacy') {
    const oracle = pipeline.authority === 'new';
    return {
      pipeline: 'legacy', role: oracle ? 'oracle' : 'authority',
      title: oracle ? 'Built from the legacy pipeline, kept as the oracle' : 'Built from the legacy pipeline',
      text: oracle
        ? 'The new pipeline is the authority for credential qualification. This page reads the legacy pipeline’s run and fixture corpora, which are kept intact beside it for a bounded period.'
        : 'The legacy pipeline is the authority for credential qualification. These numbers are read from the committed fixture corpora and the run the benchmark wrote.',
      facts: [authorityFact, { term: 'Source', value: 'the committed fixture corpora and the benchmark run' }],
      link,
    };
  }
  const view = pipeline.view;
  if (!view || view.state !== 'ready') {
    return {
      pipeline: 'new', role: 'authority', title: 'Built from the new pipeline: its view is not available',
      text: `The new pipeline is the authority for credential qualification, but no usable qualification view backs this build, so no number is shown.`,
      facts: [authorityFact, { term: 'View', value: view?.state ?? 'not-built' }, ...(view?.release ? [{ term: 'Authorised for', value: view.release }] : [])],
      link,
    };
  }
  return {
    pipeline: 'new', role: 'authority', title: 'Built from the new pipeline',
    text: `The new pipeline is the authority for credential qualification. These numbers are read from the qualification view derived from the official credential-eval run of the ${view.population} population. The regression and policy populations keep their own counts on the qualification pages and are not added in here.`,
    facts: [
      authorityFact,
      { term: 'Population', value: view.population ?? '', code: true },
      { term: 'Engine', value: view.engine ?? '' },
      { term: 'Evidence', value: view.evidenceTag ?? '' },
      { term: 'Run', value: short(view.semanticDigest ?? ''), code: true },
      ...(view.recordedOn ? [{ term: 'Recorded', value: view.recordedOn }] : []),
      { term: 'Authorised for', value: view.release ?? '' },
    ],
    link,
  };
}

export function resolveRunState(run: RunLoad, pipeline: PipelineStampProps): RunState {
  if (run.state === 'not-published') {
    const viewBased = pipeline.pipeline === 'new';
    return viewBased
      ? { kind: 'not-published', pipeline, title: 'No qualification view for this build', text: `${run.reason} The taxonomy and the detector registry are here, but no scanner measurement is, so every count below is not measured.`, command: 'npm run qualification:view -- --artifacts <dir>' }
      : { kind: 'not-published', pipeline, title: 'No benchmark results for this checkout', text: `${run.reason} The corpus is here, but no scanner has run against it, so every count below is not measured.`, command: 'npm run bench' };
  }
  if (run.state === 'unusable') {
    return { kind: 'unusable', pipeline, title: 'The run summary did not validate', text: `${run.reason} Counts that come from it are not shown; fixture counts still are.`, command: 'npm run bench' };
  }
  const notes: RunNote[] = [];
  if (run.excludedSuites.length) {
    notes.push({
      title: `${count(run.excludedSuites.length, 'suite report')} left out`,
      text: `${run.excludedSuites.map(s => `${s.id}: ${s.problem}`).join('; ')}. A report that does not re-validate against the fixture bytes is never read; those fixtures show as not measured.`,
    });
  }
  if (run.staleSuites.length) {
    notes.push({ title: `${count(run.staleSuites.length, 'suite')} from an older run`, text: `${run.staleSuites.join(', ')} carry a different run id, so they are left out of every total.` });
  }
  const unavailable = run.scanners.filter(s => s.status !== 'complete');
  if (unavailable.length) {
    notes.push({ title: `${count(unavailable.length, 'scanner')} did not complete`, text: `${unavailable.map(s => `${s.name} (${s.status})`).join(', ')}. Its rows are not measured, not zero.` });
  }
  return { kind: 'measured', notes, pipeline };
}
