const targets = ['Project dependencies', 'npm CLI components', 'Development image', 'Node.js official security'];
const fields = ['id', 'package', 'version'];
export function validateDecisions(entries) {
  if (!Array.isArray(entries)) throw new Error('Invalid review decisions');
  const keys = new Set();
  for (const entry of entries) {
    if (!entry || !targets.includes(entry.target)
        || ![...fields, 'reason', 'reference', 'expires'].every(key => typeof entry[key] === 'string' && entry[key].trim())
        || typeof entry.fixedVersion !== 'string'
        || !/^https:\/\//.test(entry.reference)
        || !/^\d{4}-\d{2}-\d{2}$/.test(entry.expires)
        || !Number.isFinite(Date.parse(entry.expires))
        || new Date(entry.expires).toISOString().slice(0, 10) !== entry.expires) throw new Error('Invalid review decision');
    const key = JSON.stringify([entry.target, ...fields.map(field => entry[field]), entry.fixedVersion]);
    if (keys.has(key)) throw new Error('Duplicate review decision');
    keys.add(key);
  }
  return entries;
}
export function applyDecisions(target, findings, entries, now = new Date()) {
  const active = []; let reviewed = 0;
  for (const finding of findings) {
    const accepted = entries.some(entry => entry.target === target
      && fields.every(field => entry[field] === finding[field])
      && entry.fixedVersion === (finding.fixedVersion || '')
      && now < new Date(`${entry.expires}T00:00:00Z`));
    if (accepted) reviewed++; else active.push(finding);
  }
  return { active, reviewed };
}
