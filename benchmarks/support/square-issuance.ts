import { readFile, writeFile } from 'node:fs/promises';
import type { ReadStream, WriteStream } from 'node:tty';
import type { EmpiricalObservation } from './empirical.ts';

// Structure-only issuance check for Square credentials (#584, Square added to its scope; #583; the #1014 handoff
// docs/audits/evidence/1014/square.md, "Issuance checklist"). The maintainer runs it locally on a key HE issued in the
// Square developer dashboard. It reads the value from standard input only (never argv, an environment variable or a file),
// keeps it in one local variable, and prints and records structure only: total and body length, alphabet classes, which
// special characters occur, a prefix class from a fixed public vocabulary, and which claimed or unclaimed shape matches.
// The value is never echoed, logged, written or returned, so an error names a code and nothing else. Every record says
// `rawValueRetained: false` and carries the revocation reminder. This module never receives or stores a real credential
// in this repository: its tests build synthetic filler at run time.

export type SquareRole = 'access-token' | 'sandbox-access-token' | 'refresh-token' | 'oauth-secret-production' | 'oauth-secret-sandbox';

/** The five roles the handoff's checklist names, each mapped to the contract family it settles (`family`, the observation's credentialFamily) and its taxonomy row. */
export const SQUARE_ROLES: Record<SquareRole, { family: string; taxonomyFamily: string; title: string; question: string }> = {
  'access-token': { family: 'square-token', taxonomyFamily: 'square:access-token', title: 'production access token', question: 'total length (expect 64) and which of + = _ - occur' },
  'sandbox-access-token': { family: 'square-token', taxonomyFamily: 'square:access-token', title: 'sandbox access token', question: 'whether it also starts with EAAA, and its length' },
  'refresh-token': { family: 'square-token', taxonomyFamily: 'square:access-token', title: 'refresh token', question: 'whether EQAA is a real prefix, and its length (the ObtainToken reference shows EQAA + 60)' },
  'oauth-secret-production': { family: 'square-oauth-application-secret', taxonomyFamily: 'square:oauth-application-secret', title: 'production OAuth application secret', question: 'whether the sq0csp- body is 43 or 44 characters' },
  'oauth-secret-sandbox': { family: 'square-oauth-application-secret', taxonomyFamily: 'square:oauth-application-secret', title: 'sandbox OAuth application secret', question: 'whether the sandbox-sq0csb- body is 43 characters' },
};

/** Public, provider-documented prefix markers: the only prefix text a record may carry. Anything else is class `other` with no text. */
export const KNOWN_PREFIXES = ['sandbox-sq0csb-', 'sq0csp-', 'sq0atp-', 'EAAA', 'EAAl', 'EQAA'] as const;
export type PrefixClass = (typeof KNOWN_PREFIXES)[number] | 'other';

const SPECIALS: Record<string, string> = { _: 'underscore', '-': 'hyphen', '+': 'plus', '=': 'equals', '/': 'slash', '.': 'dot' };
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const REVOCATION_REMINDER = 'Revoke or rotate this key in the Square Developer Console if you have not already. Only its structure was recorded; the value was not retained, and you should clear your clipboard and terminal scrollback now.';

export class SquareIssuanceError extends Error {
  constructor(readonly code: string) { super(code); }
}
const fail = (code: string): never => { throw new SquareIssuanceError(code); };

export interface SquareIssuanceMetadata {
  role: SquareRole;
  observedAt: string;
  issuedAt: string;
  issuanceRoute: string;
  subjectId: string;
  revokedAfterObservation: boolean;
}

export interface ShapeMatch { shape: string; matches: boolean }
export interface SquareIssuanceRecord {
  schemaVersion: 1;
  kind: 'square-issuance-structure';
  status: 'observed';
  role: SquareRole;
  /** The #526-shaped observation: identical fields to `EmpiricalObservation` in benchmarks/support/empirical.ts. */
  observation: EmpiricalObservation;
  structure: {
    totalLength: number;
    prefixClass: PrefixClass;
    bodyLength: number | null;
    alphabetClasses: string[];
    specialCharacters: string[];
  };
  claimedShapes: ShapeMatch[];
  unclaimedShapes: ShapeMatch[];
  /** The checklist answers this observation gives, in words; never a fragment of the value. */
  answers: string[];
  revocationReminder: string;
  rawValueRetained: false;
}

