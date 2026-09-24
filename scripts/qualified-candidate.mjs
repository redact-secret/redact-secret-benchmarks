/**
 * Stages a `redact-secret` `main` commit for `eval:candidate` on the staging site (#152),
 * from the bytes that commit's own `artifact-qualification` run qualified.
 *
 * That run does not upload npm tarballs. It uploads the qualified binaries
 * (`node-addon-<target>`, `wasm-web`, `wasm-web-common`) and an `artifact-inventory`
 * that records, per clean-install lane, the SHA-256 of every binary and of the three
 * tarballs its `scripts/pack-npm-candidate.mjs` packed from them. So the chain is:
 *
 *   resolve  the commit (an untrusted 40-hex input, or `main` HEAD) and its successful
 *            `main` qualification run;
 *   fetch    that run's inventory and binaries, each zip checked against the digest
 *            GitHub recorded at upload, the inventory checked to be about this commit and
 *            this run, and each binary checked against the inventory;
 *   (the workflow then packs them with the product's own pack script at that commit)
 *   verify   that every packed tarball is byte-identical to the one the product
 *            qualified, and hand eval:candidate the paths and the attested core digest.
 *
 * Nothing unverified reaches eval:candidate: a digest mismatch anywhere fails the run.
 * GitHub access goes through `gh` with GH_TOKEN; outputs go to GITHUB_OUTPUT.
 *
 * Run: node scripts/qualified-candidate.mjs resolve --repository <owner/repo>   (PRODUCT_SHA optional)
 *      node scripts/qualified-candidate.mjs fetch --repository <owner/repo> --sha <40-hex> --run-id <id> --dir <path>
 *      node scripts/qualified-candidate.mjs verify --dir <path> --packed <path>
 */
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);

export const WORKFLOW = 'artifact-qualification.yml';
/** The clean-install lane whose packed tarballs match this runner (ubuntu-latest, linux-x64). */
export const LANE = 'node';
export const PACKAGES = { core: '@redact-secret/core', node: '@redact-secret/node-linux-x64-gnu', wasm: '@redact-secret/wasm' };
/** Qualified binaries, by the artifact that carries each one. */
export const BINARIES = {
  'node-addon-x86_64-unknown-linux-gnu': 'redact-secret.linux-x64-gnu.node',
  'wasm-web': 'redact_secret_wasm_bg.wasm',
  'wasm-web-common': 'redact_secret_wasm_common_bg.wasm',
};
export const ARTIFACTS = ['artifact-inventory', ...Object.keys(BINARIES)];

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

/**
 * The product commit to measure. PRODUCT_SHA is untrusted (a dispatch input or payload):
 * empty means "resolve main HEAD"; anything else must be exactly 40 lower-case hex.
 */
export function productShaInput(value) {
  if (value === undefined || value === '') return null;
  if (typeof value !== 'string' || !/^[0-9a-f]{40}$/.test(value)) throw new Error('PRODUCT_SHA must be a full 40-character lower-case hex commit id');
  return value;
}

/** The newest successful, complete qualification run of `sha` pushed to (or dispatched on) this repository's `main`. */
export function selectQualificationRun(runs, { sha, repository }) {
  const eligible = runs.filter(r => r.head_sha === sha && r.head_branch === 'main' && ['push', 'workflow_dispatch'].includes(r.event)
    && r.status === 'completed' && r.conclusion === 'success' && r.head_repository?.full_name === repository && r.path === `.github/workflows/${WORKFLOW}`);
  return eligible.sort((a, b) => b.id - a.id || b.run_attempt - a.run_attempt)[0] ?? null;
}

/** Exactly one unexpired artifact per required name, each with the digest GitHub recorded at upload. */
export function pickArtifacts(artifacts, names = ARTIFACTS) {
  return Object.fromEntries(names.map(name => {
    const matches = artifacts.filter(a => a.name === name);
    if (matches.length !== 1) throw new Error(`the qualification run has ${matches.length} artifacts named ${name}; expected exactly one`);
    const [artifact] = matches;
    if (artifact.expired) throw new Error(`artifact ${name} has expired`);
    const digest = /^sha256:([0-9a-f]{64})$/.exec(artifact.digest ?? '')?.[1];
    if (!digest) throw new Error(`artifact ${name} carries no sha256 digest`);
    return [name, { id: artifact.id, sha256: digest }];
  }));
}

