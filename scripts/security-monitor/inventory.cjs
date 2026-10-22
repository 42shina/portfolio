// Executed inside the actual development image. Its output is captured privately
// by monitor.mjs and is never forwarded to Actions logs or artifacts.
const { readFileSync, readdirSync, existsSync } = require('node:fs');
const { createRequire } = require('node:module');
const npmRoot = require('node:path').join(require('node:child_process').execFileSync('npm', ['root', '-g'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(), 'npm');
const npmRequire = createRequire(`${npmRoot}/package.json`);
const semver = npmRequire('semver');
const packages = [];
function walk(directory) {
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const path = `${directory}/${entry.name}`;
    if (entry.name.startsWith('@')) { walk(path); continue; }
    if (!existsSync(`${path}/package.json`)) continue;
    const pkg = JSON.parse(readFileSync(`${path}/package.json`, 'utf8'));
    if (!pkg.name || !semver.valid(pkg.version)) throw new Error('Invalid package inventory');
    packages.push({ name: pkg.name, version: pkg.version });
    walk(`${path}/node_modules`);
  }
}
packages.push({ name: 'npm', version: npmRequire('./package.json').version });
walk(`${npmRoot}/node_modules`);

function inspectNode(data, version, now = new Date()) {
  if (!semver.valid(version) || !data.core || typeof data.core !== 'object' || Array.isArray(data.core)) throw new Error('Invalid Node advisory data');
  const findings = [];
  const updates = [];
  const entries = Object.values(data.core);
  if (!entries.length) throw new Error('Empty Node advisory data');
  for (const advisory of entries) {
    if (advisory.affectedEnvironments && !advisory.affectedEnvironments.some(x => ['all', 'linux'].includes(x))) continue;
    if (!semver.validRange(advisory.vulnerable) || (advisory.patched && !semver.validRange(advisory.patched))) throw new Error('Unknown Node advisory range');
    if (semver.satisfies(version, advisory.vulnerable) && !(advisory.patched && semver.satisfies(version, advisory.patched))) {
      findings.push({ severity: advisory.severity || 'unknown', advisory });
    }
  }
  if (!Array.isArray(data.releases) || !data.releases.length || !data.releases.every(x => semver.valid(x.version) && /^\d{4}-\d\d-\d\d$/.test(x.date))) throw new Error('Invalid Node releases');
  const major = semver.major(version);
  const branch = data.releases.filter(x => semver.major(x.version) === major);
  const security = branch.filter(x => x.security === true).sort((a, b) => semver.rcompare(a.version, b.version));
  if (!security.length) throw new Error('No Node security release history');
  if (semver.gt(security[0].version, version)) updates.push({ kind: 'security-release', version: security[0].version });
  const schedule = data.schedule[`v${major}`];
  if (!schedule || !/^\d{4}-\d\d-\d\d$/.test(schedule.end)) throw new Error('Unknown Node support schedule');
  if (now >= new Date(`${schedule.end}T00:00:00Z`)) updates.push({ kind: 'end-of-life', date: schedule.end });
  // Core DB updates can lag releases. Also watch official pre-announcements.
  // This is a conservative review signal, not a claim that this branch is affected.
  const items = [...data.feed.matchAll(/<item>([\s\S]*?)<\/item>/g)];
  if (!items.length) throw new Error('Invalid Node security RSS');
  for (const [, item] of items) {
    const title = item.match(/<title>([\s\S]*?)<\/title>/)?.[1];
    const date = new Date(item.match(/<pubDate>([^<]+)<\/pubDate>/)?.[1]);
    const link = item.match(/<link>([^<]+)<\/link>/)?.[1];
    if (!title || !Number.isFinite(date.getTime()) || !link?.startsWith('https://nodejs.org/')) throw new Error('Invalid Node security RSS item');
    if (/security release/i.test(title) && date.toISOString().slice(0, 10) > security[0].date && now - date < 30 * 86400000 && date <= now) updates.push({ kind: 'official-notice', title, link });
  }
  return { findings, updates };
}
if (require.main === module || process.argv[1] === undefined) {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  let node;
  try { node = { ok: true, ...inspectNode(input, process.versions.node) }; }
  catch (error) { node = { ok: false, reason: error.message }; }
  process.stdout.write(JSON.stringify({ nodeVersion: process.versions.node, npmVersion: npmRequire('./package.json').version, packages, node }));
}
module.exports = { inspectNode };
