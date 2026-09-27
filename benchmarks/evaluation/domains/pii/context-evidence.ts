import Ajv from 'ajv';
import schema from '../../../../schemas/pii-context-evidence-v1.json';
import data from './context-evidence-v1.json';
import { hash } from '../../substrate/hash.ts';
import type { PiiCase, PiiContract, PiiIdentityDomain, PiiSensitivityExpectation } from './types.ts';

export type PiiContextClass = 'sensitive' | 'neutral' | 'non-sensitive';
export interface PiiContextFrame {
  id: string;
  entry: string;
  template: string;
  contextClass: PiiContextClass;
  sensitivity: PiiSensitivityExpectation;
  effect: 'positive-evidence' | 'neutral-evidence' | 'negative-evidence' | 'not-established-without-identity';
  features: string[];
}
export interface PiiContextGroup { id: string; language: string; identityDomain: PiiIdentityDomain; frames: PiiContextFrame[] }
export interface PiiContextEvidence {
  schemaVersion: 1;
  id: 'pii-context-v1';
  version: 1;
  upstream: { repository: 'redact-secret/redact-secret'; revision: string; contract: 'redact-secret/pii-context/v1' };
  evidenceGroup: 'contextual';
  languages: string[];
  normalization: { unicode: 'NFC'; removeGovernedInvisible: true; englishCase: 'ascii-lower'; koreanCase: 'none'; tokenSeparators: string[] };
  entries: { id: string; language: string; kind: 'field-label' | 'natural-language-label'; class: 'positive' | 'neutral' | 'negative';
    strength: 'high-signal' | 'ambiguous'; identityDomains: PiiIdentityDomain[]; forms: string[]; provenance: string }[];
  groups: PiiContextGroup[];
}

const validateSchema = new Ajv({ strict: true }).compile(schema);
const canonicalLanguages = ['en', 'ko'];
const requiredFeatures = {
  en: ['ascii-case', 'whitespace', 'underscore', 'hyphen', 'colon', 'equals', 'ambiguous', 'benign-prose'],
  ko: ['hangul', 'mixed-ascii-hangul', 'whitespace', 'underscore', 'hyphen', 'colon', 'equals', 'nfc', 'nfd', 'governed-invisible', 'ambiguous', 'benign-prose'],
};

