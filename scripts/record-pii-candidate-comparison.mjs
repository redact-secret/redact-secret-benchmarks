#!/usr/bin/env node
// Fetch and verify one completed public comparison. No dispatch, authority update or owner acceptance.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { comparisonPlan } from './pii-candidate-comparison-plan.mjs';
import { comparisonDigest, documentDigest, loadPiiCandidateComparison, SIDES } from '../benchmarks/evaluation/domains/pii/candidate-comparison.mjs';
const REPOSITORY = 'redact-secret/redact-secret-benchmarks';
export const COMPARISON_DIR = 'benchmarks/pii-candidate-comparison';
const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export function collectComparison({run, artifact, files, archiveSha256, expectedHeadSha, plan}) {
  if (!/^[a-f0-9]{40}$/.test(expectedHeadSha ?? '') || run.repository?.full_name !== REPOSITORY || run.path !== '.github/workflows/pii-official-run.yml' || run.event !== 'workflow_dispatch' || run.status !== 'completed' || run.conclusion !== 'success' || run.run_attempt !== 1 || run.head_sha !== expectedHeadSha || !Number.isSafeInteger(run.id) || run.id <= 0 || !run.head_branch) throw new Error('comparison-github-run-mismatch');
  if (!artifact || artifact.expired || artifact.name !== 'pii-candidate-comparison' || !Number.isSafeInteger(artifact.id) || artifact.id <= 0 || artifact.digest !== `sha256:${archiveSha256}` || !Number.isSafeInteger(artifact.size_in_bytes) || artifact.size_in_bytes <= 0 || (artifact.workflow_run?.id !== undefined && artifact.workflow_run.id !== run.id) || (artifact.workflow_run?.head_sha !== undefined && artifact.workflow_run.head_sha !== run.head_sha)) throw new Error('comparison-github-artifact-mismatch');
  const uploadedPlan = JSON.parse(files['plan.json']), receipt = JSON.parse(files['receipt.json']);
  const g = receipt.github;
  if (!g || g.repository !== REPOSITORY || g.runId !== run.id || g.runAttempt !== run.run_attempt || g.headSha !== run.head_sha || g.workflowRef !== `${REPOSITORY}/${run.path}@refs/heads/${run.head_branch}`) throw new Error('comparison-receipt-github-provenance-mismatch');
  if (plan.mode !== 'official' || plan.dispatch.authorised !== true || comparisonDigest(uploadedPlan) !== comparisonDigest(plan)) throw new Error('comparison-uploaded-plan-mismatch');
  const artifacts = SIDES.flatMap(side => plan.populations.map(p => ({side, view:p.view, text:files[`${side}.${p.view}.public-synthetic-artifact.json`]})));
  if (artifacts.some(a=>typeof a.text !== 'string')) throw new Error('comparison-uploaded-artifact-missing');
  const record = { schema:'pii-candidate-comparison-record/1', supportClaims:false, authorityChanged:false, ownerAcceptance:null, planDigest:comparisonDigest(plan),
    workflow:{repository:REPOSITORY,path:run.path,reusablePath:'.github/workflows/pii-candidate-comparison.yml',runId:run.id,runAttempt:run.run_attempt,event:run.event,headSha:run.head_sha,headBranch:run.head_branch,conclusion:run.conclusion},
    actionsArtifact:{id:artifact.id,name:artifact.name,digest:artifact.digest,archiveSha256,sizeInBytes:artifact.size_in_bytes},
    receipt:{sha256:sha(files['receipt.json']),documentDigest:documentDigest(receipt)},
    artifacts:artifacts.map(a=>({side:a.side,view:a.view,sha256:sha(a.text)})) };
  const summary = loadPiiCandidateComparison({plan,receipt,artifacts,record});
  if (summary.state !== 'recorded' || summary.mode !== 'official') throw new Error(`comparison-upload-rejected:${summary.reason ?? 'mode'}`);
  return {record, files:Object.fromEntries(['plan.json','receipt.json',...artifacts.map(a=>`${a.side}.${a.view}.public-synthetic-artifact.json`)].map(name=>[name,files[name]]))};
}
export function comparisonSourceProblems({root=ROOT, plan=comparisonPlan()}={}) {
  const dir=join(root,COMPARISON_DIR);
  let record; try {record=JSON.parse(readFileSync(join(dir,'record.json'),'utf8'));} catch(error) { if(error.code!=='ENOENT') return ['comparison-record-unreadable']; }
  if(!record&&!existsSync(join(dir,'receipt.json'))) {
    const orphan=SIDES.some(side=>plan.populations.some(p=>existsSync(join(dir,`${side}.${p.view}.public-synthetic-artifact.json`))));
    return orphan?['comparison-artifact-without-receipt']:[];
  }
  try {
    const files=Object.fromEntries(['plan.json','receipt.json',...SIDES.flatMap(side=>plan.populations.map(p=>`${side}.${p.view}.public-synthetic-artifact.json`))].map(name=>[name,readFileSync(join(dir,name),'utf8')]));
    const receipt=JSON.parse(files['receipt.json']);
    if(record && sha(files['receipt.json'])!==record.receipt?.sha256) return ['comparison-receipt-bytes-mismatch'];
    const artifacts=SIDES.flatMap(side=>plan.populations.map(p=>({side,view:p.view,text:files[`${side}.${p.view}.public-synthetic-artifact.json`]})));
    if(comparisonDigest(JSON.parse(files['plan.json']))!==comparisonDigest(plan)) return ['comparison-plan-stale'];
    const report=loadPiiCandidateComparison({plan,receipt,artifacts,record});
    return report.state==='recorded'&&(report.mode==='official'||!record)?[]:[report.reason??'comparison-not-official'];
  } catch(error) { return ['comparison-source-unreadable-or-invalid'];}
}
function gh(args, binary=false) { return execFileSync('gh',args,{encoding:binary?undefined:'utf8',maxBuffer:64*1024*1024,timeout:60000}); }
export function extractComparisonArchive({archive,dir,names}) {
  try {
    execFileSync('python3',['-c',`import zipfile,json,sys,stat,pathlib
z=zipfile.ZipFile(sys.argv[1]); allowed=set(json.loads(sys.argv[3])); entries=z.infolist()
assert len(entries)==len(allowed) and {e.filename for e in entries}==allowed
assert sum(e.file_size for e in entries)<=128*1024*1024
for e in entries:
 assert e.file_size<=32*1024*1024 and not stat.S_ISLNK(e.external_attr>>16)
 pathlib.Path(sys.argv[2],e.filename).write_bytes(z.read(e))`,archive,dir,JSON.stringify(names)],{timeout:60000,stdio:'pipe'});
    return Object.fromEntries(names.map(name=>[name,new TextDecoder('utf-8',{fatal:true}).decode(readFileSync(join(dir,name)))]));
  } catch { throw new Error('comparison-archive-members-invalid'); }
}
export function collectGithub({runId,expectedHeadSha,write=false}) {
  if(!/^[0-9]+$/.test(String(runId))) throw new Error('comparison-run-id-invalid');
  const run=JSON.parse(gh(['api',`repos/${REPOSITORY}/actions/runs/${runId}`]));
  const listing=JSON.parse(gh(['api',`repos/${REPOSITORY}/actions/runs/${runId}/artifacts?per_page=100`]));
  const matches=listing.artifacts.filter(a=>a.name==='pii-candidate-comparison');
  if(matches.length!==1) throw new Error('comparison-upload-not-unique');
  if(run.repository?.full_name!==REPOSITORY || run.path!=='.github/workflows/pii-official-run.yml' || run.event!=='workflow_dispatch' || run.status!=='completed' || run.conclusion!=='success' || run.run_attempt!==1 || run.head_sha!==expectedHeadSha) throw new Error('comparison-github-run-mismatch');
  const artifact=matches[0]; if(artifact.expired || !/^sha256:[a-f0-9]{64}$/.test(artifact.digest ?? ''))throw new Error('comparison-github-artifact-mismatch');
  const zip=gh(['api',`repos/${REPOSITORY}/actions/artifacts/${artifact.id}/zip`],true), archiveSha256=sha(zip);
  if(artifact.digest!==`sha256:${archiveSha256}`) throw new Error('comparison-archive-digest-mismatch');
  const temp=mkdtempSync(join(tmpdir(),'pii-comparison-collect-'));
  try {
    const archive=join(temp,'archive.zip');writeFileSync(archive,zip);
    const plan=comparisonPlan(), names=['plan.json','receipt.json','summary.json',...SIDES.flatMap(side=>plan.populations.map(p=>`${side}.${p.view}.public-synthetic-artifact.json`))];
    // Do not extract arbitrary ZIP paths, symlinks or hidden payloads. Only the eleven public upload members may exist.
    const files=extractComparisonArchive({archive,dir:temp,names});
    // The upload must equal the approved plan at the immutable workflow head, not merely the caller's working tree.
    const headPlan=JSON.parse(gh(['api','-H','Accept: application/vnd.github.raw',`repos/${REPOSITORY}/contents/${COMPARISON_DIR}/plan.json?ref=${expectedHeadSha}`]));
    if(comparisonDigest(headPlan)!==comparisonDigest(plan)) throw new Error('comparison-workflow-head-plan-mismatch');
    const result=collectComparison({run,artifact,files,archiveSha256,expectedHeadSha,plan});
    if(write){const dir=join(ROOT,COMPARISON_DIR);mkdirSync(dir,{recursive:true});for(const[name,text]of Object.entries(result.files))writeFileSync(join(dir,name),text);writeFileSync(join(dir,'record.json'),JSON.stringify(result.record,null,1)+'\n');}
    return result.record;
  } finally {rmSync(temp,{recursive:true,force:true});}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  if(process.argv.includes('--check')) {const problems=comparisonSourceProblems();if(problems.length)throw new Error(problems.join(','));console.log('PII comparison source bindings valid (or no canonical record yet)');}
  else {const arg=name=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);console.log(JSON.stringify(collectGithub({runId:arg('run-id'),expectedHeadSha:arg('head-sha'),write:process.argv.includes('--write')}),null,1));}
}