function prefixOf(value: string): PrefixClass {
  // Longest first so `sandbox-sq0csb-` is never read as another class.
  return [...KNOWN_PREFIXES].sort((a, b) => b.length - a.length).find(p => value.startsWith(p)) ?? 'other';
}

/** The structure of one Square credential. Pure: `value` never leaves this function except as lengths and class labels. */
export function measureSquareStructure(value: string, metadata: SquareIssuanceMetadata): SquareIssuanceRecord {
  if (!value || !/^[\x21-\x7e]+$/.test(value)) fail('credential-must-be-visible-ascii');
  if (!(metadata.role in SQUARE_ROLES)) fail('unknown-role');
  if (!DATE.test(metadata.observedAt) || !DATE.test(metadata.issuedAt)) fail('invalid-date');
  if (!metadata.issuanceRoute.trim() || !/^subject-[a-z0-9-]+$/.test(metadata.subjectId)) fail('invalid-metadata');

  const prefixClass = prefixOf(value);
  const bodyLength = prefixClass === 'other' ? null : value.length - prefixClass.length;
  const body = prefixClass === 'other' ? value : value.slice(prefixClass.length);
  const specialCharacters = [...new Set([...value].flatMap(ch => ch in SPECIALS ? [SPECIALS[ch]] : []))].sort();
  const alphabetClasses: string[] = [];
  if (/[a-z]/.test(value)) alphabetClasses.push('lower');
  if (/[A-Z]/.test(value)) alphabetClasses.push('upper');
  if (/\d/.test(value)) alphabetClasses.push('digit');
  if (/[^A-Za-z0-9._-]/.test(value)) alphabetClasses.push('mixed-ascii');
  const bodyInClaimedAlphabet = /^[A-Za-z0-9_-]*$/.test(body);

  const claimedShapes: ShapeMatch[] = [
    { shape: 'square-token: EAAA + exactly 60 [A-Za-z0-9_-]', matches: prefixClass === 'EAAA' && bodyLength === 60 && bodyInClaimedAlphabet },
    { shape: 'square-oauth-application-secret: sq0csp- + 43 or 44 [A-Za-z0-9_-]', matches: prefixClass === 'sq0csp-' && (bodyLength === 43 || bodyLength === 44) && bodyInClaimedAlphabet },
    { shape: 'square-oauth-application-secret: sandbox-sq0csb- + 43 [A-Za-z0-9_-]', matches: prefixClass === 'sandbox-sq0csb-' && bodyLength === 43 && bodyInClaimedAlphabet },
  ];
  const unclaimedShapes: ShapeMatch[] = [
    { shape: 'EAAl + 59 (the ObtainToken reference access_token form, 63 in all)', matches: prefixClass === 'EAAl' && bodyLength === 59 },
    { shape: 'EQAA + 60 (the ObtainToken reference refresh_token form)', matches: prefixClass === 'EQAA' && bodyLength === 60 },
    { shape: 'EAAA at another width', matches: prefixClass === 'EAAA' && bodyLength !== 60 },
    { shape: 'sq0csp- outside 43 or 44', matches: prefixClass === 'sq0csp-' && bodyLength !== 43 && bodyLength !== 44 },
    { shape: 'sandbox-sq0csb- outside 43', matches: prefixClass === 'sandbox-sq0csb-' && bodyLength !== 43 },
    { shape: 'sq0atp- legacy personal token (scanner rules only)', matches: prefixClass === 'sq0atp-' },
  ];

  const segments = value.split(/[-_.]/).filter(segment => segment.length > 0);
  const separators = [...new Set([...value].flatMap(ch => ch === '-' ? ['dash'] : ch === '_' ? ['underscore'] : ch === '.' ? ['dot'] : []))];
  const observation: EmpiricalObservation = {
    provider: 'square',
    credentialFamily: SQUARE_ROLES[metadata.role].family,
    observedAt: metadata.observedAt,
    issuedAt: metadata.issuedAt,
    issuanceRoute: metadata.issuanceRoute,
    subjectKind: 'account',
    subjectId: metadata.subjectId,
    evidenceBasis: 'empirically-observed',
    independenceClass: 'provider-issuance',
    structure: {
      totalLength: value.length,
      prefix: prefixClass === 'other' ? null : prefixClass,
      segmentLengths: segments.map(segment => segment.length),
      alphabetClasses,
      separators: separators.length ? separators : ['none'],
      checksumBehavior: 'unknown',
    },
    revokedAfterObservation: metadata.revokedAfterObservation,
    rawValueRetained: false,
  };

  const answers = [
    `${SQUARE_ROLES[metadata.role].title}: total length ${value.length}; prefix class ${prefixClass}${bodyLength === null ? '' : `; body length ${bodyLength}`}.`,
    `Special characters present: ${specialCharacters.length ? specialCharacters.join(', ') : 'none'} (alphabet classes: ${alphabetClasses.join(', ')}).`,
    claimedShapes.some(s => s.matches)
      ? `Matches the claimed shape: ${claimedShapes.find(s => s.matches)!.shape}.`
      : 'Matches no claimed shape.',
    ...(unclaimedShapes.some(s => s.matches) ? [`Matches an unclaimed shape: ${unclaimedShapes.filter(s => s.matches).map(s => s.shape).join('; ')}.`] : []),
    metadata.role === 'sandbox-access-token' ? `Sandbox access token starts with EAAA: ${prefixClass === 'EAAA'}.` : `Role question: ${SQUARE_ROLES[metadata.role].question}.`,
  ];

  return {
    schemaVersion: 1, kind: 'square-issuance-structure', status: 'observed', role: metadata.role,
    observation,
    structure: { totalLength: value.length, prefixClass, bodyLength, alphabetClasses, specialCharacters },
    claimedShapes, unclaimedShapes, answers,
    revocationReminder: REVOCATION_REMINDER,
    rawValueRetained: false,
  };
}

