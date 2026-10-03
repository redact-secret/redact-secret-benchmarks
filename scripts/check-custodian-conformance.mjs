#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { CustodianConsumer, canonicalize, conformanceReport } from '../benchmarks/evaluation/domains/pii/custodian-consumer.mjs';

const bundle = JSON.parse(await readFile(new URL('../tests/fixtures/custodian/synthetic-pii-bundle.json', import.meta.url), 'utf8'));
const wire = value => canonicalize(value);
const response = part => ({ manifest: wire(part.manifest), projections: part.projections.map(wire), revocations: part.revocations.map(wire) });
const report = conformanceReport(bundle.pins, wire(bundle.initial.request), response(bundle.initial), bundle.initial.now);
if (report.qualification !== 'not-live-support-evidence' || report.projections.some(row => row.standing !== 'valid'))
  throw new Error('Synthetic custodian conformance did not fail closed');
const consumer = new CustodianConsumer(bundle.pins);
const initial = consumer.acceptResponse(wire(bundle.initial.request), response(bundle.initial), bundle.initial.now);
consumer.acceptResponse(wire(bundle.revocationUpdate.request), response(bundle.revocationUpdate), bundle.revocationUpdate.now);
if (initial.accepted.length !== 1 || consumer.reevaluate(bundle.revocationUpdate.now)[0]?.to !== 'revoked')
  throw new Error('Synthetic custodian revocation did not invalidate accepted evidence');
console.log(`Custodian conformance: ${report.projections.length} destination-bound synthetic projection; revocation re-evaluation passed`);
