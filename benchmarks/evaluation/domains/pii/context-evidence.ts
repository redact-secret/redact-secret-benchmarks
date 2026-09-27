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
export interface PiiContextFixture {
  id: string; language: string; template: string; rules: string[];
  candidates: { id: string; domain: PiiIdentityDomain; identityEstablished: boolean }[];
  expectedAssociations: { candidate: string; matches: string[]; effect: PiiContextFrame['effect'] | 'no-evidence' }[];
}
export interface PiiContextEvidence {
  schemaVersion: 1;
  id: 'pii-context-v1';
  version: 1;
  upstream: { repository: 'redact-secret/redact-secret'; revision: string; contract: 'redact-secret/pii-context/v1'; contractSha256: string; schemaSha256: string };
  contentCommitment: string;
  evidenceGroup: 'contextual';
  languages: string[];
  normalization: { unicode: 'NFC'; removeGovernedInvisible: true; englishCase: 'ascii-lower'; koreanCase: 'none'; tokenSeparators: string[] };
  association: { unit: 'normalized-unicode-scalar'; sameLogicalLine: true; maxDistance: 64; stopAtAnotherCandidate: true; equidistant: 'unassociated';
    fieldLabel: { direction: 'before'; maxDistance: 16; gap: 'separators-and-quotes-only' }; naturalLanguageLabel: { direction: 'either'; maxDistance: 64 } };
  precedence: ['longest-token-span', 'high-signal-first', 'negative-positive-neutral', 'entry-id-bytewise'];
  entries: { id: string; language: string; kind: 'field-label' | 'natural-language-label'; class: 'positive' | 'neutral' | 'negative';
    strength: 'high-signal' | 'ambiguous'; identityDomains: PiiIdentityDomain[]; forms: string[]; provenance: string }[];
  fixtures: PiiContextFixture[];
  groups: PiiContextGroup[];
}

const validateSchema = new Ajv({ strict: true }).compile(schema);
const canonicalLanguages = ['en', 'ko'];
const upstreamIdentity = {
  revision: '230439ec8f208afadba6afba82d1b183e7800a15',
  contractSha256: '9955ad686ce9def6433ce224fb65a4a391404ea902cbca430d71c018a52e23f2',
  schemaSha256: 'bdfbea4cf6d65ce233dcd7dfda9274434d6a4144643abf74f64c9bed98d3d090',
};
const canonicalContentCommitment = 'e6c2eca2a0853331dc12266952280ac5cfa9d7ede6fe195e13309ed495ed5363';
const requiredFeatures = {
  en: ['ascii-case', 'whitespace', 'underscore', 'hyphen', 'colon', 'equals', 'ambiguous', 'benign-prose'],
  ko: ['hangul', 'mixed-ascii-hangul', 'whitespace', 'underscore', 'hyphen', 'colon', 'equals', 'nfc', 'nfd', 'governed-invisible', 'ambiguous', 'benign-prose'],
};

export function piiContextSemanticProjection(corpus: PiiContextEvidence) {
  const { evidenceGroup, normalization, association, precedence, languages, entries, fixtures, groups } = corpus;
  return { evidenceGroup, normalization, association, precedence, languages, entries, fixtures, groups };
}
const canonicalize = (value: unknown): unknown => Array.isArray(value) ? value.map(canonicalize) : value && typeof value === 'object' ?
  Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonicalize(child)])) : value;
export const piiContextContentCommitment = (corpus: PiiContextEvidence) => hash(JSON.stringify(canonicalize(piiContextSemanticProjection(corpus))));

