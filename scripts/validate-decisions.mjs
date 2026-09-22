/**
 * CI gate: every ADR under `docs/decisions/` carries valid frontmatter
 * (`decision_id`, `status`, `scope`), an accepted ADR states its Decision,
 * and `docs/decisions/DECISIONS.md` indexes every record exactly once.
 * Adopted from redact-secret's `scripts/validate-decisions.py`
 * (redact-secret#592/#597), adapted to this repo's `benchmarks` scope and
 * to the `Decision`/`Decisions`/`Decision N` heading variants this corpus
 * actually uses (issue #135).
 *
 * Run: npm run decisions:validate
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const root = new URL('../', import.meta.url);
const DECISIONS_DIR = new URL('docs/decisions/', root);
const DECISION_ID = /^decision-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DECISION_HEADING = /^#{1,6}\s+Decisions?\b/im;
const LINK = /\[[^\]]+\]\(([^)]+)\)/g;
const VALID_STATUSES = new Set(['proposed', 'accepted', 'rejected', 'superseded']);
const SCOPE = 'benchmarks';

async function exists(url) {
  try {
    await stat(url);
    return true;
  } catch {
    return false;
  }
}

function parseFrontmatter(text, label) {
  const errors = [];
  const lines = text.split('\n');
  if (lines[0] !== '---') return { fields: {}, body: text, errors: [`${label}: missing YAML frontmatter`] };
  const end = lines.indexOf('---', 1);
  if (end === -1) return { fields: {}, body: text, errors: [`${label}: missing YAML frontmatter closer`] };

  const fields = {};
  for (let i = 1; i < end; i++) {
    const line = lines[i];
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const match = /^([a-z][a-z0-9_]*):\s*(.+)$/.exec(line);
    if (!match) { errors.push(`${label}:${i + 1}: unsupported frontmatter syntax`); continue; }
    const [, key, rawValue] = match;
    if (key in fields) errors.push(`${label}:${i + 1}: duplicate field ${key}`);
    fields[key] = rawValue.trim().replace(/^['"]|['"]$/g, '');
  }
  return { fields, body: lines.slice(end + 1).join('\n'), errors };
}

/** Validate every ADR under `decisionsDir` plus its index. Returns a list of error strings. */
export async function validate(decisionsDir = DECISIONS_DIR) {
  const errors = [];
  let names;
  try {
    names = (await readdir(decisionsDir)).filter(name => name.endsWith('.md') && name !== 'DECISIONS.md').sort();
  } catch (err) {
    if (err.code === 'ENOENT') return errors;
    throw err;
  }

  const indexUrl = new URL('DECISIONS.md', decisionsDir);
  if (names.length && !(await exists(indexUrl))) {
    errors.push(`${fileLabel(indexUrl)}: missing decision index`);
    return errors;
  }

  const identities = new Map();
  for (const name of names) {
    const fileUrl = new URL(name, decisionsDir);
    const label = fileLabel(fileUrl);
    const text = await readFile(fileUrl, 'utf8');
    const { fields, body, errors: parseErrors } = parseFrontmatter(text, label);
    errors.push(...parseErrors);

    for (const required of ['decision_id', 'status', 'scope']) {
      if (!(required in fields)) errors.push(`${label}: missing required field ${required}`);
    }

    const identity = fields.decision_id ?? '';
    if (!DECISION_ID.test(identity)) errors.push(`${label}: invalid decision_id`);
    else if (identities.has(identity)) errors.push(`${label}: duplicate decision_id ${identity}`);
    else identities.set(identity, name);

    if (!VALID_STATUSES.has(fields.status)) errors.push(`${label}: invalid status`);
    if (fields.scope !== undefined && fields.scope !== SCOPE) errors.push(`${label}: docs/decisions records must use ${SCOPE} scope`);
    if (fields.status === 'accepted' && !DECISION_HEADING.test(body)) errors.push(`${label}: accepted decision requires a Decision heading`);
  }

  if (!names.length) return errors;

  const indexText = await readFile(indexUrl, 'utf8');
  const resolved = [];
  for (const match of indexText.matchAll(LINK)) {
    const target = match[1];
    if (/^[a-z]+:\/\//i.test(target) || target.startsWith('#')) continue;
    const resolvedUrl = new URL(target.split('#')[0], indexUrl);
    resolved.push(resolvedUrl.pathname);
    if (!(await exists(resolvedUrl))) errors.push(`${fileLabel(indexUrl)}: broken decision link ${target}`);
    else if (new URL('.', resolvedUrl).pathname !== new URL('.', indexUrl).pathname)
      errors.push(`${fileLabel(indexUrl)}: decision link leaves docs/decisions: ${target}`);
  }

  for (const name of names) {
    const recordPath = new URL(name, decisionsDir).pathname;
    const count = resolved.filter(p => p === recordPath).length;
    if (count !== 1) errors.push(`${fileLabel(indexUrl)}: ${name} is indexed ${count} times`);
  }

  return errors;
}

function fileLabel(url) {
  const rootPath = new URL('.', root).pathname;
  return url.pathname.startsWith(rootPath) ? url.pathname.slice(rootPath.length) : url.pathname;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const errors = await validate();
  for (const error of errors) console.error(`::error::${error}`);
  if (errors.length) process.exitCode = 1;
  else console.log(`Decision validation complete: 0 error(s).`);
}
