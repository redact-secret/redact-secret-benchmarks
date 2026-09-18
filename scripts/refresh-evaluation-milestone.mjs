import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

const repository = 'redact-secret/redact-secret-benchmarks';
const issues = JSON.parse(execFileSync('gh', ['issue', 'list', '--repo', repository, '--milestone', 'Evaluation Engine v1.0',
  '--state', 'all', '--limit', '100', '--json', 'number,state'], { encoding: 'utf8' }));
if (issues.some(i => i.number > 9) || Array.from({ length: 8 }, (_, i) => i + 1).some(n => !issues.some(i => i.number === n)))
  throw new Error('Milestone scope changed; review the v1 qualification plan before updating the snapshot.');
const openPrerequisites = issues.filter(i => i.number < 9 && i.state !== 'CLOSED').map(i => i.number).sort((a, b) => a - b);
await writeFile(new URL('../qualification/milestone-status.json', import.meta.url), JSON.stringify({
  checkedAt: new Date().toISOString(), repository, number: 1, status: openPrerequisites.length ? 'open' : 'closed', openPrerequisites, outOfScope: [],
}, null, 2) + '\n');
console.log(`${openPrerequisites.length} open prerequisite issues recorded. No GitHub state was changed.`);
