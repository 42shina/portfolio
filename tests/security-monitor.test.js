import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import test from 'node:test';
import { archiveImageId, command, emptyResult, exitStatus, imageFindings, main, projectFindings, publicSummary, summarize, validateToolchain } from '../scripts/security-monitor/monitor.mjs';
const require = createRequire(import.meta.url);
const { inspectNode } = require('../scripts/security-monitor/inventory.cjs');
const marker = 'PRIVATE-DEPENDENCY-CVE-DO-NOT-PUBLISH';
const clean = () => emptyResult().map(row => ({ ...row, status: 'ok' }));
const target = 'Project dependencies';

test('clean, vulnerability and monitoring error results have distinct exit codes', () => {
  const rows = clean(); assert.equal(exitStatus(rows), 0);
  rows[0] = summarize(target, [{ severity: 'high', title: marker }]);
  assert.equal(exitStatus(rows), 1);
  rows[1].status = 'error'; assert.equal(exitStatus(rows), 2);
  const output = publicSummary(rows);
  assert.ok(output.includes('monitoring error'));
  assert.ok(output.includes('| Project dependencies | 0 | 1 |'));
  assert.ok(!output.includes(marker));
});

test('unknown severity and official security update signals cannot silently pass', () => {
  const rows = clean(); rows[0] = summarize(target, [{ severity: 'unrated' }]);
  assert.equal(exitStatus(rows), 1);
  rows[0] = summarize(target, [], [{ kind: marker }]); assert.equal(exitStatus(rows), 1);
  assert.ok(!publicSummary(rows).includes(marker));
});

test('unexpected audit responses are monitoring errors, not empty findings', () => {
  assert.throws(() => projectFindings({ error: { summary: marker } }));
  assert.throws(() => projectFindings({ vulnerabilities: [] }));
  assert.throws(() => projectFindings({ vulnerabilities: { x: { severity: 'invented' } }, metadata: { vulnerabilities: {} } }));
  assert.deepEqual(projectFindings({ auditReportVersion: 2, vulnerabilities: {}, metadata: { vulnerabilities: { total: 0 } } }), []);
});

test('the scanned image must match .node-version, Dockerfile and npm pin', () => {
  const from = 'FROM node:22.23.4-bookworm-slim\n';
  const inventory = { nodeVersion: '22.23.4', npmVersion: '12.2.1', packages: [{ name: 'npm', version: '12.2.1' }] };
  validateToolchain('22.23.4', '12.2.1', from, inventory);
  for (const change of [{ nodeVersion: '22.23.3' }, { npmVersion: '10.9.9' }, { packages: [] }]) {
    assert.throws(() => validateToolchain('22.23.4', '12.2.1', from, { ...inventory, ...change }));
  }
  assert.throws(() => validateToolchain('22.23.4', '12.2.1', 'FROM node:24-slim', inventory));
});

function nodeData() {
  return {
    core: { '1': { vulnerable: '22.x', patched: '^22.23.4', severity: 'high', affectedEnvironments: ['all'] } },
    releases: [{ version: 'v22.23.4', date: '2026-10-21', security: true }],
    schedule: { v22: { end: '2027-04-30' } },
    feed: '<rss><channel><item><title>October security releases</title><link>https://nodejs.org/en/blog/vulnerability/october-security-releases</link><pubDate>Wed, 21 Oct 2026 12:00:00 GMT</pubDate></item></channel></rss>',
  };
}
const now = new Date('2026-10-23T00:00:00Z');
test('Node core matching excludes patched versions and other environments', () => {
  const data = nodeData();
  assert.equal(inspectNode(data, '22.23.4', now).findings.length, 0);
  assert.equal(inspectNode(data, '22.23.3', now).findings.length, 1);
  data.core['1'].affectedEnvironments = ['win32'];
  assert.equal(inspectNode(data, '22.23.3', now).findings.length, 0);
});
test('Node security releases, new official notices and EOL supplement the core DB', () => {
  const data = nodeData();
  assert.equal(inspectNode(data, '22.23.3', now).updates[0].kind, 'security-release');
  data.feed = data.feed.replace('21 Oct', '22 Oct');
  assert.ok(inspectNode(data, '22.23.4', now).updates.some(x => x.kind === 'official-notice'));
  data.schedule.v22.end = '2026-10-22';
  assert.ok(inspectNode(data, '22.23.4', now).updates.some(x => x.kind === 'end-of-life'));
  data.core['1'].vulnerable = 'not-a-range';
  assert.throws(() => inspectNode(data, '22.23.4', now));
});

