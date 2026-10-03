import { createHash, createPublicKey, verify } from 'node:crypto';
import { parseStrictJson } from './pii-eval-artifact-consumer.mjs';

export const MAX_DOCUMENT_BYTES = 65_536;
export const MAX_REQUEST_BYTES = 4_096;
export const MAX_MANIFEST_BYTES = 8_192;
export const PROJECTION_DOMAIN = 'private-custodian/v2/public-projection';
export const REVOCATION_DOMAIN = 'private-custodian/v1/revocation-envelope';
export const BRIDGE_DOMAIN = 'private-custodian/v1/bridge';
const HEX = /^[0-9a-f]{64}$/;
const SHA = /^sha256:[0-9a-f]{64}$/;

export class CustodianRejection extends Error {
  constructor(code) { super(code); this.code = code; }
}

const reject = code => { throw new CustodianRejection(code); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => object(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const integer = value => Number.isSafeInteger(value) && value >= 0;
const same = (a, b) => canonicalize(a) === canonicalize(b);

function canonicalString(value) {
  if (![...value].every(char => { const code = char.charCodeAt(0); return code >= 0x20 && code <= 0x7e && char !== '"' && char !== '\\'; })) reject('malformed');
  return `"${value}"`;
}

export function canonicalize(value) {
  if (typeof value === 'string') return canonicalString(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number' && integer(value)) return String(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (object(value)) return `{${Object.keys(value).sort().map(key => `${canonicalString(key)}:${canonicalize(value[key])}`).join(',')}}`;
  reject('malformed');
}

export function decodeCanonical(text, maximum = MAX_DOCUMENT_BYTES) {
  if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > maximum) reject('malformed');
  let value;
  try { value = parseStrictJson(text); } catch { reject('malformed'); }
  if (canonicalize(value) !== text) reject('malformed');
  return value;
}

const domainInput = (domain, payload) => Buffer.concat([Buffer.from(domain, 'ascii'), Buffer.from([0]), Buffer.from(canonicalize(payload), 'ascii')]);
const domainDigest = (domain, payload) => `sha256:${createHash('sha256').update(domainInput(domain, payload)).digest('hex')}`;
export const requestDigest = request => domainDigest(BRIDGE_DOMAIN, request);
export const projectionDigest = payload => domainDigest(PROJECTION_DOMAIN, payload);
export const revocationDigest = payload => domainDigest(REVOCATION_DOMAIN, payload);

function population(value) {
  return exact(value, ['kind', 'id']) && value.kind === 'opaque' && /^ppr_[a-z0-9]{16,64}$/.test(value.id) ||
    exact(value, ['kind', 'key_id', 'commitment']) && value.kind === 'keyed' && /^key_[a-z0-9]{16,64}$/.test(value.key_id) && /^hmac-sha256:[0-9a-f]{64}$/.test(value.commitment);
}

function policy(value, domain) {
  return exact(value, ['domain', 'kind', 'name', 'version']) && value.domain === domain && value.kind === 'disclosure' &&
    /^[a-z][a-z0-9-]{1,63}$/.test(value.name) && integer(value.version) && value.version > 0;
}

function validateRequest(value) {
  if (!exact(value, ['schema', 'domain', 'candidate', 'config', 'feed_id', 'known_sequence', 'populations']) ||
      value.schema !== 'private-custodian.bridge-request/1' || !['credential', 'pii'].includes(value.domain) || !SHA.test(value.candidate) ||
      !SHA.test(value.config) || !/^fed_[a-z0-9]{16,64}$/.test(value.feed_id) || !integer(value.known_sequence) ||
      !Array.isArray(value.populations) || value.populations.length > 8 || value.populations.some(row => !population(row)) ||
      new Set(value.populations.map(canonicalize)).size !== value.populations.length) reject('malformed');
  return value;
}

function validateManifest(value) {
  if (!exact(value, ['schema', 'request_digest', 'feed_id', 'destination', 'projections', 'first_sequence', 'last_sequence']) ||
      value.schema !== 'private-custodian.bridge-response/1' || !SHA.test(value.request_digest) ||
      !/^fed_[a-z0-9]{16,64}$/.test(value.feed_id) || !/^[a-z][a-z0-9-]{1,63}$/.test(value.destination) ||
      !Array.isArray(value.projections) || value.projections.length > 16 || value.projections.some(digest => !SHA.test(digest)) ||
      !integer(value.first_sequence) || !integer(value.last_sequence) ||
      ((value.first_sequence === 0) !== (value.last_sequence === 0)) || value.first_sequence > value.last_sequence) reject('malformed');
  return value;
}

function validateSignature(value) {
  return exact(value, ['key_id', 'algorithm', 'value']) && /^key_[a-z0-9]{16,64}$/.test(value.key_id) &&
    value.algorithm === 'ed25519' && /^[A-Za-z0-9_-]{86}$/.test(value.value);
}

function validateAttestation(value) {
  return exact(value, ['independence', 'role_separation', 'organisational_independence', 'authorship', 'review', 'ground_truth']) &&
    ['public-control', 'custodian-declared', 'procedural-separation'].includes(value.independence) &&
    ['single_operator_procedural', 'distinct_principals'].includes(value.role_separation) && value.organisational_independence === 'not_claimed' &&
    ['project_authored', 'external_authored'].includes(value.authorship) && ['project_reviewed', 'external_reviewed'].includes(value.review) &&
    value.ground_truth === 'not_established';
}

function validateCell(cell) {
  if (!exact(cell, ['metric', 'stratum', 'value']) || !/^[a-z][a-z0-9-]{1,63}$/.test(cell.metric) || !/^[a-z][a-z0-9-]{1,63}$/.test(cell.stratum)) return false;
  const value = cell.value;
  return exact(value, ['state']) && value.state === 'suppressed' ||
    exact(value, ['state', 'numerator', 'denominator']) && value.state === 'reported' && integer(value.numerator) && integer(value.denominator) && value.numerator <= value.denominator;
}

function validateProjection(value) {
  const fields = ['schema', 'projection_id', 'receipt_id', 'destination', 'domain', 'population', 'candidate', 'engine', 'protocol', 'scope_kind',
    'disclosure_policy', 'attestation', 'cells', 'issued_at', 'fresh_until', 'revocation_feed'];
  if (!exact(value, fields) || value.schema !== 'private-custodian.public-projection/2' || !/^prj_[a-z0-9]{16,64}$/.test(value.projection_id) ||
      !/^rcp_[a-z0-9]{16,64}$/.test(value.receipt_id) || !/^[a-z][a-z0-9-]{1,63}$/.test(value.destination) || !['credential', 'pii'].includes(value.domain) ||
      !population(value.population) || !SHA.test(value.candidate) || !exact(value.engine, ['digest', 'name', 'version']) || !SHA.test(value.engine.digest) ||
      !/^[a-z][a-z0-9-]{1,63}$/.test(value.engine.name) || typeof value.engine.version !== 'string' ||
      !exact(value.protocol, ['domain', 'name', 'version']) || value.protocol.domain !== value.domain || !/^[a-z][a-z0-9-]{1,63}$/.test(value.protocol.name) ||
      typeof value.protocol.version !== 'string' || !['population_epoch', 'candidate_lineage_epoch'].includes(value.scope_kind) ||
      !policy(value.disclosure_policy, value.domain) || !validateAttestation(value.attestation) || !Array.isArray(value.cells) || value.cells.length > 256 ||
      value.cells.some(cell => !validateCell(cell)) || new Set(value.cells.map(cell => `${cell.stratum}\0${cell.metric}`)).size !== value.cells.length ||
      !integer(value.issued_at) || !integer(value.fresh_until) || value.fresh_until <= value.issued_at ||
      !exact(value.revocation_feed, ['feed_id', 'min_sequence']) || !/^fed_[a-z0-9]{16,64}$/.test(value.revocation_feed.feed_id) ||
      !integer(value.revocation_feed.min_sequence) || value.revocation_feed.min_sequence === 0) reject('malformed');
  return value;
}

function validateTarget(value) {
  return exact(value, ['target', 'projection_id']) && value.target === 'projection' && /^prj_[a-z0-9]{16,64}$/.test(value.projection_id) ||
    exact(value, ['target', 'receipt_id']) && value.target === 'receipt' && /^rcp_[a-z0-9]{16,64}$/.test(value.receipt_id) ||
    exact(value, ['target', 'candidate']) && value.target === 'candidate' && SHA.test(value.candidate) ||
    exact(value, ['target', 'population']) && value.target === 'population' && population(value.population) ||
    exact(value, ['target', 'policy']) && value.target === 'policy' && object(value.policy);
}

function validateFeed(value) {
  const fields = value.previous === undefined ? ['schema', 'feed_id', 'sequence', 'issued_at', 'fresh_until', 'entries'] :
    ['schema', 'feed_id', 'sequence', 'previous', 'issued_at', 'fresh_until', 'entries'];
  if (!exact(value, fields) || value.schema !== 'private-custodian.revocation-envelope/1' || !/^fed_[a-z0-9]{16,64}$/.test(value.feed_id) ||
      !integer(value.sequence) || value.sequence === 0 || (value.sequence === 1) !== (value.previous === undefined) ||
      (value.previous !== undefined && !SHA.test(value.previous)) || !integer(value.issued_at) || !integer(value.fresh_until) || value.fresh_until <= value.issued_at ||
      !Array.isArray(value.entries) || value.entries.length > 128 || value.entries.some(entry => {
        if (!exact(entry, ['target', 'action', 'reason', 'effective_at']) || !validateTarget(entry.target) || !integer(entry.effective_at) ||
            !['contamination', 'epoch_rotation', 'key_compromise', 'policy_revoked', 'error_correction', 'newer_evidence'].includes(entry.reason)) return true;
        return !(exact(entry.action, ['action']) && ['revoked', 'contaminated'].includes(entry.action.action) ||
          exact(entry.action, ['action', 'superseded_by']) && entry.action.action === 'superseded' && /^prj_[a-z0-9]{16,64}$/.test(entry.action.superseded_by));
      })) reject('malformed');
  return value;
}

function validatePins(pins) {
  if (!exact(pins, ['schema', 'source', 'domain', 'feedId', 'destination', 'candidate', 'config', 'acceptedPopulations', 'acceptedPolicies', 'keys']) ||
      pins.schema !== 'redact-secret-benchmarks.custodian-pins/1' || pins.source.repository !== 'redact-secret/private-custodian' ||
      !/^[0-9a-f]{40}$/.test(pins.source.commit) || !['credential', 'pii'].includes(pins.domain) || !/^fed_[a-z0-9]{16,64}$/.test(pins.feedId) ||
      !/^[a-z][a-z0-9-]{1,63}$/.test(pins.destination) || !SHA.test(pins.candidate) || !SHA.test(pins.config) ||
      !Array.isArray(pins.acceptedPopulations) || !pins.acceptedPopulations.length || pins.acceptedPopulations.some(row => !population(row)) ||
      !Array.isArray(pins.acceptedPolicies) || !pins.acceptedPolicies.length || pins.acceptedPolicies.some(row => !policy(row, pins.domain)) ||
      !Array.isArray(pins.keys) || !pins.keys.length) reject('malformed');
  for (const key of pins.keys) {
    const fields = key.revokedAt === undefined ? ['keyId', 'publicKey', 'domains', 'purposes', 'validFrom', 'validUntil'] :
      ['keyId', 'publicKey', 'domains', 'purposes', 'validFrom', 'validUntil', 'revokedAt'];
    if (!exact(key, fields) || !/^key_[a-z0-9]{16,64}$/.test(key.keyId) || !/^[A-Za-z0-9_-]{43}$/.test(key.publicKey) ||
        !Array.isArray(key.domains) || !key.domains.length || !Array.isArray(key.purposes) || !key.purposes.length ||
        !integer(key.validFrom) || !integer(key.validUntil) || key.validUntil <= key.validFrom || (key.revokedAt !== undefined && !integer(key.revokedAt))) reject('malformed');
  }
  return structuredClone(pins);
}

function envelope(text, kind) {
  const value = decodeCanonical(text);
  if (!exact(value, ['payload', 'signature']) || !validateSignature(value.signature)) reject('malformed');
  if (kind === 'projection') validateProjection(value.payload); else validateFeed(value.payload);
  return value;
}

export class CustodianConsumer {
  constructor(pins) {
    this.pins = validatePins(pins);
    this.sequence = 0;
    this.head = null;
    this.feedIssuedAt = 0;
    this.feedFreshUntil = 0;
    this.feedDocuments = new Map();
    this.entries = [];
    this.tracked = new Map();
  }

  verifySignature(env, domain, purpose) {
    const key = this.pins.keys.find(row => row.keyId === env.signature.key_id);
    if (!key || !key.domains.includes(domain) || !key.purposes.includes(purpose) || env.payload.issued_at < key.validFrom ||
        env.payload.issued_at > key.validUntil || key.revokedAt !== undefined && env.payload.issued_at >= key.revokedAt) reject('key_not_acceptable');
    let publicKey;
    try { publicKey = createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: key.publicKey }, format: 'jwk' }); } catch { reject('key_not_acceptable'); }
    const signature = Buffer.from(env.signature.value, 'base64url');
    if (signature.length !== 64 || !verify(null, domainInput(domain, env.payload), publicKey, signature)) reject('bad_signature');
  }

  observeFeed(text) {
    const env = envelope(text, 'feed');
    this.verifySignature(env, REVOCATION_DOMAIN, 'revocation-feed');
    const payload = env.payload, digest = revocationDigest(payload), canonical = canonicalize(env);
    if (payload.feed_id !== this.pins.feedId) reject('wrong_feed');
    const prior = this.feedDocuments.get(payload.sequence);
    if (prior !== undefined) {
      if (prior !== canonical) reject('feed_fork');
      return 'already-applied';
    }
    if (payload.sequence !== this.sequence + 1) reject('feed_gap');
    if (payload.sequence > 1 && payload.previous !== this.head) reject('feed_chain');
    this.sequence = payload.sequence;
    this.head = digest;
    this.feedIssuedAt = payload.issued_at;
    this.feedFreshUntil = payload.fresh_until;
    this.entries.push(...payload.entries);
    this.feedDocuments.set(payload.sequence, canonical);
    return 'applied';
  }

  standing(payload, now) {
    let superseded = false, revoked = false;
    for (const entry of this.entries) {
      if (entry.effective_at > now || !matches(entry.target, payload)) continue;
      if (entry.action.action === 'superseded') superseded = true; else revoked = true;
    }
    if (revoked) return 'revoked';
    if (superseded) return 'superseded';
    if (now < payload.issued_at || now < this.feedIssuedAt || payload.revocation_feed.feed_id !== this.pins.feedId ||
        this.sequence < payload.revocation_feed.min_sequence || now > this.feedFreshUntil) return 'stale';
    if (now > payload.fresh_until) return 'expired';
    return 'valid';
  }

  verifyProjection(request, text, now) {
    const env = envelope(text, 'projection');
    this.verifySignature(env, PROJECTION_DOMAIN, 'public-projection');
    const payload = env.payload;
    if (payload.destination !== this.pins.destination) reject('destination_mismatch');
    if (payload.domain !== this.pins.domain || payload.domain !== request.domain) reject('wrong_domain');
    if (payload.candidate !== this.pins.candidate || payload.candidate !== request.candidate) reject('wrong_candidate');
    if (request.populations.length && !request.populations.some(row => same(row, payload.population)) ||
        !this.pins.acceptedPopulations.some(row => same(row, payload.population))) reject('wrong_population');
    if (!this.pins.acceptedPolicies.some(row => same(row, payload.disclosure_policy))) reject('policy_not_accepted');
    if (payload.revocation_feed.feed_id !== this.pins.feedId) reject('wrong_feed');
    const standing = this.standing(payload, now);
    if (standing !== 'valid') reject(standing);
    return { digest: projectionDigest(payload), payload: structuredClone(payload), standing, destinationBinding: 'destination-bound' };
  }

  acceptResponse(requestText, response, now) {
    const request = validateRequest(decodeCanonical(requestText, MAX_REQUEST_BYTES));
    if (request.domain !== this.pins.domain || request.candidate !== this.pins.candidate || request.config !== this.pins.config ||
        request.feed_id !== this.pins.feedId || request.known_sequence !== this.sequence) reject('wrong_request');
    const manifest = validateManifest(decodeCanonical(response.manifest, MAX_MANIFEST_BYTES));
    if (manifest.request_digest !== requestDigest(request)) reject('wrong_request');
    if (manifest.feed_id !== this.pins.feedId) reject('wrong_feed');
    if (manifest.destination !== this.pins.destination) reject('wrong_destination');
    if (!Array.isArray(response.projections) || response.projections.length !== manifest.projections.length || response.projections.length > 16 ||
        !Array.isArray(response.revocations) || response.revocations.length > 32) reject('malformed');
    const feedSequences = response.revocations.map(text => envelope(text, 'feed').payload.sequence);
    if ((!feedSequences.length && (manifest.first_sequence !== 0 || manifest.last_sequence !== 0)) ||
        (feedSequences.length && (manifest.first_sequence !== feedSequences[0] || manifest.last_sequence !== feedSequences.at(-1)))) reject('manifest_mismatch');
    let feedError = null, feedApplied = 0;
    for (const text of response.revocations) {
      try { if (this.observeFeed(text) === 'applied') feedApplied++; } catch (error) { feedError = error.code ?? 'malformed'; break; }
    }
    const accepted = [], rejected = [];
    response.projections.forEach((text, index) => {
      try {
        if (feedError) reject('feed_rejected');
        const verified = this.verifyProjection(request, text, now);
        if (manifest.projections[index] !== verified.digest) reject('manifest_mismatch');
        accepted.push(verified);
        this.tracked.set(verified.digest, { payload: verified.payload, standing: 'valid' });
      } catch (error) { rejected.push({ index, code: error.code ?? 'malformed' }); }
    });
    return { request, manifest, accepted, rejected, feedApplied, feedError };
  }

  reevaluate(now) {
    const losses = [];
    for (const [digest, tracked] of this.tracked) {
      const standing = this.standing(tracked.payload, now);
      if (tracked.standing === 'valid' && standing !== 'valid') losses.push({ digest, from: 'valid', to: standing });
      tracked.standing = standing;
    }
    return losses;
  }
}

