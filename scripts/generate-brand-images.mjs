/**
 * Brand image generator — writes the PNGs that platforms actually accept.
 *
 * WHY THIS EXISTS
 * ---------------
 * The social preview used to point at `og-image.svg`. That works on X and
 * Facebook but NOT on WhatsApp, which is where this audience actually shares
 * links, so every shared link rendered as a bare strip of text. WhatsApp,
 * LinkedIn, Instagram and Slack all require a raster image.
 *
 * It also writes the favicon and the apple-touch-icon, because `index.html`
 * pointed both at an SVG: Chrome ignores an SVG favicon on the desktop tab bar
 * and iOS silently drops an SVG apple-touch-icon, leaving a white square.
 *
 * No dependency is added. A PNG is a zlib deflate of raw scanlines, and
 * `zlib.deflateSync` from Node's standard library is exactly that. Adding sharp
 * (or any image library) for three static files would be a large install for no
 * benefit, and this runs on every deploy.
 *
 * Usage:  node scripts/generate-brand-images.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, '..', 'public');

// ── Minimal PNG writer ────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/** One PNG chunk: length, type, data, CRC. */
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

/**
 * Write an 8-bit RGB PNG.
 *
 * The filter byte on every scanline is 0 (None). Filter types compress better
 * but add per-row bytes and an encoder bug surface, and these are flat brand
 * images where zlib already does the work.
 */
function writePng(file, width, height, rgb) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type 2 = truecolour RGB
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  writeFileSync(
    file,
    Buffer.concat([
      signature,
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  );
}

// ── Drawing helpers (operate on an RGB buffer) ───────────────────────────────

function gradient(buf, w, h, top, bottom) {
  for (let y = 0; y < h; y += 1) {
    const t = y / (h - 1);
    const r = Math.round(top[0] + (bottom[0] - top[0]) * t);
    const g = Math.round(top[1] + (bottom[1] - top[1]) * t);
    const b = Math.round(top[2] + (bottom[2] - top[2]) * t);
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 3;
      buf[i] = r;
      buf[i + 1] = g;
      buf[i + 2] = b;
    }
  }
}

/** Soft radial glow, additive — the brand bloom behind the logo. */
function glow(buf, w, h, cx, cy, radius, colour, strength) {
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > radius) continue;
      const falloff = (1 - d / radius) ** 2 * strength;
      const i = (y * w + x) * 3;
      buf[i] = Math.min(255, Math.round(buf[i] + colour[0] * falloff));
      buf[i + 1] = Math.min(255, Math.round(buf[i + 1] + colour[1] * falloff));
      buf[i + 2] = Math.min(255, Math.round(buf[i + 2] + colour[2] * falloff));
    }
  }
}

function insideRoundRect(px, py, w, h, r) {
  if (px < 0 || py < 0 || px > w || py > h) return false;
  const cx = Math.min(Math.max(px, r), w - r);
  const cy = Math.min(Math.max(py, r), h - r);
  return Math.hypot(px - cx, py - cy) <= r;
}

/**
 * Rounded rectangle with 3x3 supersampling.
 *
 * Supersampling rather than a distance-based alpha: it reuses one predicate for
 * every primitive (rect, heart, glyph pixel), so the edges stay smooth without
 * a second anti-aliasing path that could disagree with the first.
 */
function roundRect(buf, w, h, x0, y0, rw, rh, radius, colour, alpha = 1) {
  const SS = 3;
  const minX = Math.max(0, Math.floor(x0));
  const maxX = Math.min(w - 1, Math.ceil(x0 + rw));
  const minY = Math.max(0, Math.floor(y0));
  const maxY = Math.min(h - 1, Math.ceil(y0 + rh));
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      let hits = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          if (insideRoundRect(x + (sx + 0.5) / SS - x0, y + (sy + 0.5) / SS - y0, rw, rh, radius)) {
            hits += 1;
          }
        }
      }
      if (!hits) continue;
      const a = (hits / (SS * SS)) * alpha;
      const i = (y * w + x) * 3;
      buf[i] = Math.round(buf[i] * (1 - a) + colour[0] * a);
      buf[i + 1] = Math.round(buf[i + 1] * (1 - a) + colour[1] * a);
      buf[i + 2] = Math.round(buf[i + 2] * (1 - a) + colour[2] * a);
    }
  }
}

