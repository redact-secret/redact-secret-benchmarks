/** Validate archived decision identities and current scoped owner records; reject historical Markdown accumulation. */
import { readFile, readdir, stat } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { loadDecisionProvenance, provenanceProblems, ownerAuthorisationProblems } from './lib/decision-provenance.mjs';
const root = new URL('../', import.meta.url);
const DECISIONS_DIR = new URL('docs/decisions/', root);
async function exists(url) { try { await stat(url); return true; } catch { return false; } }
export async function validate() {
  const errors = [];
  let provenance;
  try { provenance = loadDecisionProvenance(); } catch (error) { return [error.message]; }
  errors.push(...provenanceProblems(provenance));
  const manifest = JSON.parse(await readFile(new URL('docs/retention/historical-decisions.json', root), 'utf8'));
  const sourceRows = manifest.files.filter(r => r.decisionId);
  if (sourceRows.length !== provenance.records.length) errors.push('decision provenance and reviewed disposition counts differ');
  for (const row of provenance.records) {
    const source = sourceRows.find(r => r.path === row.path);
    if (!source || source.decisionId !== row.decisionId || source.status !== row.status || source.sha256 !== row.sourceSha256 || manifest.sourceCommit !== row.sourceCommit) errors.push(`${row.path}: provenance differs from reviewed source identity/status/digest`);
    if (!(await exists(new URL(row.spec, root)))) errors.push(`${row.path}: current specification ${row.spec} is absent`);
  }
  try {
    for (const name of await readdir(DECISIONS_DIR)) errors.push(`docs/decisions/${name}: historical ADR accumulation is forbidden; use a maintained spec or reviewed typed owner record`);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const authorisations = new URL('benchmarks/governance/authorisations/', root);
  try {
    for (const name of await readdir(authorisations)) {
      if (!/^[0-9a-z-]+\.json$/.test(name)) { errors.push(`invalid owner record name: ${name}`); continue; }
      const value = JSON.parse(await readFile(new URL(name, authorisations), 'utf8'));
      errors.push(...ownerAuthorisationProblems(value).map(p => `${name}: ${p}`));
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const errors = await validate();
  for (const error of errors) console.error(`::error::${error}`);
  if (errors.length) process.exitCode = 1;
  else console.log('Decision provenance and owner record validation complete: 0 error(s).');
}
