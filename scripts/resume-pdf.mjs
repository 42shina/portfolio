#!/usr/bin/env node
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { parseArgs, parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { projectRoot, renderResume, validateIdentity } from './resume-render.mjs';

// Resolve existing ancestors so a symlink cannot send a private PDF into site/public.
export async function privateOutputPath(path) {
  const output = resolve(path);
  let ancestor = output;
  const suffix = [];
  while (true) {
    try {
      ancestor = await realpath(ancestor);
      break;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      suffix.unshift(relative(dirname(ancestor), ancestor));
      const parent = dirname(ancestor);
      if (parent === ancestor) throw error;
      ancestor = parent;
    }
  }
  const canonical = resolve(ancestor, ...suffix);
  const root = await realpath(projectRoot);
  const withinRoot = relative(root, canonical);
  const inside = withinRoot === '' || (!withinRoot.startsWith(`..${sep}`) && withinRoot !== '..' && !isAbsolute(withinRoot));
  if (inside && !withinRoot.startsWith(`.private${sep}`)) {
    throw new Error('リポジトリ内の出力先は .private/ 配下を指定してください。公開用ディレクトリには保存できません。');
  }
  if (!canonical.toLowerCase().endsWith('.pdf')) throw new Error('出力先には .pdf ファイルを指定してください。');
  return canonical;
}

// Keep private values local; do not add them to process.env or Vite client data.
export async function readIdentity(values = {}, environment = process.env) {
  let envFile = {};
  try {
    envFile = parseEnv(await readFile(values['env-file']
      ? resolve(values['env-file']) : resolve(projectRoot, '.env'), 'utf8'));
  } catch (error) {
    if (values['env-file'] || error.code !== 'ENOENT') {
      throw new Error('.envファイルを読み込めません。パスと読み取り権限を確認してください。');
    }
  }
  let profile = {};
  if (values.profile) {
    try { profile = JSON.parse(await readFile(resolve(values.profile), 'utf8')); }
    catch { throw new Error('設定ファイルを読み込めません。パスとJSON形式を確認してください。'); }
  }
  return validateIdentity({
    name: values.name ?? profile?.name ?? environment.RESUME_NAME ?? envFile.RESUME_NAME,
    email: values.email ?? profile?.email ?? environment.RESUME_EMAIL ?? envFile.RESUME_EMAIL,
  });
}

async function main() {
  const { values } = parseArgs({ options: {
    name: { type: 'string' }, email: { type: 'string' }, profile: { type: 'string' },
    'env-file': { type: 'string' },
    output: { type: 'string', default: '.private/resume.pdf' },
    browser: { type: 'string' },
    force: { type: 'boolean' }, // Accept the old flag for compatibility; overwrite is now the default.
    help: { type: 'boolean', short: 'h' },
  } });
  if (values.help) {
    console.log(`職務経歴書PDFをローカル生成します（Node.js 22以上）。

npm run resume:pdf
npm run resume:pdf -- --env-file .private/resume.env

.env の RESUME_NAME / RESUME_EMAIL を読み込みます。
--name / --email または --profile .private/resume.json も使用できます。

--env-file PATH 読み込む.envファイル（既定: リポジトリ直下の.env）
--output PATH  保存先（既定: .private/resume.pdf）
--browser PATH インストール済みChrome/Chromiumの実行ファイル

既存のPDFは常に上書きします。
設定ファイル: { "name": "氏名", "email": "name@example.com" }
優先順位: CLI引数 > JSON設定 > シェル環境変数 > .env。
個人情報の変数名に VITE_ は付けないでください。
初回は npx playwright install chromium を実行してください。
Linuxで必要な場合は npx playwright install --with-deps chromium を使います。`);
    return;
  }
  const identity = await readIdentity(values);
  const output = await privateOutputPath(values.output);
  const html = await renderResume(identity);
  let browser;
  try {
    browser = await chromium.launch({
      ...(values.browser ? { executablePath: resolve(values.browser) } : {}),
    });
  } catch {
    throw new Error('Chrome/Chromiumを起動できません。npx playwright install chromium を実行するか、--browser で実行ファイルを指定してください。Linuxでは --with-deps が必要な場合があります。');
  }
  let pdf;
  try {
    const page = await browser.newPage({ javaScriptEnabled: false, serviceWorkers: 'block' });
    await page.route('**/*', (route) => route.abort());
    await page.setContent(html);
    await page.emulateMedia({ media: 'print' });
    await page.evaluate(() => document.fonts.ready);
    pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false });
  } finally { await browser.close(); }
  await mkdir(dirname(output), { recursive: true, mode: 0o700 });
  try {
    await writeFile(output, pdf, { flag: 'w', mode: 0o600 });
  } catch {
    throw new Error('PDFを保存できません。出力先の権限を確認してください。');
  }
  console.log('職務経歴書PDFを保存しました。');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    // Avoid printing raw parser/profile/browser errors that can contain private values.
    console.error(error.code?.startsWith('ERR_PARSE_ARGS')
      ? '引数を確認してください。--help で使い方を表示できます。'
      : error.message);
    process.exitCode = 1;
  });
}