/** A heart, from two upper lobes plus a triangle down to the point. */
function insideHeart(x, y, r) {
  if (y <= 0) {
    const dx1 = x + r;
    const dx2 = x - r;
    return dx1 * dx1 + y * y <= r * r || dx2 * dx2 + y * y <= r * r;
  }
  const tipY = r * 1.35;
  if (y > tipY) return false;
  return Math.abs(x) <= r * (1 - y / tipY);
}

function heart(buf, w, h, cx, cy, size, colour) {
  const r = size / 4;
  const SS = 3;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let hits = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          if (insideHeart(x + (sx + 0.5) / SS - cx, y + (sy + 0.5) / SS - cy, r)) hits += 1;
        }
      }
      if (!hits) continue;
      const a = hits / (SS * SS);
      const i = (y * w + x) * 3;
      buf[i] = Math.round(buf[i] * (1 - a) + colour[0] * a);
      buf[i + 1] = Math.round(buf[i + 1] * (1 - a) + colour[1] * a);
      buf[i + 2] = Math.round(buf[i + 2] * (1 - a) + colour[2] * a);
    }
  }
}

/**
 * The brand mark: a rose→pink→amber gradient tile with a white heart.
 *
 * Drawn analytically rather than from a font, because no font is available in a
 * bare Node script and shipping a webfont just for this would add a network
 * round trip to a file that is generated once at build time.
 */
function brandMark(buf, w, h, x0, y0, size) {
  roundRect(buf, w, h, x0, y0, size, size, size * 0.28, [244, 63, 94]);
  // Gradient overlay, written row-band wise so it stays clipped to the tile.
  const minY = Math.max(0, Math.floor(y0));
  const maxY = Math.min(h - 1, Math.ceil(y0 + size));
  for (let y = minY; y <= maxY; y += 1) {
    const t = (y - y0) / size;
    const colour =
      t < 0.5
        ? [244 + (236 - 244) * (t * 2), 63 + (72 - 63) * (t * 2), 94 + (153 - 94) * (t * 2)]
        : [236 + (245 - 236) * ((t - 0.5) * 2), 72 + (158 - 72) * ((t - 0.5) * 2), 153 + (11 - 153) * ((t - 0.5) * 2)];
    const minX = Math.max(0, Math.floor(x0));
    const maxX = Math.min(w - 1, Math.ceil(x0 + size));
    for (let x = minX; x <= maxX; x += 1) {
      if (!insideRoundRect(x - x0, y - y0, size, size, size * 0.28)) continue;
      const i = (y * w + x) * 3;
      buf[i] = Math.round(colour[0]);
      buf[i + 1] = Math.round(colour[1]);
      buf[i + 2] = Math.round(colour[2]);
    }
  }
  heart(buf, w, h, x0 + size * 0.5, y0 + size * 0.54, size * 0.62, [255, 255, 255]);
}

/**
 * A 5x7 bitmap font, enough for the short Latin lines on the social card.
 *
 * Rendered at a large scale on purpose: the point of an OG image is legibility
 * in a small chat bubble, not typographic quality. A missing glyph falls back to
 * a space rather than throwing, so a stray character can never fail a deploy.
 */
const GLYPHS = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '11110', '10001', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '11110', '10000', '10000', '10000', '11111'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
};

