import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const SIGNATURES = [
  { ext: 'jpg', mime: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: 'png', mime: 'image/png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: 'webp', mime: 'image/webp', test: (b) => b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP' },
  { ext: 'gif', mime: 'image/gif', test: (b) => ['GIF87a', 'GIF89a'].includes(b.toString('latin1', 0, 6)) },
  { ext: 'pdf', mime: 'application/pdf', test: (b) => b.toString('latin1', 0, 5) === '%PDF-' },
];

export const MAX_UPLOAD_BYTES = 40 * 1024 * 1024;

/** Types come from file contents, never the name. SVG is excluded because it can carry scripts. */
export function sniffType(buffer) {
  return SIGNATURES.find((s) => buffer.length > 12 && s.test(buffer)) ?? null;
}

export const mediaPath = (cfg, sha256, ext) => path.join(cfg.mediaDir, sha256.slice(0, 2), `${sha256}.${ext}`);

/**
 * Stores a file in the content-addressed archive. Originals are immutable: the
 * same bytes always resolve to the same path and are never overwritten.
 */
export function storeFile(cfg, buffer) {
  if (!buffer?.length) throw Object.assign(new Error('Empty upload'), { status: 400 });
  if (buffer.length > MAX_UPLOAD_BYTES) throw Object.assign(new Error('File exceeds 40 MB'), { status: 413 });
  const type = sniffType(buffer);
  if (!type) throw Object.assign(new Error('Unsupported file type (allowed: JPEG, PNG, WebP, GIF, PDF)'), { status: 415 });

  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const file = mediaPath(cfg, sha256, type.ext);
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, buffer);
    fs.renameSync(tmp, file);
  }
  return { id: sha256.slice(0, 16), sha256, ext: type.ext, mime: type.mime, bytes: buffer.length };
}
