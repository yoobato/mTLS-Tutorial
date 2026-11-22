import {createServer} from 'node:http';
import {watch} from 'node:fs';
import {readFile, stat, rename, rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, '.preview-dist');
const staging = path.join(root, '.preview-dist-next');
const host = '127.0.0.1';
const port = Number(process.env.PORT || 8767);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be 1–65535.');
const clients = new Set();
const watchers = [];
let version = Date.now();
let pending = false;
let building = null;
let child;
let timer;
let stopping = false;
let hasBuild = false;
const send = (event, data) => {
  for (const response of clients) response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
};
function runBuilder() {
  return new Promise((resolve, reject) => {
    child = spawn(process.execPath, ['scripts/build-site.mjs'], {
      cwd: root,
      env: {...process.env, DOCS_OUTPUT_DIR: staging},
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', code => {
      child = undefined;
      code === 0 ? resolve() : reject(new Error(`Build exited with code ${code}`));
    });
  });
}
function build() {
  if (building) return building;
  building = (async () => {
    while (pending && !stopping) {
      pending = false;
      try {
        await runBuilder();
        if (stopping) return;
        await rm(output, {recursive: true, force: true});
        await rename(staging, output);
        hasBuild = true;
        version++;
        send('reload', {version});
        console.log(`✓ Preview updated · ${new Date().toLocaleTimeString()}`);
      } catch (error) {
        if (stopping) return;
        console.error(`Build failed; keeping the last successful preview. ${error.message}`);
        send('build-error', {message: '빌드 실패 — 터미널의 오류를 확인하고 파일을 다시 저장하세요.'});
      }
    }
  })().finally(() => {
    building = null;
  });
  return building;
}
function changed(filename) {
  const name = String(filename || '');
  if (name && (name.includes('.DS_Store') || /(?:~|\.sw[op]|\.tmp)$/.test(name))) return;
  pending = true;
  clearTimeout(timer);
  timer = setTimeout(build, 120);
}
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};
function liveReloadScript() {
  return `<script>
(() => {
  let version = ${version};
  const events = new EventSource('/__dev/events');
  const reload = () => {
    const key = 'mtls-preview:' + location.pathname;
    sessionStorage.setItem(key, JSON.stringify({
      scroll: scrollY,
      details: [...document.querySelectorAll('details')].map(el => el.open)
    }));
    location.reload();
  };
  events.addEventListener('hello', event => {
    if (JSON.parse(event.data).version !== version) reload();
  });
  events.addEventListener('reload', event => {
    if (JSON.parse(event.data).version !== version) reload();
  });
  events.addEventListener('build-error', event => {
    const notice = document.getElementById('copy-status');
    if (notice) {notice.textContent = JSON.parse(event.data).message; notice.classList.add('visible');}
    console.error(JSON.parse(event.data).message);
  });
  try {
    const key = 'mtls-preview:' + location.pathname;
    const saved = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (saved) {
      sessionStorage.removeItem(key);
      document.querySelectorAll('details').forEach((el, i) => {if (saved.details[i] !== undefined) el.open = saved.details[i];});
      requestAnimationFrame(() => scrollTo(0, saved.scroll));
    }
  } catch {}
})();
</script>`;
}
const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${host}:${port}`);
  if (url.pathname === '/__dev/events') {
    response.writeHead(200, {'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'Connection': 'keep-alive'});
    response.write(`event: hello\ndata: ${JSON.stringify({version})}\n\n`);
    clients.add(response);
    request.on('close', () => clients.delete(response));
    return;
  }
  try {
    await building;
    if (!hasBuild) {
      response.writeHead(503, {'Content-Type': 'text/plain; charset=utf-8'});
      response.end('첫 빌드에 실패했습니다. 터미널을 확인하고 파일을 다시 저장하세요.');
      return;
    }
    const filename = path.resolve(output, '.' + decodeURIComponent(url.pathname));
    if (filename !== output && !filename.startsWith(output + path.sep)) {
      response.writeHead(403); response.end('Forbidden'); return;
    }
    const info = await stat(filename);
    let file = filename;
    if (info.isDirectory()) {
      if (!url.pathname.endsWith('/')) {
        response.writeHead(302, {Location: url.pathname + '/' + url.search}); response.end(); return;
      }
      file = path.join(filename, 'index.html');
    }
    let body = await readFile(file);
    if (file.endsWith('.html')) body = body.toString().replace('</body>', liveReloadScript() + '</body>');
    response.writeHead(200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store'});
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : 400);
    response.end('Not found');
  }
});
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE'
    ? `${port} 포트가 사용 중입니다. 기존 미리보기 터미널에서 Ctrl+C로 종료한 뒤 다시 실행하세요.`
    : error.message);
  process.exit(1);
});
await new Promise(resolve => server.listen(port, host, resolve));
for (const folder of ['docs', 'site']) {
  watchers.push(watch(path.join(root, folder), {recursive: true}, (_, filename) => changed(filename)));
}
watchers.push(watch(path.join(root, 'scripts'), (_, filename) => {
  if (String(filename) === 'build-site.mjs') changed(filename);
}));
pending = true;
await build();
console.log(`Local: http://${host}:${port}/ · 파일 저장 시 자동 반영 · 종료 Ctrl+C`);
const heartbeat = setInterval(() => {
  for (const client of clients) client.write(': keepalive\n\n');
}, 25000);
function shutdown() {
  stopping = true;
  clearTimeout(timer);
  clearInterval(heartbeat);
  watchers.forEach(watcher => watcher.close());
  child?.kill('SIGTERM');
  for (const client of clients) client.end();
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
