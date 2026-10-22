import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import test from 'node:test';
import { command, emptyResult, exitStatus, imageFindings, main, projectFindings, publicSummary, summarize, validateToolchain } from '../scripts/security-monitor/monitor.mjs';
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

test('an old, unvalidated or partial image database cannot be reported clean', () => {
  const report = {
    matches: [], source: { type: 'image' }, descriptor: { version: '0.120.1',
      db: { status: { built: '2026-10-22T06:00:00Z', valid: true }, providers: { debian: {}, github: {}, nvd: {} } },
      configuration: { db: { 'require-update-check': true, 'validate-age': true, 'max-allowed-built-age': 48 * 3600 * 1e9 } },
    },
  };
  assert.deepEqual(imageFindings(report, '0.120.1', now), []);
  for (const mutation of [
    d => { d.descriptor.db.status.built = '2026-10-01T00:00:00Z'; },
    d => { d.descriptor.db.status.valid = false; },
    d => { delete d.descriptor.db.providers.github; },
    d => { d.descriptor.configuration.db['require-update-check'] = false; },
    d => { d.descriptor.version = 'unverified-version'; },
  ]) {
    const changed = structuredClone(report); mutation(changed);
    assert.throws(() => imageFindings(changed, '0.120.1', now));
  }
});
