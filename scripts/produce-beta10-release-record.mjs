/**
 * Produce one beta.10 release record (#287): schema 1 (`beta10-release-record`), PII through the v1 trusted product
 * binding. Kept so a beta.10 record stays reproducible; a new release uses scripts/produce-release-record.mjs.
 * This script does not decide which commit is the release candidate -- every identity is a required argument.
 *
 * Run: node --import tsx scripts/produce-beta10-release-record.mjs \
 *   --benchmark-revision=<40-hex benchmarks-repo commit> \
 *   --credential-profile=measurement-v4|evaluation-v1 \
 *   --performance-budget=<path to a BudgetReport JSON> \
 *   --credential-candidate=<path to a 'candidate' evidence JSON> \
 *   --credential-qualification=<path to a 'qualification' evidence JSON> \
 *   --pii-qualification=<path to a PiiQualificationReport JSON> \
 *   --pii-binding=<path to a PiiTrustedProductBinding JSON> \
 *   --output=<path>
 */
import { parseArguments, produceSchema1 } from './produce-release-record.mjs';

await produceSchema1(parseArguments(process.argv.slice(2)));
