'use strict';

// Draws assets/icon.png: a dark rounded tile with three accent lyric bars.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const SIZE = 1024;

function crc32(buffer) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buffer.length; i++) crc = table[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

const pixels = Buffer.alloc(SIZE * SIZE * 4, 0);

function put(x, y, [r, g, b], alpha) {
  if (alpha <= 0) return;
  const index = (y * SIZE + x) * 4;
  const a = Math.min(255, Math.round(alpha * 255));
  const src = alpha;
  const dst = pixels[index + 3] / 255;
  const out = src + dst * (1 - src);
  if (out <= 0) return;
  pixels[index] = Math.round((r * src + pixels[index] * dst * (1 - src)) / out);
  pixels[index + 1] = Math.round((g * src + pixels[index + 1] * dst * (1 - src)) / out);
  pixels[index + 2] = Math.round((b * src + pixels[index + 2] * dst * (1 - src)) / out);
  pixels[index + 3] = Math.round(out * 255);
}

// Rounded tile.
const radius = SIZE * 0.235;
const inset = SIZE * 0.06;
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const cx = Math.min(Math.max(x, inset + radius), SIZE - inset - radius);
    const cy = Math.min(Math.max(y, inset + radius), SIZE - inset - radius);
    const distance = Math.hypot(x - cx, y - cy);
    const edge = Math.min(1, Math.max(0, (radius - distance) / 2.5));
    if (edge <= 0) continue;
    const t = y / SIZE;
    const bg = [
      Math.round(18 - 8 * t),
      Math.round(22 - 10 * t),
      Math.round(30 - 12 * t),
    ];
    put(x, y, bg, edge);
  }
}

// Three lyric bars with the middle one brightest.
const bars = [
  { x: 0.24, width: 0.13, height: 0.3, color: [142, 240, 201], alpha: 0.55 },
  { x: 0.435, width: 0.13, height: 0.52, color: [142, 240, 201], alpha: 1 },
  { x: 0.63, width: 0.13, height: 0.36, color: [142, 240, 201], alpha: 0.75 },
];

for (const bar of bars) {
  const x0 = Math.round(bar.x * SIZE);
  const x1 = Math.round((bar.x + bar.width) * SIZE);
  const y0 = Math.round((0.5 - bar.height / 2) * SIZE);
  const y1 = Math.round((0.5 + bar.height / 2) * SIZE);
  const barRadius = Math.round((x1 - x0) / 2);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const cx = Math.min(Math.max(x, x0 + barRadius), x1 - barRadius);
      const cy = Math.min(Math.max(y, y0 + barRadius), y1 - barRadius);
      const distance = Math.hypot(x - cx, y - cy);
      const edge = Math.min(1, Math.max(0, (barRadius - distance) / 2.5));
      put(x, y, bar.color, edge * bar.alpha);
    }
  }
}

const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0;
  pixels.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}

const header = Buffer.alloc(13);
header.writeUInt32BE(SIZE, 0);
header.writeUInt32BE(SIZE, 4);
header[8] = 8;
header[9] = 6;

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', header),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const output = path.join(__dirname, '..', 'assets', 'icon.png');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, png);
console.log(`wrote ${output} (${png.length} bytes)`);