for (const scenario of ['clean', 'findings', 'failure']) {
  test(`public output and summary do not disclose diagnostics: ${scenario}`, async () => {
    const dir = await mkdtemp(resolve(tmpdir(), 'monitor-output-test-'));
    const summaryPath = resolve(dir, 'summary.md');
    let output = ''; let privateDir;
    try {
      const code = await main({ summaryPath, output: text => { output += text; }, run: async ({ directory }) => {
        privateDir = directory;
        const result = await command(process.execPath, ['-e', `process.stdout.write('${marker}');process.stderr.write('${marker}');process.exit(1);`], { directory, name: 'sensitive-scan' });
        assert.equal(result.status, 1);
        assert.equal((await stat(result.stdout)).mode & 0o777, 0o600);
        assert.ok((await readFile(result.stdout, 'utf8')).includes(marker));
        if (scenario === 'failure') throw new Error(marker);
        const rows = clean();
        if (scenario === 'findings') rows[0] = summarize(target, [{ severity: 'critical', title: marker }]);
        return rows;
      } });
      assert.equal(code, { clean: 0, findings: 1, failure: 2 }[scenario]);
      assert.equal(await readFile(summaryPath, 'utf8'), output);
      assert.ok(!output.includes(marker));
      await assert.rejects(stat(privateDir));
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
}
test('failure to write the public summary is not swallowed', async () => {
  await assert.rejects(main({ run: async () => clean(), output: () => {}, summaryPath: '/nonexistent-security-monitor/summary' }));
});

test('an old or partial image scan and a different image cannot be reported clean', () => {
  const report = {
    SchemaVersion: 2, ArtifactType: 'container_image', Metadata: { ImageID: 'sha256:expected', OS: { Family: 'debian' } },
    Trivy: { Version: '0.76.0' }, Results: [{ Type: 'debian' }, { Type: 'node-pkg' }],
  };
  const options = { scannerVersion: '0.76.0', imageId: 'sha256:expected', metadata: {
    Version: '0.76.0', VulnerabilityDB: { Version: 2, UpdatedAt: '2026-10-22T06:00:00Z', DownloadedAt: '2026-10-22T23:30:00Z' },
  } };
  assert.deepEqual(imageFindings(report, options, now), []);
  for (const mutation of [
    d => { d.metadata.VulnerabilityDB.UpdatedAt = '2026-10-01T00:00:00Z'; },
    d => { d.metadata.VulnerabilityDB.DownloadedAt = '2026-10-01T00:00:00Z'; },
    d => { d.metadata.Version = 'unverified-version'; },
    d => { d.imageId = 'sha256:other-image'; },
  ]) {
    const changed = structuredClone(options); mutation(changed);
    assert.throws(() => imageFindings(report, changed, now));
  }
  assert.throws(() => imageFindings({ ...report, Results: [] }, options, now));
});

test('only fixed operational error categories may appear in the public summary', () => {
  const rows = clean(); rows[2].status = 'error'; rows[2].phase = marker;
  assert.ok(!publicSummary(rows).includes(marker));
  rows[2].phase = 'scanner-permissions';
  assert.ok(publicSummary(rows).includes('error (scanner-permissions)'));
});

test('the scanner image ID comes from the exported config, not the engine manifest ID', () => {
  const digest = 'a'.repeat(64);
  for (const config of [`${digest}.json`, `blobs/sha256/${digest}`]) {
    assert.equal(archiveImageId([{ Config: config, RepoTags: ['portfolio-security-monitor:test'] }], 'portfolio-security-monitor:test'), `sha256:${digest}`);
  }
  assert.throws(() => archiveImageId([{ Config: `${digest}.json`, RepoTags: ['other:image'] }], 'portfolio-security-monitor:test'));
  assert.throws(() => archiveImageId([], 'portfolio-security-monitor:test'));
});

const decision = {
  target: 'Development image', id: 'CVE-TEST', package: 'example', version: '1.0.0',
  fixedVersion: '', reason: marker, reference: 'https://example.com/review', expires: '2999-01-01',
};
const reviewedFinding = { id: 'CVE-TEST', package: 'example', version: '1.0.0', severity: 'critical' };
test('review decisions only exclude the exact finding until expiry or a fix becomes available', async () => {
  const { applyDecisions, validateDecisions } = await import('../scripts/security-monitor/decisions.mjs');
  const entries = validateDecisions([decision]);
  const filter = (finding, date = now, target = decision.target) => applyDecisions(target, [finding], entries, date);
  assert.equal(filter(reviewedFinding).reviewed, 1);
  for (const changed of [{ id: 'CVE-NEW' }, { package: 'other' }, { version: '1.0.1' }, { fixedVersion: '1.0.2' }]) {
    assert.equal(filter({ ...reviewedFinding, ...changed }).active.length, 1);
  }
  assert.equal(filter(reviewedFinding, now, 'npm CLI components').active.length, 1);
  assert.equal(filter(reviewedFinding, new Date('2999-01-01T00:00:00Z')).active.length, 1);
  assert.equal(filter({ severity: 'critical' }).active.length, 1);
  const rows = clean(); rows[2] = summarize(decision.target, [reviewedFinding], [], entries);
  assert.equal(exitStatus(rows), 0);
  assert.equal(rows[2].reviewed, 1);
  const output = publicSummary(rows);
  assert.ok(output.includes('Reviewed exceptions'));
  for (const secret of [marker, decision.id, decision.package, decision.reference]) assert.ok(!output.includes(secret));
  rows[2].status = 'error'; assert.equal(exitStatus(rows), 2);
});
test('invalid or ambiguous review decisions are rejected', async () => {
  const { validateDecisions } = await import('../scripts/security-monitor/decisions.mjs');
  for (const changed of [{ reason: '' }, { expires: '2027-02-30' }, { reference: 'file:///tmp/review' }, { version: null }, { fixedVersion: null }, { target: 'all' }]) {
    assert.throws(() => validateDecisions([{ ...decision, ...changed }]));
  }
  assert.throws(() => validateDecisions([decision, decision]));
  assert.throws(() => validateDecisions({}));
});
test('reviewed official notices do not hide later notices or Node versions', () => {
  const target = 'Node.js official security';
  const entry = { ...decision, target, id: 'https://nodejs.org/en/blog/vulnerability/reviewed', package: 'node', version: '22.23.4' };
  const update = { id: entry.id, package: entry.package, version: entry.version };
  assert.equal(summarize(target, [], [update], [entry]).updates, 0);
  assert.equal(summarize(target, [], [{ ...update, id: `${entry.id}-new` }], [entry]).updates, 1);
  assert.equal(summarize(target, [], [{ ...update, version: '22.23.5' }], [entry]).updates, 1);
});
