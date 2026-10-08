import test from 'node:test';
import assert from 'node:assert/strict';
import {syntheticComparison} from './pii-candidate-comparison.test.mjs';
import {mkdtempSync,writeFileSync,readFileSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {collectComparison,extractComparisonArchive,comparisonSourceProblems} from '../scripts/record-pii-candidate-comparison.mjs';
import {comparisonDigest, loadPiiCandidateComparison} from '../benchmarks/evaluation/domains/pii/candidate-comparison.mjs';
import {semanticDigest} from '../benchmarks/evaluation/domains/pii/pii-eval-artifact-consumer.mjs';
function official() {
 const e=syntheticComparison();
 e.plan.mode='official';e.plan.dispatch={authorised:true,costDecision:'synthetic-decision',costDecisionSha256:'a'.repeat(64)};
 e.receipt.github={repository:'redact-secret/redact-secret-benchmarks',runId:42,runAttempt:1,headSha:'a'.repeat(40),workflowRef:'redact-secret/redact-secret-benchmarks/.github/workflows/pii-official-run.yml@refs/heads/synthetic-branch'};
 e.receipt.mode='official';e.receipt.planDigest=comparisonDigest(e.plan);e.receipt.engine.canonical=true;e.receipt.engine.platform='linux-x64';e.receipt.engine.binarySha256=e.plan.engine.binarySha256;
 e.receipt.baseline.tarballIntegrity.node=e.plan.baseline.packages['@redact-secret/node-linux-x64-gnu'].integrity;
 e.receipt.candidate.nativePackageProvenance='qualified-inventory-whole-package';e.receipt.candidate.tarballs.node=e.plan.candidate.nativeLinuxTarballSha256;
 for(const a of e.artifacts){const doc=JSON.parse(a.text);doc.semantic.productProjection.rows.forEach(r=>r.mode='official');doc.semanticDigest=semanticDigest(doc);a.text=JSON.stringify(doc);const pins=e.receipt.pins[a.side];pins.build.binarySha256=e.plan.engine.binarySha256;const pin=pins.populations.find(p=>p.label===a.view);pin.projection.mode='official';pin.artifactDigest=doc.semanticDigest;}
 const files={'plan.json':JSON.stringify(e.plan),'receipt.json':JSON.stringify(e.receipt),...Object.fromEntries(e.artifacts.map(a=>[`${a.side}.${a.view}.public-synthetic-artifact.json`,a.text]))};
 return {...e,files,run:{id:42,repository:{full_name:'redact-secret/redact-secret-benchmarks'},path:'.github/workflows/pii-official-run.yml',event:'workflow_dispatch',status:'completed',conclusion:'success',run_attempt:1,head_sha:'a'.repeat(40),head_branch:'synthetic-branch'},artifact:{id:43,name:'pii-candidate-comparison',expired:false,digest:'sha256:'+'b'.repeat(64),size_in_bytes:100,workflow_run:{id:42,head_sha:'a'.repeat(40)}},archiveSha256:'b'.repeat(64),expectedHeadSha:'a'.repeat(40)};
}
test('canonical receipt requires independently collected GitHub provenance for publication',()=>{const e=official();assert.equal(loadPiiCandidateComparison(e).state,'invalid');const result=collectComparison(e);assert.equal(loadPiiCandidateComparison({...e,record:result.record}).state,'recorded');assert.equal(result.record.ownerAcceptance,null);assert.equal(Object.keys(result.files).length,10);});
for(const[name,mutate]of[
 ['repository',e=>e.run.repository.full_name='foreign/repository'],['workflow',e=>e.run.path='.github/workflows/other.yml'],['head',e=>e.run.head_sha='c'.repeat(40)],['rerun',e=>e.run.run_attempt=2],['failed run',e=>e.run.conclusion='failure'],['archive digest',e=>e.archiveSha256='c'.repeat(64)],['expired archive',e=>e.artifact.expired=true],['artifact run identity',e=>e.artifact.workflow_run.id=99],['uploaded plan',e=>e.files['plan.json']=JSON.stringify({...e.plan,mode:'exploratory'})],['receipt claim',e=>{const r=JSON.parse(e.files['receipt.json']);r.supportClaims=true;e.files['receipt.json']=JSON.stringify(r);}],['receipt github mismatch',e=>{const r=JSON.parse(e.files['receipt.json']);r.github.headSha='c'.repeat(40);e.files['receipt.json']=JSON.stringify(r);}],['missing population',e=>delete e.files['baseline.oracle-plan.public-synthetic-artifact.json']],
])test(`collector refuses ${name}`,()=>{const e=official();mutate(e);assert.throws(()=>collectComparison(e));});
test('durable record refuses altered artifact bytes and receipt identity',()=>{const e=official(),{record}=collectComparison(e);assert.equal(loadPiiCandidateComparison({...e,record}).state,'recorded');e.artifacts[0].text+=' ';assert.equal(loadPiiCandidateComparison({...e,record}).state,'invalid');e.artifacts[0].text=e.files['baseline.oracle-plan.public-synthetic-artifact.json'];e.receipt.durationMs++;assert.equal(loadPiiCandidateComparison({...e,record}).state,'invalid');});

test('public ZIP extraction refuses paths, extra payloads, duplicate names and symlinks',()=>{
 const dir=mkdtempSync(join(tmpdir(),'pii-archive-test-'));
 try {
  const archive=join(dir,'test.zip'),out=join(dir,'out');mkdirSync(out);
  const make=kind=>execFileSync('python3',['-c',`import zipfile,sys
z=zipfile.ZipFile(sys.argv[1],'w');kind=sys.argv[2]
if kind=='symlink':
 e=zipfile.ZipInfo('receipt.json');e.create_system=3;e.external_attr=0o120777<<16;z.writestr(e,'../target')
else:
 z.writestr('receipt.json','{}')
 if kind=='extra':z.writestr('extra.json','{}')
 if kind=='path':z.writestr('../secret.json','{}')
 if kind=='duplicate':z.writestr('receipt.json','{}')
z.close()`,archive,kind],{stdio:'pipe'});
  make('valid');assert.deepEqual(extractComparisonArchive({archive,dir:out,names:['receipt.json']}),{'receipt.json':'{}'});
  for(const kind of ['path','extra','duplicate','symlink']){make(kind);assert.throws(()=>extractComparisonArchive({archive,dir:out,names:['receipt.json']}),/archive-members-invalid/);}
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('source gate verifies durable bytes and permits only a genuinely absent canonical record',()=>{
 const dir=mkdtempSync(join(tmpdir(),'pii-source-test-')),e=official(),got=collectComparison(e),out=join(dir,'benchmarks/pii-candidate-comparison');mkdirSync(out,{recursive:true});
 try{assert.deepEqual(comparisonSourceProblems({root:dir,plan:e.plan}),[]);for(const[name,text]of Object.entries(got.files))writeFileSync(join(out,name),text);assert.notDeepEqual(comparisonSourceProblems({root:dir,plan:e.plan}),[]);writeFileSync(join(out,'record.json'),JSON.stringify(got.record));assert.deepEqual(comparisonSourceProblems({root:dir,plan:e.plan}),[]);writeFileSync(join(out,'receipt.json'),got.files['receipt.json']+' ');assert.deepEqual(comparisonSourceProblems({root:dir,plan:e.plan}),['comparison-receipt-bytes-mismatch']);}finally{rmSync(dir,{recursive:true,force:true});}
});