function matches(target, payload) {
  if (target.target === 'projection') return target.projection_id === payload.projection_id;
  if (target.target === 'receipt') return target.receipt_id === payload.receipt_id;
  if (target.target === 'candidate') return target.candidate === payload.candidate;
  if (target.target === 'population') return same(target.population, payload.population);
  if (target.target === 'policy') return same(target.policy, payload.disclosure_policy);
  return false;
}

export function conformanceReport(pins, requestText, response, now) {
  const consumer = new CustodianConsumer(pins), outcome = consumer.acceptResponse(requestText, response, now);
  if (outcome.feedError || outcome.rejected.length || !outcome.accepted.length) reject(outcome.feedError ?? outcome.rejected[0]?.code ?? 'missing');
  return {
    schema: 'redact-secret-benchmarks.custodian-conformance/1', syntheticConformance: true, supportClaims: false,
    source: structuredClone(pins.source), candidateDigest: pins.candidate, configurationDigest: pins.config,
    configurationBinding: 'bridge-request-only-not-signed-projection', destination: pins.destination,
    feed: { feedId: pins.feedId, sequence: consumer.sequence, freshUntil: consumer.feedFreshUntil },
    projections: outcome.accepted.map(row => ({ digest: row.digest, projectionId: row.payload.projection_id, receiptId: row.payload.receipt_id,
      population: row.payload.population, policy: row.payload.disclosure_policy, standing: row.standing,
      destinationBinding: row.destinationBinding, attestation: row.payload.attestation, cells: row.payload.cells })),
    qualification: 'not-live-support-evidence', reason: 'synthetic-signature-conformance-is-not-independent-ground-truth',
  };
}