function text(buf, w, h, value, x0, y0, scale, colour, alpha = 1) {
  let cursor = x0;
  for (const ch of value.toUpperCase()) {
    const glyph = GLYPHS[ch] ?? GLYPHS[' '];
    for (let row = 0; row < glyph.length; row += 1) {
      for (let col = 0; col < glyph[row].length; col += 1) {
        if (glyph[row][col] !== '1') continue;
        roundRect(buf, w, h, cursor + col * scale, y0 + row * scale, scale, scale, 0, colour, alpha);
      }
    }
    cursor += scale * 6;
  }
  return cursor;
}

const widthOf = (value, scale) => value.length * scale * 6 - scale;

// ── The assets ────────────────────────────────────────────────────────────────

mkdirSync(PUBLIC, { recursive: true });

/**
 * 1200x630 social card.
 *
 * The copy is Latin rather than Arabic on purpose: rendering Arabic requires a
 * font with proper shaping and contextual letterforms, which a 5x7 bitmap
 * glyph table cannot represent. Bitmapped Arabic comes out as disconnected
 * letters that read as noise, so the card uses English and the
 * Arabic message lives in og:description, which every platform renders with a
 * real font.
 */
function ogImage() {
  const W = 1200;
  const H = 630;
  const buf = Buffer.alloc(W * H * 3);
  gradient(buf, W, H, [2, 6, 23], [15, 23, 42]);
  glow(buf, W, H, 140, 90, 460, [244, 63, 94], 0.22);
  glow(buf, W, H, 1080, 560, 420, [245, 158, 11], 0.16);

  brandMark(buf, W, H, 80, 70, 96);

  text(buf, W, H, 'EBNILI', 200, 76, 7, [255, 255, 255]);
  text(buf, W, H, 'AI APP BUILDER', 202, 142, 3, [148, 163, 184]);

  const headline = 'BUILD ANY WEB APP';
  text(buf, W, H, headline, 1120 - widthOf(headline, 6), 250, 6, [255, 255, 255]);
  const sub = 'WITH AI IN SECONDS';
  text(buf, W, H, sub, 1120 - widthOf(sub, 6), 310, 6, [251, 191, 36]);

  // Accent rule.
  roundRect(buf, W, H, 1120 - 240, 372, 240, 6, 3, [244, 63, 94]);

  // Feature pills: the two claims that matter on a share.
  const pill1 = 'LIVE PREVIEW';
  const pill2 = 'EXPORT ZIP';
  const w1 = widthOf(pill1, 3) + 32;
  const w2 = widthOf(pill2, 3) + 32;
  roundRect(buf, W, H, 1120 - w1, 410, w1, 48, 24, [30, 41, 59]);
  text(buf, W, H, pill1, 1120 - w1 + 16, 424, 3, [226, 232, 240]);
  roundRect(buf, W, H, 1120 - w2, 472, w2, 48, 24, [30, 41, 59]);
  text(buf, W, H, pill2, 1120 - w2 + 16, 486, 3, [226, 232, 240]);

  text(buf, W, H, 'EBNILY', 1120 - widthOf('EBNILY', 3), 566, 3, [100, 116, 139]);

  writePng(join(PUBLIC, 'og-image.png'), W, H, buf);
  return 'og-image.png';
}

/** 180x180 icon — square and full-bleed, because iOS masks it to a circle. */
function touchIcon() {
  const S = 180;
  const buf = Buffer.alloc(S * S * 3);
  gradient(buf, S, S, [2, 6, 23], [15, 23, 42]);
  brandMark(buf, S, S, 20, 20, 140);
  writePng(join(PUBLIC, 'apple-touch-icon.png'), S, S, buf);
  return 'apple-touch-icon.png';
}

/** 64x64 favicon for the browser tab. */
function favicon() {
  const S = 64;
  const buf = Buffer.alloc(S * S * 3);
  gradient(buf, S, S, [2, 6, 23], [15, 23, 42]);
  brandMark(buf, S, S, 4, 4, 56);
  writePng(join(PUBLIC, 'favicon.png'), S, S, buf);
  return 'favicon.png';
}

const written = [ogImage(), touchIcon(), favicon()];
console.log('[brand] wrote:');
for (const f of written) console.log(`  · public/${f}`);