import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { projectRoot, renderResume, validateIdentity } from '../scripts/resume-render.mjs';
import { privateOutputPath, readIdentity } from '../scripts/resume-pdf.mjs';

const identity = { name: '非公開テスト太郎 <script>alert(1)</script>', email: 'private-resume-test@example.invalid' };

test('private identity replaces only the document name and email, with HTML escaping', async () => {
  const html = await renderResume(identity);
  assert.ok(html.includes('非公開テスト太郎 &lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes(`href="mailto:${identity.email}"`));
  assert.ok(!html.includes('mailto:4242shinashina@gmail.com'));
  assert.ok(html.includes('https://github.com/42shina'));
  assert.ok(html.includes('職務要約'));
  assert.ok(html.includes('15mm'));
  assert.ok(!html.includes('class="document-toolbar"'));
  assert.ok(!html.includes('<script>'));
});

test('missing names and invalid email addresses cannot silently use public identity', () => {
  for (const value of [{ email: identity.email }, { name: '太郎' }, { name: '太郎', email: 'javascript:alert(1)' }, { name: '\n太郎', email: identity.email }]) {
    assert.throws(() => validateIdentity(value));
  }
  assert.deepEqual(validateIdentity({ name: ' 太郎 ', email: ' user@example.com ' }), { name: '太郎', email: 'user@example.com' });
});

test('private PDFs cannot be written to public or tracked project directories', async () => {
  assert.equal(await privateOutputPath(resolve(projectRoot, '.private/resume.pdf')), resolve(projectRoot, '.private/resume.pdf'));
  for (const path of ['site/resume.pdf', 'public/resume.pdf', 'src/resume.pdf', 'resume.pdf', '.private/../site/resume.pdf', '.private/resume.html']) {
    await assert.rejects(privateOutputPath(resolve(projectRoot, path)));
  }
});

test('symlinks cannot redirect private PDF output into the public directory', async () => {
  const dir = await mkdtemp(resolve(projectRoot, '.private-path-test-'));
  try {
    await mkdir(resolve(dir, 'local'));
    await symlink(resolve(projectRoot, 'public'), resolve(dir, 'local/public-link'), process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(privateOutputPath(resolve(dir, 'local/public-link/resume.pdf')));
  } finally { await rm(dir, { recursive: true, force: true }); }
});


test('.env supports Japanese names, quoted spaces and comments without changing process.env', async () => {
  const dir = await mkdtemp(resolve(tmpdir(), 'resume-env-test-'));
  const previous = { name: process.env.RESUME_NAME, email: process.env.RESUME_EMAIL };
  try {
    const envPath = resolve(dir, 'resume.env');
    await writeFile(envPath, '# Private identity\nRESUME_NAME="非公開 env 太郎 #氏名"\nRESUME_EMAIL="env-private-test@example.invalid" # comment\n');
    assert.deepEqual(await readIdentity({ 'env-file': envPath }, {}), {
      name: '非公開 env 太郎 #氏名', email: 'env-private-test@example.invalid',
    });
    assert.equal(process.env.RESUME_NAME, previous.name);
    assert.equal(process.env.RESUME_EMAIL, previous.email);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('CLI, JSON, shell and .env precedence is applied separately to each identity field', async () => {
  const dir = await mkdtemp(resolve(tmpdir(), 'resume-env-test-'));
  try {
    const envPath = resolve(dir, 'resume.env');
    const profilePath = resolve(dir, 'resume.json');
    await writeFile(envPath, 'RESUME_NAME="env name"\nRESUME_EMAIL="env@example.invalid"\n');
    await writeFile(profilePath, JSON.stringify({ name: 'profile name' }));
    const shell = { RESUME_NAME: 'shell name', RESUME_EMAIL: 'shell@example.invalid' };
    const values = { 'env-file': envPath, profile: profilePath, email: 'cli@example.invalid' };
    assert.deepEqual(await readIdentity(values, shell), { name: 'profile name', email: 'cli@example.invalid' });
    assert.deepEqual(await readIdentity({ 'env-file': envPath }, shell), { name: 'shell name', email: 'shell@example.invalid' });
    assert.deepEqual(await readIdentity({ ...values, name: 'cli name' }, shell), { name: 'cli name', email: 'cli@example.invalid' });
    await writeFile(envPath, 'RESUME_NAME=""\nRESUME_EMAIL=""\n');
    await assert.rejects(readIdentity({ 'env-file': envPath }, {}), /RESUME_NAME/);
    await assert.rejects(readIdentity({ 'env-file': resolve(dir, 'missing.env') }, {}), /読み込めません/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});


test('concurrent PDF renders keep identities separate and clean up temporary caches', async () => {
  const caches = async () => new Set((await readdir(tmpdir())).filter((name) => name.startsWith('portfolio-resume-')));
  const before = await caches();
  const values = [
    { name: '一人目の氏名', email: 'first@example.invalid' },
    { name: '二人目の氏名', email: 'second@example.invalid' },
  ];
  const htmls = await Promise.all(values.map(renderResume));
  for (let i = 0; i < values.length; i++) {
    assert.ok(htmls[i].includes(values[i].email));
    assert.ok(!htmls[i].includes(values[1 - i].email));
  }
  assert.deepEqual(await caches(), before);
});
