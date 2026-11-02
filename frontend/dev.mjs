/**
 * Local preview: builds the site, serves it, and rebuilds on source changes.
 * Reads the API from ../frontend/.cache/api/v1 (run the root "npm run build"
 * once first) or from any --api directory/URL.
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { values } = parseArgs({
  options: {
    api: { type: 'string', default: path.join(HERE, '.cache', 'api', 'v1') },
    media: { type: 'string', default: path.join(HERE, '..', 'backend', 'archive', 'media') },
    port: { type: 'string', default: '4173' },
    'no-build': { type: 'boolean' },
  },
});

const OUT = path.join(HERE, 'dist');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
};

// Every request waits on this, because a build empties dist before refilling it.
let building = Promise.resolve();

// A child process, because Node caches imported modules: a build in this process
// would pick up edited styles and scripts but never edited page templates.
const rebuild = () => {
  building = new Promise((resolve, reject) => {
    const args = ['build.mjs', '--api', values.api, '--media', values.media, '--out', OUT, '--dev'];
    execFile(process.execPath, args, { cwd: HERE }, (error, _stdout, stderr) => (error ? reject(new Error(stderr || error.message)) : resolve()));
  });
  return building;
};

if (!values['no-build']) await rebuild();

const server = http.createServer(async (req, res) => {
  await building.catch(() => {});
  const url = new URL(req.url, 'http://localhost');
  let file = path.normalize(path.join(OUT, decodeURIComponent(url.pathname)));
  if (!file.startsWith(OUT)) {
    res.writeHead(403).end();
    return;
  }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  let status = 200;
  if (!fs.existsSync(file)) {
    status = 404;
    file = path.join(OUT, '404.html');
  }
  res.writeHead(status, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(file)
    .on('error', () => res.destroy())
    .pipe(res);
});

const port = Number(values.port);
server.listen(port, '127.0.0.1', () => console.log(`Preview: http://127.0.0.1:${port}/`));

// --no-build only serves. It must not watch: a build wipes dist first, so a
// second builder running at the same time would delete this one's output.
if (!values['no-build']) {
  let timer;
  let busy = false;
  fs.watch(path.join(HERE, 'src'), { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (busy) return;
      busy = true;
      try {
        await rebuild();
        console.log('Rebuilt.');
      } catch (error) {
        console.error(error.message);
      } finally {
        busy = false;
      }
    }, 150);
  });
}
