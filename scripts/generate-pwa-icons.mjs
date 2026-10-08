import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createCrcTable() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
}

const crcTable = createCrcTable();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcBuf = Buffer.alloc(4);
  const crcData = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(crcData), 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function generatePng(width, height, isMaskable = false) {
  const rawRows = [];
  const cx = width / 2;
  const cy = height / 2;
  const radius = width * 0.44;

  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 0; // Filter None

    for (let x = 0; x < width; x++) {
      const idx = 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (isMaskable) {
        // Full background filling for maskable safe-zone
        // Indigo gradient from top-left (79, 70, 229) to bottom-right (30, 27, 75)
        const t = (x + y) / (width + height);
        const r = Math.round(79 * (1 - t) + 30 * t);
        const g = Math.round(70 * (1 - t) + 27 * t);
        const b = Math.round(229 * (1 - t) + 75 * t);

        // Medical Cross / Shield in center
        const innerDist = Math.max(Math.abs(dx), Math.abs(dy));
        const inCrossV = Math.abs(dx) <= width * 0.08 && Math.abs(dy) <= height * 0.28;
        const inCrossH = Math.abs(dy) <= height * 0.08 && Math.abs(dx) <= width * 0.28;

        if (inCrossV || inCrossH) {
          row[idx] = 255;
          row[idx + 1] = 255;
          row[idx + 2] = 255;
          row[idx + 3] = 255;
        } else {
          row[idx] = r;
          row[idx + 1] = g;
          row[idx + 2] = b;
          row[idx + 3] = 255;
        }
      } else {
        // Rounded shield icon
        if (dist <= radius) {
          // Inside circular shield
          const inCrossV = Math.abs(dx) <= width * 0.08 && Math.abs(dy) <= height * 0.26;
          const inCrossH = Math.abs(dy) <= height * 0.08 && Math.abs(dx) <= width * 0.26;

          if (inCrossV || inCrossH) {
            // White cross
            row[idx] = 255;
            row[idx + 1] = 255;
            row[idx + 2] = 255;
            row[idx + 3] = 255;
          } else {
            // Indigo gradient background
            const t = (x + y) / (width + height);
            row[idx] = Math.round(79 * (1 - t) + 37 * t);
            row[idx + 1] = Math.round(70 * (1 - t) + 99 * t);
            row[idx + 2] = Math.round(229 * (1 - t) + 235 * t);
            row[idx + 3] = 255;
          }
        } else {
          // Transparent
          row[idx] = 0;
          row[idx + 1] = 0;
          row[idx + 2] = 0;
          row[idx + 3] = 0;
        }
      }
    }
    rawRows.push(row);
  }

  const rawData = Buffer.concat(rawRows);
  const compressedData = zlib.deflateSync(rawData);

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth
  ihdr[9] = 6; // Color type 6 = RGBA
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressedData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 1. Generate PWA Icons
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), generatePng(192, 192, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), generatePng(512, 512, false));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), generatePng(512, 512, true));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), generatePng(180, 180, true));
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), generatePng(32, 32, false));

// 2. Generate crisp SVG Icon
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="pvGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4f46e5"/>
      <stop offset="100%" stop-color="#1e1b4b"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000" flood-opacity="0.3"/>
    </filter>
  </defs>
  <rect width="512" height="512" rx="128" fill="url(#pvGrad)"/>
  <path d="M256 96 C190 96 144 140 144 240 C144 340 256 416 256 416 C256 416 368 340 368 240 C368 140 322 96 256 96 Z" fill="#ffffff" opacity="0.15" filter="url(#shadow)"/>
  <!-- Cross -->
  <rect x="228" y="160" width="56" height="176" rx="12" fill="#ffffff"/>
  <rect x="168" y="220" width="176" height="56" rx="12" fill="#ffffff"/>
  <!-- Heartbeat line -->
  <path d="M180 370 L220 370 L236 330 L256 400 L276 345 L292 370 L332 370" fill="none" stroke="#38bdf8" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgContent);

console.log('✓ Successfully generated all PWA icons (192, 512, maskable, apple-touch-icon, favicon, icon.svg) in public/');
