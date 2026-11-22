import { readFile, writeFile, mkdir, readdir, rm, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';
import { Marked } from 'marked';
import Prism from 'prismjs';
import loadLanguages from 'prismjs/components/index.js';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(root, process.env.DOCS_OUTPUT_DIR || 'site-dist');
const metadata = JSON.parse(await readFile(path.join(root, 'site/metadata.json'), 'utf8'));
const siteUrl = new URL(metadata.siteUrl.endsWith('/') ? metadata.siteUrl : `${metadata.siteUrl}/`);
const pageUrl = (prefix, route) => new URL([prefix, route].filter(Boolean).join('/') + (prefix || route ? '/' : ''), siteUrl).href;
const imageUrl = new URL(metadata.image, siteUrl).href;
const sitemapUrls = [];
const chapters = [
  ['01-overview.md', '', '튜토리얼 개요', 'Overview'],
  ['02-environment.md', 'environment', '사전 준비사항', 'Prerequisites'],
  ['03-certificates.md', 'certificates', '테스트 인증서 생성', 'Test Certificates'],
  ['04-webservers.md', 'webservers', '웹서버 설정', 'Web Server Configuration'],
  ['05-testing.md', 'testing', 'cURL을 이용한 검증', 'Testing with cURL'],
  ['06-references.md', 'references', '참고문서', 'References'],
];
const locales = [
  {lang: 'ko', source: '', prefix: 'ko', labelIndex: 2, skip: '본문으로 건너뛰기', languageLabel: '언어 선택', contents: '목차', contentsLabel: '문서 목차', onThisPage: '이 페이지에서', paginationLabel: '이전 및 다음 문서', previous: '이전', next: '다음', repositoryLabel: 'GitHub 저장소', diagramLabel: 'TLS 연결과 인증 흐름도', copy: '복사', copyLabel: '코드 복사', themeLabel: '어두운 모드로 전환'},
  {lang: 'en', source: 'en', prefix: '', labelIndex: 3, skip: 'Skip to content', languageLabel: 'Select language', contents: 'Contents', contentsLabel: 'Documentation navigation', onThisPage: 'On this page', paginationLabel: 'Previous and next pages', previous: 'Previous', next: 'Next', repositoryLabel: 'GitHub repository', diagramLabel: 'TLS connection and authentication flow', copy: 'Copy', copyLabel: 'Copy code', themeLabel: 'Switch to dark mode'},
];
loadLanguages(['bash', 'nginx', 'apacheconf', 'ini']);
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const template = await readFile(path.join(root, 'site/template.html'), 'utf8');
await rm(out, {recursive: true, force: true});
await mkdir(path.join(out, 'assets'), {recursive: true});
for (const locale of locales) {
  for (const [index, [filename, route]] of chapters.entries()) {
    const markdown = await readFile(path.join(root, 'docs', locale.source, filename), 'utf8');
    const pagePath = path.posix.join(locale.prefix, route);
    const relativeHref = target => `${path.posix.relative(pagePath, target) || '.'}/`;
    const base = relativeHref('.');
    const href = other => relativeHref(path.posix.join(locale.prefix, other));
    const koHref = relativeHref(path.posix.join('ko', route));
    const enHref = relativeHref(route || '.');
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
        if (language === 'mermaid') return `<div class="mermaid-diagram" role="img" aria-label="${locale.diagramLabel}" aria-busy="true">${escape(text)}</div>\n`;
        const grammar = Prism.languages[language];
        const code = grammar ? Prism.highlight(text, grammar, language) : escape(text);
        return `<div class="code-block"><div class="code-bar"><span>${escape(language)}</span><button class="copy-code" type="button" aria-label="${locale.copyLabel}">${locale.copy}</button></div><pre tabindex="0"><code>${code}</code></pre></div>\n`;
      },
    }});
    const title = parser.lexer(markdown).find(token => token.type === 'heading' && token.depth === 1)?.text;
    if (!title) throw new Error(`Expected a Markdown h1 in ${filename}`);
    let content = parser.parse(markdown);
    content = content.replace(/<table>/g, '<div class="table-scroll" tabindex="0"><table>').replace(/<\/table>/g, '</table></div>');
    const navigation = chapters.map((chapter, i) => `<a href="${href(chapter[1])}"${i === index ? ' aria-current="page"' : ''}><span>${String(i + 1).padStart(2, '0')}</span>${escape(chapter[locale.labelIndex])}</a>`).join('\n');
    const pagination = [index > 0 ? `<a href="${href(chapters[index - 1][1])}"><span>${locale.previous}</span>← ${escape(chapters[index - 1][locale.labelIndex])}</a>` : '', index < chapters.length - 1 ? `<a href="${href(chapters[index + 1][1])}"><span>${locale.next}</span>${escape(chapters[index + 1][locale.labelIndex])} →</a>` : ''].join('');
    const seo = metadata.pages[locale.lang][filename];
    const seoTitle = seo.title || `${title} | ${metadata.siteName}`;
    const canonicalUrl = pageUrl(locale.prefix, route);
    const koUrl = pageUrl('ko', route);
    const enUrl = pageUrl('', route);
    const structuredData = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'TechArticle',
      headline: seoTitle, description: seo.description, url: canonicalUrl,
      mainEntityOfPage: canonicalUrl, inLanguage: locale.lang, image: imageUrl,
      author: {'@type': 'Person', name: metadata.author, url: metadata.authorUrl},
      isPartOf: {'@type': 'WebSite', name: metadata.siteName, url: siteUrl.href},
    }).replaceAll('<', '\\u003c');
    sitemapUrls.push(canonicalUrl);
    const values = {...locale, seoTitle: escape(seoTitle), description: escape(seo.description), canonicalUrl: escape(canonicalUrl), koUrl: escape(koUrl), enUrl: escape(enUrl), imageUrl: escape(imageUrl), imageAlt: escape(metadata.imageAlt), siteName: escape(metadata.siteName), author: escape(metadata.author), ogLocale: locale.lang === 'en' ? 'en_US' : 'ko_KR', ogAlternateLocale: locale.lang === 'en' ? 'ko_KR' : 'en_US', sitemapUrl: escape(new URL('sitemap.xml', siteUrl).href), structuredData, base, homeHref: href(''), koHref, enHref, koCurrent: locale.lang === 'ko' ? ' aria-current="page"' : '', enCurrent: locale.lang === 'en' ? ' aria-current="page"' : '', filename, navigation, content, pagination, tocHidden: toc.length ? '' : ' hidden', toc: toc.map(({id, label}) => `<a href="#${encodeURIComponent(id)}">${escape(label)}</a>`).join('\n')};
    const html = template.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? '');
    const folder = path.join(out, locale.prefix, route);
    await mkdir(folder, {recursive: true});
    await writeFile(path.join(folder, 'index.html'), html);
  }
  await mkdir(path.join(out, locale.prefix, 'examples'), {recursive: true});
  for (const filename of ['nginx-https.conf', 'apache-https.conf']) {
    await copyFile(path.join(root, 'site/examples', locale.source, filename), path.join(out, locale.prefix, 'examples', filename));
  }
}
for (const filename of ['certificate.svg', path.basename(metadata.image)]) {
  await copyFile(path.join(root, 'site/assets', filename), path.join(out, 'assets', filename));
}
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
await writeFile(path.join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls.map(url => `  <url><loc>${escape(url)}</loc></url>`).join('\n')}\n</urlset>\n`);
// Keep previously published /en/ links working after English moves to the site root.
for (const [filename, route, , label] of chapters) {
  const aliasPath = path.posix.join('en', route);
  const target = `${path.posix.relative(aliasPath, route || '.') || '.'}/`;
  const canonicalUrl = pageUrl('', route);
  const seo = metadata.pages.en[filename];
  const seoTitle = seo.title || `${label} | ${metadata.siteName}`;
  const redirectScript = `const target = new URL(${JSON.stringify(target)}, location.href); target.search = location.search; target.hash = location.hash; location.replace(target.href);`;
  const folder = path.join(out, aliasPath);
  await mkdir(folder, {recursive: true});
  await writeFile(path.join(folder, 'index.html'), `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(seoTitle)}</title><meta name="description" content="${escape(seo.description)}"><link rel="canonical" href="${escape(canonicalUrl)}"><meta name="robots" content="noindex, follow"><meta property="og:type" content="website"><meta property="og:title" content="${escape(seoTitle)}"><meta property="og:description" content="${escape(seo.description)}"><meta property="og:url" content="${escape(canonicalUrl)}"><meta property="og:image" content="${escape(imageUrl)}"><meta property="og:image:alt" content="${escape(metadata.imageAlt)}"><meta http-equiv="refresh" content="0;url=${escape(target)}"><script>${redirectScript}</script></head><body><p><a href="${escape(target)}">Continue to ${escape(metadata.siteName)}</a></p></body></html>\n`);
}
await mkdir(path.join(out, 'en/examples'), {recursive: true});
for (const filename of ['nginx-https.conf', 'apache-https.conf']) {
  await copyFile(path.join(root, 'site/examples/en', filename), path.join(out, 'en/examples', filename));
}
console.log(`Built ${chapters.length * locales.length} Markdown pages → ${out}`);