export function verifyDigest(label, actual, expected) {
  if (actual !== expected) throw new Error(`${label} has sha256 ${actual}; the qualification run recorded ${expected}. Refusing to measure it.`);
  return actual;
}

/**
 * What the inventory attests for this commit: the three tarballs and the binaries packed
 * into them, from the `node` clean-install lane. The inventory must be about this commit,
 * built on main, by this run, and the lane must have passed every check.
 */
export function qualifiedCandidate(inventory, { sha, runId }) {
  if (inventory?.sourceCommit !== sha) throw new Error(`the artifact inventory is for ${inventory?.sourceCommit}, not ${sha}`);
  if (inventory.sourceRef !== 'refs/heads/main') throw new Error(`the artifact inventory was built from ${inventory.sourceRef}, not refs/heads/main`);
  if (String(inventory.workflowRun) !== String(runId)) throw new Error(`the artifact inventory names run ${inventory.workflowRun}, not ${runId}`);
  const lanes = (inventory.cleanInstallQualification ?? []).filter(l => l.lane === LANE);
  if (lanes.length !== 1) throw new Error(`the artifact inventory has ${lanes.length} ${LANE} clean-install lanes; expected exactly one`);
  const [lane] = lanes;
  if (lane.sourceCommit !== sha) throw new Error(`the ${LANE} clean-install lane is for ${lane.sourceCommit}, not ${sha}`);
  const failed = Object.entries(lane.results ?? {}).filter(([, result]) => result !== 'passed').map(([check]) => check);
  if (!Object.keys(lane.results ?? {}).length || failed.length) throw new Error(`the ${LANE} clean-install lane did not pass: ${failed.join(', ') || 'no results'}`);
  const hex = value => /^[0-9a-f]{64}$/.test(value ?? '');
  const packages = Object.fromEntries(Object.entries(PACKAGES).map(([role, name]) => {
    const matches = (lane.packages ?? []).filter(p => p.name === name);
    if (matches.length !== 1 || !hex(matches[0].sha256) || !/^[a-z0-9.-]+\.tgz$/.test(matches[0].file ?? '')) throw new Error(`the ${LANE} clean-install lane does not attest exactly one ${name} tarball`);
    return [role, { name, version: matches[0].version, file: matches[0].file, sha256: matches[0].sha256 }];
  }));
  const binaries = Object.fromEntries(Object.entries(BINARIES).map(([artifact, file]) => {
    const matches = (lane.binaries ?? []).filter(b => b.file === file);
    if (matches.length !== 1 || !hex(matches[0].sha256)) throw new Error(`the ${LANE} clean-install lane does not attest exactly one ${file}`);
    return [artifact, { file, sha256: matches[0].sha256 }];
  }));
  return { sha, runId: String(runId), productVersion: inventory.productVersion ?? null, packages, binaries };
}

/** Every packed tarball must be the one the product qualified; returns eval:candidate's inputs. */
export function verifyPacked(qualified, packed, digestOf) {
  return Object.fromEntries(Object.entries(qualified.packages).map(([role, pkg]) => {
    const file = path.join(packed, pkg.file);
    verifyDigest(`the repacked ${pkg.file}`, digestOf(file), pkg.sha256);
    return [role, file];
  }));
}

const gh = async (args, encoding = 'utf8') => (await run('gh', args, { encoding, maxBuffer: 512 * 1024 * 1024 })).stdout;
const ghJson = async endpoint => JSON.parse(await gh(['api', endpoint]));
const output = entries => process.env.GITHUB_OUTPUT && appendFile(process.env.GITHUB_OUTPUT, Object.entries(entries).map(([k, v]) => `${k}=${v}\n`).join(''));
const summary = text => process.env.GITHUB_STEP_SUMMARY && appendFile(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);

function args(argv, required) {
  const values = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!/^--[a-z][a-z-]*$/.test(argv[i] ?? '') || argv[i + 1] === undefined) throw new Error(`Usage: ${required.map(k => `--${k} <value>`).join(' ')}`);
    values[argv[i].slice(2)] = argv[i + 1];
  }
  for (const key of required) if (!values[key]) throw new Error(`Missing --${key}`);
  if (values.repository && !/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(values.repository)) throw new Error('--repository must be owner/name');
  if (values.sha) productShaInput(values.sha);
  if (values['run-id'] && !/^[0-9]+$/.test(values['run-id'])) throw new Error('--run-id must be numeric');
  return values;
}

