// The measurement host of an official run (#620, #621): captured by the run driver at execution, validated as bounded provenance, and kept out of
// every identity. Synthetic probes only; no committed run's host is asserted.
import assert from 'node:assert/strict';
import test from 'node:test';
import { captureMeasurementHost, engineTelemetry, engineTelemetryProblems, measurementHostProblems, osName } from '../benchmarks/qualification/measurement-host.ts';
import { measurementHostRecordProblems } from '../scripts/check-official-runs.mjs';

const probe = (over = {}) => ({
  now: new Date('2026-01-05T10:20:30Z'), env: { GITHUB_ACTIONS: 'true', ImageOS: 'exampleos', ImageVersion: '20260101.1', RUNNER_ENVIRONMENT: 'github-hosted' },
  platform: 'linux', arch: 'x64', release: '6.0.0-synthetic', osRelease: 'NAME="Example"\nPRETTY_NAME="Example Linux 1"\nID=example\n',
  cpus: [{ model: 'Synthetic  CPU @ 2.00GHz' }, { model: 'Synthetic CPU' }], node: 'v22.9.9', ...over,
});

test('the driver records the OS release, CPU, Node and CI runner image of the machine it runs the engine on', () => {
  const host = captureMeasurementHost(probe());
  assert.deepEqual(host, {
    schema: 'redact-secret-benchmarks/measurement-host/v1', capturedAt: '2026-01-05T10:20:30.000Z',
    os: { platform: 'linux', arch: 'x64', release: '6.0.0-synthetic', name: 'Example Linux 1' }, cpu: { model: 'Synthetic CPU @ 2.00GHz', logicalCores: 2 }, node: 'v22.9.9',
    ci: { provider: 'github-actions', image: 'exampleos', imageVersion: '20260101.1', runnerEnvironment: 'github-hosted' },
  });
  assert.deepEqual(measurementHostProblems(host), []);
});

test('off CI there is no runner image, and a value outside the bounded set is dropped rather than recorded', () => {
  const local = captureMeasurementHost(probe({ env: {}, osRelease: null, cpus: [{ model: '/home/someone/cpu' }] }));
  assert.equal(local.ci, null);
  assert.equal(local.os.name, null);
  assert.equal(local.cpu.model, null, 'a slash (a path) never reaches the record');
  assert.deepEqual(measurementHostProblems(local), []);
  const odd = captureMeasurementHost(probe({ env: { GITHUB_ACTIONS: 'true', ImageOS: 'has space', ImageVersion: '../x' } }));
  assert.deepEqual([odd.ci.image, odd.ci.imageVersion], [null, null]);
  assert.equal(osName('PRETTY_NAME="/etc/passwd"'), null);
});

test('the validator refuses an unknown key, a malformed time, a bad core count and free text', () => {
  const host = captureMeasurementHost(probe());
  assert.match(measurementHostProblems({ ...host, hostname: 'box' }).join(), /hostname is not a host fact/);
  assert.match(measurementHostProblems({ ...host, capturedAt: 'yesterday' }).join(), /capturedAt/);
  assert.match(measurementHostProblems({ ...host, cpu: { model: null, logicalCores: 0 } }).join(), /logical core count/);
  assert.match(measurementHostProblems({ ...host, node: '22' }).join(), /Node version/);
  assert.match(measurementHostProblems({ ...host, ci: { provider: 'other' } }).join(), /ci must be null/);
  assert.deepEqual(measurementHostProblems(null), ['measurementHost must be an object']);
});

test('the engine telemetry is read from non_semantic only, and a value out of shape is not recorded', () => {
  assert.deepEqual(engineTelemetry({ non_semantic: { host: 'linux-x86_64', started_at: '2026-01-05T10:21:00Z', finished_at: '2026-01-05T10:22:00Z', run_id: 'x' } }),
    { host: 'linux-x86_64', startedAt: '2026-01-05T10:21:00Z', finishedAt: '2026-01-05T10:22:00Z' });
  assert.deepEqual(engineTelemetry({ non_semantic: { host: 'user@box /home/user', started_at: 'soon' } }), { host: null, startedAt: null, finishedAt: null });
  assert.deepEqual(engineTelemetry({ non_semantic: null }), { host: null, startedAt: null, finishedAt: null });
  assert.deepEqual(engineTelemetryProblems({ host: null, startedAt: null, finishedAt: null }), []);
  assert.match(engineTelemetryProblems({ host: 'a b', startedAt: null, finishedAt: null }).join(), /host/);
});

test('a recorded run: no host is allowed (an older record stays as it is); a host must match the platform, predate the record and name the CI runner of a canonical run', () => {
  const host = captureMeasurementHost(probe());
  const run = { id: 'pop@linux-x64', platform: 'linux-x64', canonical: true, recordedOn: '2026-01-05' };
  assert.deepEqual(measurementHostRecordProblems(run, 'run'), []);
  assert.deepEqual(measurementHostRecordProblems({ ...run, measurementHost: host }, 'run'), []);
  assert.match(measurementHostRecordProblems({ ...run, platform: 'darwin-arm64', canonical: false, measurementHost: host }, 'run').join(), /platform is darwin-arm64/);
  assert.match(measurementHostRecordProblems({ ...run, recordedOn: '2026-01-04', measurementHost: host }, 'run').join(), /captured after the run was recorded/);
  assert.match(measurementHostRecordProblems({ ...run, measurementHost: { ...host, ci: null } }, 'run').join(), /names no CI runner/);
});
