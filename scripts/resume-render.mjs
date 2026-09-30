import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function validateIdentity({ name, email } = {}) {
  if (typeof name !== 'string' || !name.trim() || /[\r\n\x00]/.test(name)) {
    throw new Error('氏名を.envの RESUME_NAME、--name または設定ファイルの name で指定してください。');
  }
  if (typeof email !== 'string' || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email.trim())) {
    throw new Error('有効なメールアドレスを.envの RESUME_EMAIL、--email または設定ファイルの email で指定してください。');
  }
  return { name: name.trim(), email: email.trim() };
}

// Load the existing document in memory without building or serving a private site.
export async function renderResume(identity) {
  identity = validateIdentity(identity);
  // Docker's development cache can belong to root. Each PDF render gets its
  // own writable cache, also keeping concurrent CLI runs independent.
  const cacheDir = await mkdtemp(resolve(tmpdir(), 'portfolio-resume-'));
  let server;
  try {
    server = await createServer({
      configFile: false,
      root: projectRoot,
      cacheDir,
      // SSR does not need the browser dependency optimizer or its background writes.
      optimizeDeps: { noDiscovery: true, include: [] },
      appType: 'custom',
      logLevel: 'silent',
      server: { middlewareMode: true, hmr: false },
      esbuild: { jsx: 'automatic' },
    });
    const { default: DocumentPage } = await server.ssrLoadModule('/src/components/DocumentPage.jsx');
    const styles = await Promise.all(['src/styles.css', 'src/components/documents.css']
      .map((path) => readFile(resolve(projectRoot, path), 'utf8')));
    return '<!doctype html>' + renderToStaticMarkup(createElement('html', { lang: 'ja' },
      createElement('head', null,
        createElement('meta', { charSet: 'utf-8' }),
        createElement('title', null, '職務経歴書'),
        createElement('style', { dangerouslySetInnerHTML: { __html: styles.join('\n') } })),
      createElement('body', null, createElement(DocumentPage, { identity, printOnly: true }))));
  } finally {
    try { await server?.close(); }
    finally { await rm(cacheDir, { recursive: true, force: true }); }
  }
}