async function resolve({ repository }) {
  const requested = productShaInput(process.env.PRODUCT_SHA);
  const sha = requested ?? productShaInput((await ghJson(`repos/${repository}/commits/main`)).sha);
  const source = requested ? 'requested' : `${repository} main HEAD`;
  const runs = (await ghJson(`repos/${repository}/actions/workflows/${WORKFLOW}/runs?head_sha=${sha}&per_page=100`)).workflow_runs ?? [];
  const selected = selectQualificationRun(runs, { sha, repository });
  if (!selected) {
    const seen = runs.map(r => `${r.id} (${r.event} on ${r.head_branch}: ${r.status}${r.conclusion ? `/${r.conclusion}` : ''})`).join(', ') || 'none';
    await summary(`### Staging not published\n\nNo successful \`${WORKFLOW}\` run on \`main\` exists for ${source} \`${sha}\`, so there is no qualified candidate to measure. Staging is not published without candidate evidence.\n\nRuns seen for that commit: ${seen}.`);
    throw new Error(`no successful ${WORKFLOW} run on main for ${sha} (runs seen: ${seen})`);
  }
  console.log(`Measuring ${source} ${sha}, qualified by run ${selected.id} (${selected.html_url}).`);
  await output({ sha, 'run-id': selected.id, 'run-url': selected.html_url });
}

async function fetchArtifacts({ repository, sha, 'run-id': runId, dir }) {
  const listing = await ghJson(`repos/${repository}/actions/runs/${runId}/artifacts?per_page=100`);
  if (listing.total_count > (listing.artifacts ?? []).length) throw new Error(`run ${runId} has more artifacts than one page lists`);
  const artifacts = pickArtifacts(listing.artifacts);
  await mkdir(dir, { recursive: true });
  for (const [name, artifact] of Object.entries(artifacts)) {
    const zip = await gh(['api', `repos/${repository}/actions/artifacts/${artifact.id}/zip`], 'buffer');
    verifyDigest(`artifact ${name}`, sha256(zip), artifact.sha256);
    const file = path.join(dir, `${name}.zip`);
    await writeFile(file, zip);
    await run('unzip', ['-q', '-o', file, '-d', path.join(dir, name)]);
  }
  const inventory = JSON.parse(await readFile(path.join(dir, 'artifact-inventory', 'artifact-inventory.json'), 'utf8'));
  const qualified = qualifiedCandidate(inventory, { sha, runId });
  for (const [artifact, binary] of Object.entries(qualified.binaries))
    verifyDigest(`${artifact}/${binary.file}`, sha256(await readFile(path.join(dir, artifact, binary.file))), binary.sha256);
  await writeFile(path.join(dir, 'qualified.json'), `${JSON.stringify(qualified, null, 2)}\n`);
  console.log(`Run ${runId} artifacts match their upload digests; inventory binds them to ${sha}; binaries match the inventory.`);
}

async function verify({ dir, packed }) {
  const qualified = JSON.parse(await readFile(path.join(dir, 'qualified.json'), 'utf8'));
  const contents = {};
  for (const pkg of Object.values(qualified.packages)) contents[path.join(packed, pkg.file)] = sha256(await readFile(path.join(packed, pkg.file)));
  const files = verifyPacked(qualified, packed, file => contents[file]);
  await output({ core: path.resolve(files.core), node: path.resolve(files.node), wasm: path.resolve(files.wasm), 'core-sha256': qualified.packages.core.sha256 });
  const lines = Object.values(qualified.packages).map(p => `- \`${p.file}\` sha256 \`${p.sha256}\``);
  console.log(`Repacked tarballs are byte-identical to what run ${qualified.runId} qualified:\n${lines.join('\n')}`);
  await summary(`### Candidate artifacts\n\nredact-secret \`${qualified.sha}\` (${qualified.productVersion}), qualified by run ${qualified.runId}; repacked tarballs are byte-identical to the qualified ones:\n${lines.join('\n')}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, ...rest] = process.argv.slice(2);
  const commands = {
    resolve: () => resolve(args(rest, ['repository'])),
    fetch: () => fetchArtifacts(args(rest, ['repository', 'sha', 'run-id', 'dir'])),
    verify: () => verify(args(rest, ['dir', 'packed'])),
  };
  try {
    if (!commands[command]) throw new Error('Usage: node scripts/qualified-candidate.mjs resolve|fetch|verify ...');
    await commands[command]();
  } catch (error) {
    console.error(`::error::${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}
