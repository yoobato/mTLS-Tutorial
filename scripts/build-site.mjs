import { readFile, writeFile, mkdir, readdir, rm, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';
import { Marked } from 'marked';
import Prism from 'prismjs';
import loadLanguages from 'prismjs/components/index.js';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'site-dist');
const chapters = [
  ['01-overview.md', '', 'mTLS 개요'],
  ['02-environment.md', 'environment', '실습 안내'],
  ['03-certificates.md', 'certificates', '테스트 인증서 생성'],
  ['04-webservers.md', 'webservers', '웹서버 설정'],
  ['05-testing.md', 'testing', 'cURL을 이용한 검증'],
  ['06-references.md', 'references', '참고문서'],
];
loadLanguages(['bash', 'nginx', 'apacheconf', 'ini']);
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const template = await readFile(path.join(root, 'site/template.html'), 'utf8');
await rm(out, {recursive: true, force: true});
await mkdir(path.join(out, 'assets'), {recursive: true});
for (const [index, [filename, route]] of chapters.entries()) {
  const markdown = await readFile(path.join(root, 'docs', filename), 'utf8');
  const base = route ? '../' : './';
  const href = other => `${base}${other ? other + '/' : ''}`;
  const toc = [];
  const ids = new Map();
  const parser = new Marked({gfm: true});
  parser.use({renderer: {
    heading({tokens, depth}) {
      const html = this.parser.parseInline(tokens);
      const label = html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
      const slug = label.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-');
      const count = ids.get(slug) || 0; ids.set(slug, count + 1);
      const id = count ? `${slug}-${count}` : slug;
      if (depth === 2) toc.push({id, label});
      return `<h${depth} id="${escape(id)}">${html}</h${depth}>\n`;
    },
    code({text, lang}) {
      const language = (lang || 'text').split(/\s+/)[0];
      if (language === 'mermaid') return `<div class="mermaid-diagram" role="img" aria-label="mTLS 검증 흐름" aria-busy="true">${escape(text)}</div>\n`;
      const grammar = Prism.languages[language];
      const code = grammar ? Prism.highlight(text, grammar, language) : escape(text);
      return `<div class="code-block"><div class="code-bar"><span>${escape(language)}</span><button class="copy-code" type="button" aria-label="코드 복사">복사</button></div><pre tabindex="0"><code>${code}</code></pre></div>\n`;
    },
  }});
  const title = parser.lexer(markdown).find(token => token.type === 'heading' && token.depth === 1)?.text;
  if (!title) throw new Error(`Expected a Markdown h1 in ${filename}`);
  let content = parser.parse(markdown);
  content = content.replace(/<table>/g, '<div class="table-scroll" tabindex="0"><table>').replace(/<\/table>/g, '</table></div>');
  const navigation = chapters.map(([, other, label], i) => `<a href="${href(other)}"${i === index ? ' aria-current="page"' : ''}><span>${String(i + 1).padStart(2, '0')}</span>${escape(label)}</a>`).join('\n');
  const pagination = [index > 0 ? `<a href="${href(chapters[index - 1][1])}"><span>이전</span>← ${escape(chapters[index - 1][2])}</a>` : '', index < chapters.length - 1 ? `<a href="${href(chapters[index + 1][1])}"><span>다음</span>${escape(chapters[index + 1][2])} →</a>` : ''].join('');
  const values = {title: escape(title), base, filename, navigation, content, pagination, toc: toc.map(({id, label}) => `<a href="#${encodeURIComponent(id)}">${escape(label)}</a>`).join('\n')};
  const html = template.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? '');
  const folder = path.join(out, route);
  await mkdir(folder, {recursive: true});
  await writeFile(path.join(folder, 'index.html'), html);
}
await copyFile(path.join(root, 'site/assets/certificate.svg'), path.join(out, 'assets/certificate.svg'));
for (const filename of ['styles.css', 'app.js']) await copyFile(path.join(root, 'site', filename), path.join(out, filename));
// Copy browser-ready Mermaid modules only; avoid source maps and development bundles.
const mermaidRoot = path.dirname(require.resolve('mermaid/package.json'));
await mkdir(path.join(out, 'vendor/mermaid/chunks/mermaid.esm.min'), {recursive: true});
await copyFile(path.join(mermaidRoot, 'dist/mermaid.esm.min.mjs'), path.join(out, 'vendor/mermaid/mermaid.esm.min.mjs'));
const chunks = path.join(mermaidRoot, 'dist/chunks/mermaid.esm.min');
for (const filename of await readdir(chunks)) {
  if (filename.endsWith('.mjs')) await copyFile(path.join(chunks, filename), path.join(out, 'vendor/mermaid/chunks/mermaid.esm.min', filename));
}
await mkdir(path.join(out, 'vendor/licenses'), {recursive: true});
for (const name of ['marked', 'prismjs', 'mermaid']) {
  const folder = path.dirname(require.resolve(`${name}/package.json`));
  const license = (await readdir(folder)).find(name => /^license(?:\.md|\.txt)?$/i.test(name));
  if (license) await copyFile(path.join(folder, license), path.join(out, 'vendor/licenses', `${name}.txt`));
}
await writeFile(path.join(out, '.nojekyll'), '');
console.log(`Built ${chapters.length} Markdown pages → ${out}`);
