import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, appendFile, rm, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const levels = ['critical', 'high', 'moderate', 'low', 'unknown'];
const phases = ['image-export', 'scanner-execution', 'scanner-permissions', 'scanner-database', 'scanner-storage', 'report-read', 'report-validation'];
const targets = ['Project dependencies', 'npm CLI components', 'Development image', 'Node.js official security'];
const normalize = severity => {
  const value = String(severity).toLowerCase();
  return value === 'medium' ? 'moderate' : ['negligible', 'info'].includes(value) ? 'low' : levels.includes(value) ? value : 'unknown';
};
export const emptyResult = () => targets.map(target => ({ target, status: 'error', counts: Object.fromEntries(levels.map(x => [x, 0])), updates: 0 }));
export function summarize(target, findings, updates = []) {
  const row = { target, status: 'ok', counts: Object.fromEntries(levels.map(x => [x, 0])), updates: updates.length };
  for (const finding of findings) row.counts[normalize(finding.severity)]++;
  return row;
}
export function exitStatus(rows) {
  if (rows.some(row => row.status !== 'ok')) return 2;
  return rows.some(row => row.counts.high || row.counts.critical || row.counts.unknown || row.updates) ? 1 : 0;
}
export function publicSummary(rows) {
  // Only fixed labels, enumerated status and integers can cross this boundary.
  const integer = n => Number.isSafeInteger(n) && n >= 0 ? n : 0;
  const code = exitStatus(rows);
  const lines = ['## Security monitor', '', code === 2 ? 'Result: monitoring error (checks incomplete).' : code === 1 ? 'Result: findings or security updates require review.' : 'Result: checks completed; no blocking findings.', '', '| Target | Critical | High | Moderate | Low | Unknown | Update/review signals | Check |', '| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |'];
  for (const target of targets) {
    const row = rows.find(x => x.target === target);
    lines.push(`| ${target} | ${levels.map(level => integer(row?.counts?.[level])).join(' | ')} | ${integer(row?.updates)} | ${row?.status === 'ok' ? 'complete' : phases.includes(row?.phase) ? `error (${row.phase})` : 'error'} |`);
  }
  lines.push('', 'Exit 1: findings/update signals. Exit 2: monitoring error. Details are not published.');
  return lines.join('\n') + '\n';
}
export function validateToolchain(nodeVersion, npmVersion, dockerfile, inventory) {
  const from = dockerfile.match(/^FROM\s+node:([0-9]+\.[0-9]+\.[0-9]+)-bookworm-slim\s*$/m);
  if (!from || from[1] !== nodeVersion || inventory.nodeVersion !== nodeVersion || inventory.npmVersion !== npmVersion || !inventory.packages?.length) throw new Error('Toolchain mismatch');
}
export async function command(executable, args, { directory, name, input, cwd = projectRoot, timeout = 600000 } = {}) {
  // All child output, including network/auth/parser errors, remains private.
  const stdout = resolve(directory, `${name}.stdout`);
  const stderr = resolve(directory, `${name}.stderr`);
  const { open } = await import('node:fs/promises');
  const out = await open(stdout, 'w', 0o600); const err = await open(stderr, 'w', 0o600);
  try {
    return await new Promise((accept, reject) => {
      const child = spawn(executable, args, { cwd, stdio: ['pipe', out.fd, err.fd], env: { ...process.env, DOCKER_CLI_HINTS: 'false', NPM_CONFIG_UPDATE_NOTIFIER: 'false' } });
      let timer = setTimeout(() => { child.kill('SIGKILL'); }, timeout);
      child.on('error', () => { clearTimeout(timer); reject(new Error('Private command failed')); });
      child.on('close', (status, signal) => { clearTimeout(timer); accept({ status, signal, stdout, stderr }); });
      child.stdin.on('error', () => {}); child.stdin.end(input);
    });
  } finally { await out.close(); await err.close(); }
}
export function projectFindings(report) {
  if (report.auditReportVersion !== 2 || report.error || !report.vulnerabilities || typeof report.vulnerabilities !== 'object' || Array.isArray(report.vulnerabilities) || !report.metadata?.vulnerabilities) throw new Error('Invalid audit response');
  const values = Object.values(report.vulnerabilities);
  if (!Number.isSafeInteger(report.metadata.vulnerabilities.total) || report.metadata.vulnerabilities.total !== values.length) throw new Error('Incomplete audit response');
  return values.map(finding => {
    if (!levels.includes(finding.severity)) throw new Error('Unknown audit severity');
    return { severity: finding.severity };
  });
}
export function imageFindings(report, scannerVersion, now = new Date()) {
  const status = report.descriptor?.db?.status;
  const db = report.descriptor?.configuration?.db;
  const providers = report.descriptor?.db?.providers;
  const built = new Date(status?.built).getTime();
  if (!Array.isArray(report.matches) || report.source?.type !== 'image' || report.descriptor?.version !== scannerVersion
      || status?.valid !== true || !Number.isFinite(built) || now - built > 48 * 3600000 || built - now > 3600000
      || db?.['require-update-check'] !== true || db?.['validate-age'] !== true
      || !(db?.['max-allowed-built-age'] > 0 && db['max-allowed-built-age'] <= 48 * 3600 * 1e9)
      || !providers?.debian || !providers?.github || !providers?.nvd) throw new Error('Incomplete or stale image scan');
  return report.matches.map(match => ({ severity: match.vulnerability.severity }));
}
async function fetchData(url, { json = true, body } = {}) {
  const response = await fetch(url, { method: body ? 'POST' : 'GET', headers: body ? { 'content-type': 'application/json' } : {}, body: body && JSON.stringify(body), signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error('Private data source failed');
  return json ? response.json() : response.text();
}
export async function runChecks({ directory, execute = command, get = fetchData } = {}) {
  const rows = emptyResult();
  const config = JSON.parse(await readFile(resolve(projectRoot, 'scripts/security-monitor/config.json'), 'utf8'));
  const pkg = JSON.parse(await readFile(resolve(projectRoot, 'package.json'), 'utf8'));
  const nodeVersion = (await readFile(resolve(projectRoot, '.node-version'), 'utf8')).trim();
  const npmVersion = pkg.packageManager.match(/^npm@(\d+\.\d+\.\d+)$/)?.[1];
  const dockerfile = await readFile(resolve(projectRoot, 'Dockerfile'), 'utf8');
  const image = `portfolio-security-monitor:${randomUUID()}`;
  const opts = name => ({ directory, name });
  const successful = async (exe, args, options) => {
    const r = await execute(exe, args, options);
    if (r.status !== 0 || r.signal) throw new Error('Private operation failed');
    return r;
  };
  try {
    // Audit the lockfile without installing project dependencies or their scripts.
    await successful('npm', ['install', '--global', `npm@${npmVersion}`, '--ignore-scripts', '--no-audit', '--no-fund'], opts('npm-toolchain'));
    const version = await successful('npm', ['--version'], opts('npm-version'));
    if ((await readFile(version.stdout, 'utf8')).trim() !== npmVersion) throw new Error('Unexpected npm');
    const r = await execute('npm', ['audit', '--package-lock-only', '--ignore-scripts', '--json'], opts('project-audit'));
    if (![0, 1].includes(r.status) || r.signal) throw new Error('Private project scan failed');
    rows[0] = summarize(targets[0], projectFindings(JSON.parse(await readFile(r.stdout, 'utf8'))));
  } catch { /* Error status is intentionally generic in the public report. */ }

  let inventory;
  let imageReady = false;
  try {
    await successful('docker', ['build', '--pull', '--tag', image, '.'], opts('image-build'));
    imageReady = true;
    const data = {};
    // A failed official source is a monitor failure, never a clean Node result.
    try {
      [data.core, data.releases, data.schedule, data.feed] = await Promise.all([
        get(config.coreAdvisories), get(config.nodeReleases), get(config.nodeSchedule), get(config.nodeSecurityFeed, { json: false }),
      ]);
    } catch { data.unavailable = true; }
    await writeFile(resolve(directory, 'node-sources.json'), JSON.stringify(data), { mode: 0o600 });
    const input = await readFile(resolve(projectRoot, 'scripts/security-monitor/inventory.cjs'), 'utf8');
    // No source tree, credentials, Docker socket, or host .env is mounted here.
    const r = await successful('docker', ['run', '--rm', '-i', '--network=none', image, 'node', '-e', input], { ...opts('inventory'), input: JSON.stringify(data) });
    inventory = JSON.parse(await readFile(r.stdout, 'utf8'));
    validateToolchain(nodeVersion, npmVersion, dockerfile, inventory);
    if (inventory.node.ok) rows[3] = summarize(targets[3], inventory.node.findings, inventory.node.updates);
  } catch { inventory = undefined; }

  if (inventory) {
    try {
      const payload = {};
      for (const p of inventory.packages) { payload[p.name] ??= []; if (!payload[p.name].includes(p.version)) payload[p.name].push(p.version); }
      const advisories = await get('https://registry.npmjs.org/-/npm/v1/security/advisories/bulk', { body: payload });
      if (!advisories || typeof advisories !== 'object' || Array.isArray(advisories)) throw new Error('Invalid advisory response');
      await writeFile(resolve(directory, 'npm-components.json'), JSON.stringify(advisories), { mode: 0o600 });
      // Evaluate ranges with the semver implementation bundled in the scanned npm.
      const script = `const fs=require('node:fs');const semver=require('/usr/local/lib/node_modules/npm/node_modules/semver');const {packages,advisories}=JSON.parse(fs.readFileSync(0,'utf8'));const findings=[];for(const [name,items] of Object.entries(advisories)){if(!Array.isArray(items))throw Error();for(const a of items){if(!semver.validRange(a.vulnerable_versions))throw Error();if(packages.some(p=>p.name===name&&semver.satisfies(p.version,a.vulnerable_versions)))findings.push({severity:a.severity});}}process.stdout.write(JSON.stringify(findings));`;
      const r = await successful('docker', ['run', '--rm', '--network=none', '-i', image, 'node', '-e', script], { ...opts('component-ranges'), input: JSON.stringify({ packages: inventory.packages, advisories }) });
      rows[1] = summarize(targets[1], JSON.parse(await readFile(r.stdout, 'utf8')));
    } catch { /* Preserve the component check's error state. */ }
  }
  if (imageReady) {
    let phase = 'image-export';
    try {
      const imageDir = resolve(directory, 'image'); await mkdir(imageDir, { mode: 0o700 });
      await successful('docker', ['save', '--output', resolve(imageDir, 'image.tar'), image], opts('image-save'));
      phase = 'scanner-execution';
      await successful('docker', ['run', '--rm', '--user', `${process.getuid()}:${process.getgid()}`, '--volume', `${imageDir}:/scan`, '--env', 'GRYPE_DB_CACHE_DIR=/scan/db', '--env', 'GRYPE_DB_MAX_ALLOWED_BUILT_AGE=48h', '--env', 'GRYPE_DB_VALIDATE_AGE=true', '--env', 'GRYPE_DB_REQUIRE_UPDATE_CHECK=true', config.scannerImage, 'docker-archive:/scan/image.tar', '--output', 'json', '--file', '/scan/report.json', '--quiet'], opts('image-scan'));
      phase = 'report-read';
      const report = JSON.parse(await readFile(resolve(imageDir, 'report.json'), 'utf8'));
      phase = 'report-validation';
      rows[2] = summarize(targets[2], imageFindings(report, config.scannerVersion));
    } catch {
      if (phase === 'scanner-execution') {
        const error = await readFile(resolve(directory, 'image-scan.stderr'), 'utf8').catch(() => '');
        if (/permission denied/i.test(error)) phase = 'scanner-permissions';
        else if (/no space left/i.test(error)) phase = 'scanner-storage';
        else if (/database|download|update|rate.?limit|429/i.test(error)) phase = 'scanner-database';
      }
      rows[2].phase = phase;
    }
  }
  await execute('docker', ['image', 'rm', image], opts('image-cleanup')).catch(() => {});
  return rows;
}
export async function main({ run = runChecks, output = text => process.stdout.write(text), summaryPath = process.env.GITHUB_STEP_SUMMARY } = {}) {
  process.umask(0o077);
  const directory = await mkdtemp(resolve(process.env.RUNNER_TEMP || tmpdir(), 'portfolio-security-'));
  await chmod(directory, 0o700);
  let rows = emptyResult();
  try {
    try { rows = await run({ directory }); } catch { /* Only a generic failure crosses the output boundary. */ }
    const summary = publicSummary(rows);
    output(summary);
    if (summaryPath) await appendFile(summaryPath, summary, { mode: 0o600 });
    return exitStatus(rows);
  } finally { await rm(directory, { recursive: true, force: true }); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(code => { process.exitCode = code; }).catch(() => {
    process.stdout.write('Security monitor failed. Private diagnostic output was suppressed.\n');
    process.exitCode = 2;
  });
}