export function validatePiiContextEvidence(value: unknown, options: { canonical?: boolean } = {}): PiiContextEvidence {
  if (!validateSchema(value)) throw new Error('Invalid PII context evidence schema');
  const corpus = structuredClone(value as unknown as PiiContextEvidence);
  if (new Set(corpus.languages).size !== corpus.languages.length || corpus.entries.some(entry => !corpus.languages.includes(entry.language)) ||
      corpus.groups.some(group => !corpus.languages.includes(group.language))) throw new Error('PII context evidence has an unregistered language');
  if (options.canonical !== false && JSON.stringify(corpus.languages) !== JSON.stringify(canonicalLanguages))
    throw new Error('Canonical PII context languages must be English and Korean');
  const entries = new Map(corpus.entries.map(entry => [entry.id, entry]));
  if (entries.size !== corpus.entries.length || new Set(corpus.groups.map(group => group.id)).size !== corpus.groups.length)
    throw new Error('Duplicate PII context evidence identity');
  for (const entry of corpus.entries) {
    if (entry.forms.some(form => form.normalize('NFC') !== form)) throw new Error('PII context vocabulary forms must be NFC');
    const normalized = entry.forms.map(form => entry.language === 'en' ? form.toLowerCase() : form);
    if (new Set(normalized).size !== normalized.length) throw new Error('Duplicate normalized PII context form');
  }
  for (const group of corpus.groups) {
    const frameIds = new Set<string>(), classes = new Set<PiiContextClass>();
    for (const frame of group.frames) {
      if (frameIds.has(frame.id) || frame.template.split('{{candidate}}').length !== 2 || /(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\b\d{3}-\d{2}-\d{4}\b)/i.test(frame.template))
        throw new Error('Invalid or unsafe PII context frame');
      frameIds.add(frame.id); classes.add(frame.contextClass);
      const entry = entries.get(frame.entry);
      if (!entry || entry.language !== group.language || !entry.identityDomains.includes(group.identityDomain)) throw new Error('PII context frame entry mismatch');
      const normalizedContext = frame.template.replace('{{candidate}}', '').replace(/[\u200b\ufe0f]/gu, '').normalize('NFC');
      const comparableContext = group.language === 'en' ? normalizedContext.toLowerCase() : normalizedContext;
      if (!entry.forms.some(form => comparableContext.includes(group.language === 'en' ? form.toLowerCase() : form)))
        throw new Error('PII context frame does not contain its attributed vocabulary entry');
      if ((frame.contextClass === 'sensitive') !== (frame.sensitivity === 'sensitive') ||
          (frame.contextClass === 'non-sensitive') !== (frame.sensitivity === 'non-sensitive') ||
          (frame.contextClass === 'neutral') !== (frame.sensitivity === 'not-established')) throw new Error('PII context frame expectation mismatch');
      if (entry.strength === 'ambiguous' && frame.sensitivity === 'sensitive') throw new Error('Ambiguous context cannot establish sensitivity');
    }
    if (classes.size !== 3) throw new Error('PII context group must cover positive, neutral and negative outcomes');
  }
  if (options.canonical !== false) for (const [language, features] of Object.entries(requiredFeatures)) {
    const observed = new Set(corpus.groups.filter(group => group.language === language).flatMap(group => group.frames.flatMap(frame => frame.features)));
    if (features.some(feature => !observed.has(feature))) throw new Error(`Canonical ${language} context evidence is incomplete`);
  }
  return corpus;
}

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) deepFreeze(child); Object.freeze(value); }
  return value;
};
export const piiContextEvidence = deepFreeze(validatePiiContextEvidence(data));

export function piiContextGroup(id: string): PiiContextGroup {
  const group = piiContextEvidence.groups.find(candidate => candidate.id === id);
  if (!group) throw new Error('Unknown PII context evidence group');
  return structuredClone(group);
}

const authority = [{ sourceKind: 'standard' as const, sourceId: 'redact-secret-pii-context-v1', locator: 'section:pii-context-v1', revision: '1',
  supports: ['lexical' as const, 'sensitivity' as const, 'reserved-control' as const] }];
const candidate = 'subject@example.invalid';
export function loadPiiContextCases(): PiiCase[] {
  return piiContextEvidence.groups.map(group => {
    const prefix = 'value=';
    const input = { id: group.id, path: `pii/context/${group.id}.txt`, content: `${prefix}${candidate}` };
    const contract: PiiContract = {
      category: 'pii', family: 'pii:global:email', displayName: 'Email address', identityDomain: 'email', scope: 'global',
      typeExpectation: { state: 'valid', validator: null }, sensitivityExpectation: 'not-established',
      context: { obligation: 'required-for-sensitive-classification', class: 'neutral', language: group.language }, authority,
      referenceEvidence: null, qualificationProfile: { id: 'pii-v1', version: 1 },
    };
    return {
      id: group.id, method: 'context-discrimination', visibility: 'development', input,
      candidate: { start: Buffer.byteLength(prefix), end: Buffer.byteLength(prefix + candidate) }, contract,
      provenance: { source: 'benchmarks/evaluation/domains/pii/context-evidence-v1.json', sourceHash: hash({ corpus: piiContextEvidence, group: group.id }),
        seed: `${group.id}/1`, rationale: 'Reserved-domain context evidence; it does not represent a real person.',
        sources: [`${piiContextEvidence.upstream.repository}@${piiContextEvidence.upstream.revision}:${piiContextEvidence.upstream.contract}`] },
      metadata: { contextEvidenceGroup: group.id },
    };
  });
}
