import type { ReadStream, WriteStream } from 'node:tty';
import { validateEmpiricalObservations, type EmpiricalObservation } from './empirical.ts';

type ChecksumBehavior = 'present' | 'absent' | 'unknown';

export interface ObservationCaptureMetadata {
  provider: string;
  credentialFamily: string;
  observedAt: string;
  issuedAt: string;
  issuanceRoute: string;
  subjectKind: 'account' | 'project';
  subjectId: string;
  prefix: string | null;
  checksumBehavior: ChecksumBehavior;
  revokedAfterObservation: boolean;
}

export class ObservationCaptureError extends Error {
  constructor(readonly code: string) { super(code); }
}

const separatorNames = { '-': 'dash', '_': 'underscore', '.': 'dot' } as const;
const date = /^\d{4}-\d{2}-\d{2}$/;

function fail(code: string): never { throw new ObservationCaptureError(code); }

function alphabetClasses(value: string): string[] {
  const classes: string[] = [];
  if (/[a-z]/.test(value)) classes.push('lower');
  if (/[A-Z]/.test(value)) classes.push('upper');
  if (/\d/.test(value)) classes.push('digit');
  if (/[^A-Za-z0-9._-]/.test(value)) classes.push('mixed-ascii');
  return classes;
}

export function captureObservation(rawValue: string, metadata: ObservationCaptureMetadata): EmpiricalObservation {
  if (!rawValue || !/^[\x21-\x7e]+$/.test(rawValue)) fail('credential-must-be-visible-ascii');
  if (metadata.prefix !== null && (!metadata.prefix || metadata.prefix.length > 32 ||
      metadata.prefix.length >= rawValue.length || !rawValue.startsWith(metadata.prefix))) fail('prefix-mismatch');

  const segments = rawValue.split(/[-_.]/);
  if (segments.some(segment => !segment.length)) fail('empty-segment');
  const separators = [...new Set([...rawValue].flatMap(character => character in separatorNames
    ? [separatorNames[character as keyof typeof separatorNames]] : []))];
  const classes = alphabetClasses(rawValue);
  if (!classes.length) fail('alphabet-unclassified');

  const observation: EmpiricalObservation = {
    provider: metadata.provider,
    credentialFamily: metadata.credentialFamily,
    observedAt: metadata.observedAt,
    issuedAt: metadata.issuedAt,
    issuanceRoute: metadata.issuanceRoute,
    subjectKind: metadata.subjectKind,
    subjectId: metadata.subjectId,
    evidenceBasis: 'empirically-observed',
    independenceClass: 'provider-issuance',
    structure: {
      totalLength: rawValue.length,
      prefix: metadata.prefix,
      segmentLengths: segments.map(segment => segment.length),
      alphabetClasses: classes,
      separators: separators.length ? separators : ['none'],
      checksumBehavior: metadata.checksumBehavior,
    },
    revokedAfterObservation: metadata.revokedAfterObservation,
    rawValueRetained: false,
  };
  try {
    validateEmpiricalObservations({
      schemaVersion: 1,
      families: [{
        family: metadata.credentialFamily,
        mode: 'shape',
        supportsBareValues: false,
        uncertainty: 'capture-validation',
        supportedContexts: ['capture-validation'],
        observations: [observation],
        corroboration: [],
        contradictions: [],
      }],
    });
  } catch { fail('metadata-invalid'); }
  return observation;
}

type CaptureIO = {
  readSecret: () => Promise<string>;
  stdout: Pick<NodeJS.WriteStream, 'write'>;
  stderr: Pick<NodeJS.WriteStream, 'write'>;
};

function parseArguments(args: string[]): { metadata: ObservationCaptureMetadata; debug: boolean } {
  const values = new Map<string, string>();
  let debug = false;
  for (const arg of args) {
    if (arg === '--debug' && !debug) { debug = true; continue; }
    const match = /^--([a-z-]+)=(.*)$/.exec(arg);
    if (!match || values.has(match[1])) fail('invalid-arguments');
    values.set(match[1], match[2]);
  }
  const required = (key: string) => values.get(key) || fail('invalid-arguments');
  const subjectKind = required('subject-kind');
  const checksumBehavior = values.get('checksum-behavior') ?? 'unknown';
  const revoked = required('revoked-after-observation');
  const observedAt = values.get('observed-at') ?? new Date().toISOString().slice(0, 10);
  if (!['account', 'project'].includes(subjectKind) || !['present', 'absent', 'unknown'].includes(checksumBehavior) ||
      !['true', 'false'].includes(revoked) || !date.test(observedAt) || !date.test(required('issued-at'))) fail('invalid-arguments');
  const known = new Set(['provider', 'family', 'observed-at', 'issued-at', 'issuance-route', 'subject-kind', 'subject-id', 'prefix', 'checksum-behavior', 'revoked-after-observation']);
  if ([...values.keys()].some(key => !known.has(key))) fail('invalid-arguments');
  return {
    debug,
    metadata: {
      provider: required('provider'), credentialFamily: required('family'), observedAt,
      issuedAt: required('issued-at'), issuanceRoute: required('issuance-route'),
      subjectKind: subjectKind as 'account' | 'project', subjectId: required('subject-id'),
      prefix: values.get('prefix') ?? null, checksumBehavior: checksumBehavior as ChecksumBehavior,
      revokedAfterObservation: revoked === 'true',
    },
  };
}

export async function runObservationCapture(args: string[], io: CaptureIO): Promise<number> {
  let rawValue = '';
  try {
    const { metadata, debug } = parseArguments(args);
    if (debug) io.stderr.write('Observation capture: awaiting hidden input.\n');
    rawValue = await io.readSecret();
    const observation = captureObservation(rawValue, metadata);
    if (debug) io.stderr.write('Observation capture: structural metadata ready.\n');
    io.stdout.write(`${JSON.stringify(observation, null, 2)}\n`);
    return 0;
  } catch (error) {
    const code = error instanceof ObservationCaptureError ? error.code : 'capture-failed';
    io.stderr.write(`Observation capture failed: ${code}.\n`);
    return 1;
  } finally {
    rawValue = '';
  }
}

export function readHiddenCredential(input: ReadStream = process.stdin as ReadStream, output: WriteStream = process.stderr as WriteStream): Promise<string> {
  if (!input.isTTY || typeof input.setRawMode !== 'function') return Promise.reject(new ObservationCaptureError('interactive-terminal-required'));
  output.write('Credential (input hidden): ');
  input.setRawMode(true);
  input.resume();
  return new Promise((resolve, reject) => {
    const bytes: number[] = [];
    const finish = (error?: ObservationCaptureError) => {
      input.off('data', onData);
      input.setRawMode(false);
      input.pause();
      output.write('\n');
      if (error) reject(error); else resolve(Buffer.from(bytes).toString('utf8'));
    };
    const onData = (chunk: Buffer) => {
      for (const byte of chunk) {
        if (byte === 3) return finish(new ObservationCaptureError('capture-cancelled'));
        if (byte === 13 || byte === 10) return finish();
        if (byte === 127 || byte === 8) bytes.pop();
        else bytes.push(byte);
      }
    };
    input.on('data', onData);
  });
}