// ----------------------------------------------------------------------------------------------------------------- CLI

export interface PendingRole { role: SquareRole; status: 'pending issuance by the maintainer'; family: string; taxonomyFamily: string; question: string; result: null }
export interface SquareIssuanceRecords {
  schemaVersion: 1;
  provider: 'square';
  issue: 584;
  rawValueRetained: false;
  note: string;
  roles: Array<PendingRole | SquareIssuanceRecord>;
}

/** The records file as committed: every role pending until the maintainer runs the check. */
export function pendingRecords(): SquareIssuanceRecords {
  return {
    schemaVersion: 1, provider: 'square', issue: 584, rawValueRetained: false,
    note: 'Structure only. A role stays "pending issuance by the maintainer" until he issues a key in the Square developer dashboard and runs `npm run issuance:square`; the value is never recorded.',
    roles: (Object.keys(SQUARE_ROLES) as SquareRole[]).map(role => ({ role, status: 'pending issuance by the maintainer' as const, family: SQUARE_ROLES[role].family, taxonomyFamily: SQUARE_ROLES[role].taxonomyFamily, question: SQUARE_ROLES[role].question, result: null })),
  };
}

const FLAGS = new Set(['role', 'issued-at', 'observed-at', 'issuance-route', 'subject-id', 'revoked-after-observation', 'record']);
export interface ParsedArgs { metadata: SquareIssuanceMetadata; recordPath: string | null }