const governedInvisible = /[\u200b\ufe0f]/gu;
const separators = /[\s_\-:=]+/gu;
const marker = /\{\{candidate:([a-z][a-z0-9-]*)\}\}/g;
function normalize(value: string, language: string) {
  const visible = value.replace(governedInvisible, '').normalize('NFC');
  const cased = language === 'en' ? visible.replace(/[A-Z]/g, character => character.toLowerCase()) : visible;
  return cased.replace(separators, ' ').trim();
}
function evaluateFixture(corpus: PiiContextEvidence, fixture: PiiContextFixture) {
  const candidateIds = fixture.candidates.map(candidate => candidate.id), markers = [...fixture.template.matchAll(marker)].map(match => match[1]);
  if (JSON.stringify([...markers].sort()) !== JSON.stringify([...candidateIds].sort()) || new Set(markers).size !== markers.length)
    throw new Error('PII context fixture markers must name every candidate exactly once');
  const markerCharacters = new Map(candidateIds.map((id, index) => [id, String.fromCodePoint(0xe100 + index)]));
  const reverseMarkers = new Map([...markerCharacters].map(([id, character]) => [character, id]));
  const marked = fixture.template.replace(marker, (_match, id: string) => markerCharacters.get(id)!);
  const matches = new Map(candidateIds.map(id => [id, new Set<string>()]));
  const candidates = new Map(fixture.candidates.map(candidate => [candidate.id, candidate]));
  for (const rawLine of marked.split(/\r?\n/u)) {
    const normalized = normalize(rawLine, fixture.language), positions = new Map<string, number>(), clean: string[] = [];
    for (const character of normalized) { const id = reverseMarkers.get(character); if (id) positions.set(id, clean.length); else clean.push(character); }
    const view = clean, domains = new Set([...positions].map(([id]) => candidates.get(id)!.domain));
    const occurrences: { start: number; end: number; entry: PiiContextEvidence['entries'][number] }[] = [];
    for (const entry of corpus.entries.filter(entry => entry.language === fixture.language && entry.identityDomains.some(domain => domains.has(domain)))) {
      for (const form of entry.forms) {
        const term = [...normalize(form, fixture.language)];
        for (let start = 0; start <= view.length - term.length; start++) {
          if (!term.every((character, offset) => view[start + offset] === character)) continue;
          const end = start + term.length, before = view[start - 1], after = view[end];
          const boundary = entry.kind === 'field-label' ? (character: string | undefined) => character === undefined || /[\s"']/u.test(character) :
            (character: string | undefined) => character === undefined || /\s/u.test(character);
          if (boundary(before) && boundary(after)) occurrences.push({ start, end, entry });
        }
      }
    }
    const strength = { 'high-signal': 0, ambiguous: 1 }, semantic = { negative: 0, positive: 1, neutral: 2 };
    occurrences.sort((a, b) => (b.end - b.start) - (a.end - a.start) || strength[a.entry.strength] - strength[b.entry.strength] ||
      semantic[a.entry.class] - semantic[b.entry.class] || Buffer.from(a.entry.id).compare(Buffer.from(b.entry.id)));
    const selected = occurrences.filter((occurrence, index, all) => !all.slice(0, index).some(kept => occurrence.start < kept.end && kept.start < occurrence.end));
    for (const occurrence of selected) {
      const distance = (position: number) => position <= occurrence.start ? occurrence.start - position : position >= occurrence.end ? position - occurrence.end : 0;
      const eligible: [number, string][] = [];
      for (const [id, position] of positions) {
        const candidate = candidates.get(id)!;
        if (!occurrence.entry.identityDomains.includes(candidate.domain)) continue;
        if (occurrence.entry.kind === 'field-label') {
          if (position < occurrence.end || view.slice(occurrence.end, position).some(character => !/[ "']/u.test(character))) continue;
        }
        const separation = distance(position), limit = occurrence.entry.kind === 'field-label' ? corpus.association.fieldLabel.maxDistance : corpus.association.naturalLanguageLabel.maxDistance;
        if (separation > limit || [...positions].some(([otherId, otherPosition]) => otherId !== id && distance(otherPosition) < separation)) continue;
        eligible.push([separation, id]);
      }
      if (eligible.length) { const nearest = Math.min(...eligible.map(([distance]) => distance)), winners = eligible.filter(([distance]) => distance === nearest);
        if (winners.length === 1) matches.get(winners[0][1])!.add(occurrence.entry.id); }
    }
  }
  const entries = new Map(corpus.entries.map(entry => [entry.id, entry]));
  return fixture.candidates.map(candidate => {
    const ids = [...matches.get(candidate.id)!].sort(), classes = new Set(ids.map(id => entries.get(id)!.class));
    const effect = !candidate.identityEstablished ? 'not-established-without-identity' : ids.length === 0 ? 'no-evidence' :
      classes.has('negative') ? 'negative-evidence' : classes.has('positive') ? 'positive-evidence' : 'neutral-evidence';
    return { candidate: candidate.id, matches: ids, effect };
  });
}

export function validatePiiContextEvidence(value: unknown, options: { canonical?: boolean } = {}): PiiContextEvidence {
  if (!validateSchema(value)) throw new Error('Invalid PII context evidence schema');
  const corpus = structuredClone(value as unknown as PiiContextEvidence);
  if (piiContextContentCommitment(corpus) !== corpus.contentCommitment) throw new Error('PII context semantic commitment mismatch');
  if (JSON.stringify(corpus.precedence) !== JSON.stringify(['longest-token-span', 'high-signal-first', 'negative-positive-neutral', 'entry-id-bytewise']))
    throw new Error('PII context precedence mismatch');
  if (new Set(corpus.languages).size !== corpus.languages.length || corpus.entries.some(entry => !corpus.languages.includes(entry.language)) ||
      corpus.groups.some(group => !corpus.languages.includes(group.language))) throw new Error('PII context evidence has an unregistered language');
  if (options.canonical !== false && (JSON.stringify(corpus.languages) !== JSON.stringify(canonicalLanguages) ||
      corpus.contentCommitment !== canonicalContentCommitment || Object.entries(upstreamIdentity).some(([key, expected]) => corpus.upstream[key as keyof typeof corpus.upstream] !== expected)))
    throw new Error('Canonical PII context identity or commitment mismatch');
  const entries = new Map(corpus.entries.map(entry => [entry.id, entry]));
  if (entries.size !== corpus.entries.length || new Set(corpus.groups.map(group => group.id)).size !== corpus.groups.length)
    throw new Error('Duplicate PII context evidence identity');
  for (const entry of corpus.entries) {
    if (entry.forms.some(form => form.normalize('NFC') !== form)) throw new Error('PII context vocabulary forms must be NFC');
    const normalized = entry.forms.map(form => entry.language === 'en' ? form.toLowerCase() : form);
    if (new Set(normalized).size !== normalized.length) throw new Error('Duplicate normalized PII context form');
  }
  if (new Set(corpus.fixtures.map(fixture => fixture.id)).size !== corpus.fixtures.length) throw new Error('Duplicate PII context fixture identity');
  for (const fixture of corpus.fixtures) {
    if (!corpus.languages.includes(fixture.language) || JSON.stringify(evaluateFixture(corpus, fixture)) !== JSON.stringify(fixture.expectedAssociations))
      throw new Error(`PII context fixture expectation mismatch: ${fixture.id}`);
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
      const identityEstablished = frame.effect !== 'not-established-without-identity';
      const actual = evaluateFixture(corpus, { id: frame.id, language: group.language, template: frame.template.replace('{{candidate}}', '{{candidate:a}}'), rules: [],
        candidates: [{ id: 'a', domain: group.identityDomain, identityEstablished }],
        expectedAssociations: [{ candidate: 'a', matches: [frame.entry], effect: frame.effect }] });
      if (JSON.stringify(actual) !== JSON.stringify([{ candidate: 'a', matches: [frame.entry], effect: frame.effect }]))
        throw new Error('PII context frame association mismatch');
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
