/** Fails the build on broken internal links, missing assets, or third-party runtime dependencies. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const problems = [];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

if (!fs.existsSync(DIST)) {
  console.error('dist does not exist. Build first.');
  process.exit(1);
}

const files = walk(DIST);
const pages = files.filter((f) => f.endsWith('.html'));
const idsByPage = new Map();

for (const page of pages) {
  const source = fs.readFileSync(page, 'utf8');
  idsByPage.set(page, new Set([...source.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
}

const target = (url) => {
  const clean = decodeURI(url.split('#')[0].split('?')[0]);
  return path.join(DIST, clean === '/' ? 'index.html' : clean);
};

for (const page of pages) {
  const source = fs.readFileSync(page, 'utf8');
  const name = path.relative(DIST, page);

  for (const [, attr, value] of source.matchAll(/\s(href|src|srcset)="([^"]*)"/g)) {
    const urls = attr === 'srcset' ? value.split(',').map((part) => part.trim().split(/\s+/)[0]) : [value];
    for (const url of urls) {
      if (!url || url.startsWith('mailto:')) continue;
      if (url.startsWith('#')) {
        if (url.length > 1 && !idsByPage.get(page).has(url.slice(1))) problems.push(`${name}: missing anchor ${url}`);
        continue;
      }
      if (/^https?:/.test(url)) continue;
      if (!url.startsWith('/')) {
        problems.push(`${name}: non-root-relative URL ${url}`);
        continue;
      }
      const file = target(url);
      if (!fs.existsSync(file)) {
        problems.push(`${name}: broken link ${url}`);
        continue;
      }
      const hash = url.split('#')[1];
      if (hash && idsByPage.has(file) && !idsByPage.get(file).has(decodeURIComponent(hash))) {
        problems.push(`${name}: missing anchor ${url}`);
      }
    }
  }

  for (const [, tag, url] of source.matchAll(/<(script|link)\b[^>]*\s(?:src|href)="(https?:[^"]+)"/g)) {
    if (tag === 'script' || !/rel="(canonical)"/.test(url)) {
      if (!source.includes(`rel="canonical" href="${url}"`)) problems.push(`${name}: third-party ${tag} ${url}`);
    }
  }

  // A translated fragment interpolated into an attribute closes it early and spills text onto the page.
  if (/="[^"<>]*<span class="t-/.test(source)) problems.push(`${name}: markup inside an attribute`);

  if (!/<title>[^<]+<\/title>/.test(source)) problems.push(`${name}: no title`);
  if (!/name="description" content="[^"]+"/.test(source)) problems.push(`${name}: no meta description`);
  for (const [img] of source.matchAll(/<img\b[^>]*>/g)) {
    if (!/\balt="/.test(img)) problems.push(`${name}: image without alt`);
  }
}

// Images must always show their own colours, and CSS may not run any motion forever. The 3D views
// are the only continuous motion. They run in script, which stops them off screen and when paused.
for (const file of files.filter((f) => f.endsWith('.css'))) {
  const css = fs.readFileSync(file, 'utf8');
  for (const rule of ['mix-blend-mode', 'grayscale(', 'sepia(', 'hue-rotate(', 'saturate(', 'filter:', 'infinite']) {
    if (css.includes(rule)) problems.push(`${path.relative(DIST, file)}: contains "${rule}"`);
  }
}

// Every 3D view sits on an image of itself, so it is still there without WebGL or a fast machine.
for (const page of pages) {
  const source = fs.readFileSync(page, 'utf8');
  const name = path.relative(DIST, page);
  for (const [canvas] of source.matchAll(/<canvas\b[^>]*>/g)) {
    if (!canvas.includes('aria-hidden="true"')) problems.push(`${name}: canvas not hidden from screen readers`);
  }
  for (const [, module] of source.matchAll(/data-module="(earth|block|watercycle|collabglobe)"/g)) {
    if (!/-still\.webp/.test(source)) problems.push(`${name}: ${module} has no still image`);
  }
}

for (const banned of ['ericlyun', 'Ningmu', 'cdnjs.cloudflare', 'jquery', 'academicpages']) {
  for (const page of pages) {
    if (fs.readFileSync(page, 'utf8').includes(banned)) problems.push(`${path.relative(DIST, page)}: contains "${banned}"`);
  }
}

if (problems.length) {
  console.error(`${problems.length} problem(s):`);
  for (const p of [...new Set(problems)].slice(0, 60)) console.error(` - ${p}`);
  process.exit(1);
}
console.log(`OK: ${pages.length} pages, ${files.length} files, no broken links or third-party dependencies.`);