/** Flags only. A bare word or an unknown flag is refused without being echoed: the value is read from stdin, never argv. */
export function parseSquareIssuanceArgs(args: string[]): ParsedArgs {
  const values = new Map<string, string>();
  for (const arg of args) {
    const match = /^--([a-z-]+)=(.*)$/.exec(arg);
    if (!match || !FLAGS.has(match[1]) || values.has(match[1])) return fail('invalid-arguments-the-value-is-read-from-stdin-only');
    values.set(match[1], match[2]);
  }
  const need = (key: string) => values.get(key) || fail('invalid-arguments-the-value-is-read-from-stdin-only');
  const role = need('role') as SquareRole;
  if (!(role in SQUARE_ROLES)) fail('unknown-role');
  const revoked = values.get('revoked-after-observation') ?? 'false';
  if (!['true', 'false'].includes(revoked)) fail('invalid-arguments-the-value-is-read-from-stdin-only');
  return {
    recordPath: values.get('record') ?? null,
    metadata: {
      role,
      observedAt: values.get('observed-at') ?? new Date().toISOString().slice(0, 10),
      issuedAt: need('issued-at'),
      issuanceRoute: values.get('issuance-route') ?? 'Square Developer Console (maintainer-issued)',
      subjectId: values.get('subject-id') ?? 'subject-square-maintainer',
      revokedAfterObservation: revoked === 'true',
    },
  };
}

export interface IssuanceIO {
  readSecret: () => Promise<string>;
  stdout: Pick<NodeJS.WriteStream, 'write'>;
  stderr: Pick<NodeJS.WriteStream, 'write'>;
}

/** Write the observation into the records file's role slot (replacing the pending placeholder). Touches no value: the record holds none. */
export async function upsertRecord(path: string, record: SquareIssuanceRecord): Promise<void> {
  const file = JSON.parse(await readFile(path, 'utf8')) as SquareIssuanceRecords;
  const at = file.roles.findIndex(r => r.role === record.role);
  if (at === -1) file.roles.push(record); else file.roles[at] = record;
  await writeFile(path, `${JSON.stringify(file, null, 2)}\n`);
}

export async function runSquareIssuanceCheck(args: string[], io: IssuanceIO): Promise<number> {
  let value = '';
  try {
    const { metadata, recordPath } = parseSquareIssuanceArgs(args);
    io.stderr.write(`Square issuance check (${SQUARE_ROLES[metadata.role].title}): structure only. ${metadata.revokedAfterObservation ? '' : 'Reminder: revoke the key in the Square Developer Console after this run (or before it: the value stays in your clipboard).\n'}`);
    value = await io.readSecret();
    const record = measureSquareStructure(value, metadata);
    io.stdout.write(`${JSON.stringify(record, null, 2)}\n`);
    if (recordPath) await upsertRecord(recordPath, record);
    io.stderr.write(`${REVOCATION_REMINDER}\n`);
    return 0;
  } catch (error) {
    io.stderr.write(`Square issuance check failed: ${error instanceof SquareIssuanceError ? error.code : 'check-failed'}.\n`);
    return 1;
  } finally {
    value = '';
  }
}

/** Standard input only: hidden (raw mode, no echo) on a terminal, or the whole of a pipe such as `pbpaste | npm run issuance:square -- ...`. */
export function readStdinCredential(input: ReadStream = process.stdin as ReadStream, output: WriteStream = process.stderr as WriteStream): Promise<string> {
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      input.on('data', chunk => chunks.push(Buffer.from(chunk)));
      input.on('error', () => reject(new SquareIssuanceError('stdin-unreadable')));
      input.on('end', () => resolve(Buffer.concat(chunks).toString('utf8').replace(/[\r\n]+$/, '')));
    });
  }
  output.write('Square credential (input hidden): ');
  input.setRawMode(true);
  input.resume();
  return new Promise((resolve, reject) => {
    const bytes: number[] = [];
    const finish = (error?: SquareIssuanceError) => {
      input.off('data', onData);
      input.setRawMode(false);
      input.pause();
      output.write('\n');
      if (error) reject(error); else resolve(Buffer.from(bytes).toString('utf8'));
    };
    const onData = (chunk: Buffer) => {
      for (const byte of chunk) {
        if (byte === 3) return finish(new SquareIssuanceError('check-cancelled'));
        if (byte === 13 || byte === 10) return finish();
        if (byte === 127 || byte === 8) bytes.pop();
        else bytes.push(byte);
      }
    };
    input.on('data', onData);
  });
}
