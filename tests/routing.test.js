import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { build, transformWithEsbuild } from 'vite';

const edge = vm.createContext({});
vm.runInContext(readFileSync(new URL('../infra/functions/directory-index.js', import.meta.url), 'utf8'), edge);
const rewrite = (uri) => edge.handler({ request: { uri } }).uri;

// Compile the real TypeScript entry point; stub imports and React rendering so
// route selection runs without a browser or source-level JSX replacements.
const source = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
const { code: entry } = await transformWithEsbuild(source.replace(/^import .*;\n/gm, ''), 'main.tsx', {
  jsx: 'transform',
  jsxFactory: 'createElement',
});
const projects = ['cozyctrl', 'portfolio'].map((id) => ({ id, title: id, description: id }));
function render(pathname) {
  let result;
  vm.runInNewContext(entry, {
    window: { location: { pathname, replace: (url) => { result = { redirect: url }; } } },
    document: { getElementById: () => ({}), querySelector: () => null },
    content: { projects, brand: 'T.S' },
    App: 'home',
    ProjectPage: 'project',
    DocumentPage: 'document',
    createElement: (page, props) => ({ page, ...props, id: props?.project?.id }),
    createRoot: () => ({ render: (value) => { result = value; } }),
  });
  return result;
}

for (const { id } of projects) {
  for (const suffix of ['', '/', '/index.html']) {
    const path = `/projects/${id}${suffix}`;
    test(`detail route ${path} resolves to its HTML and renders its project`, () => {
      assert.equal(rewrite(path), `/projects/${id}/index.html`);
      assert.ok(existsSync(new URL(`../src/projects/${id}/index.html`, import.meta.url)));
      assert.equal(render(path).page, 'project');
      assert.equal(render(path).id, id);
    });
  }
}
for (const path of ['/', '/index.html']) {
  test(`home route ${path}`, () => {
    assert.equal(rewrite(path), '/index.html');
    assert.equal(render(path).page, 'home');
  });
}
for (const type of ['portfolio', 'resume']) {
  for (const suffix of ['', '/', '/index.html']) {
    const path = `/documents/${type}${suffix}`;
    test(`document route ${path} resolves to its HTML and renders the selected document`, () => {
      assert.equal(rewrite(path), `/documents/${type}/index.html`);
      assert.ok(existsSync(new URL(`../src/documents/${type}/index.html`, import.meta.url)));
      if (type === 'portfolio') {
        assert.equal(render(path).redirect, '/');
      } else {
        assert.equal(render(path).page, 'document');
      }
    });
  }
}
for (const path of ['/assets/main.js', '/assets/main.css', '/favicon.svg', '/404.html', '/diagrams/portfolio-aws.svg']) {
  test(`asset stays unchanged: ${path}`, () => assert.equal(rewrite(path), path));
}
test('unknown directories keep their missing key and do not fall back to the home page', () => {
  assert.equal(rewrite('/missing/'), '/missing/index.html');
  assert.equal(rewrite('/projects/missing/'), '/projects/missing/index.html');
  assert.equal(render('/projects/missing/').redirect, '/404.html');
  assert.equal(render('/projects/missing/index.html').redirect, '/404.html');
});
test('request method, headers and query string survive the rewrite', () => {
  const request = { uri: '/projects/cozyctrl/', method: 'HEAD', headers: { host: { value: 'example.com' } }, querystring: { ref: { value: 'card' } } };
  const result = edge.handler({ request });
  assert.strictEqual(result, request);
  assert.equal(result.method, 'HEAD');
  assert.equal(result.headers.host.value, 'example.com');
  assert.equal(result.querystring.ref.value, 'card');
});

// Build in memory so the check exercises Vite's actual HTML/CSS processing
// without relying on, or replacing, an existing site/ build.
test('built 404 page references emitted CSS instead of an unprocessed source path', async () => {
  const result = await build({
    configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
    logLevel: 'silent',
    build: { write: false },
  });
  const files = (Array.isArray(result) ? result : [result]).flatMap((bundle) => bundle.output);
  const page = files.find((file) => file.type === 'asset' && file.fileName === '404.html');
  assert.ok(page, '404.html must be processed as a Vite HTML entry');
  const html = Buffer.from(page.source).toString('utf8');
  const stylesheets = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)];
  assert.ok(stylesheets.length > 0, '404.html must load a stylesheet');
  for (const [, href] of stylesheets) {
    assert.match(href, /^\/assets\/.+\.css$/);
    assert.ok(files.some((file) => file.type === 'asset' && file.fileName === href.slice(1)),
      `stylesheet ${href} must exist in the build output`);
  }
  assert.equal(rewrite('/404.html'), '/404.html');
});
