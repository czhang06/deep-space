// Draws the Tiny Kingdom castle mark and writes the app and tray icons as PNGs.
// Run with: node scripts/make-icons.mjs   (no dependencies; uses zlib for PNG encoding)
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const hex = (value) => [parseInt(value.slice(1, 3), 16), parseInt(value.slice(3, 5), 16), parseInt(value.slice(5, 7), 16)];

// Shapes in a 0..1 square, painted in order. Later shapes cover earlier ones.
function shapes(theme) {
  const stone = hex("#f4ecd9");
  const flag = hex(theme.flag);
  const hole = theme.bottom;
  const rect = (x0, y0, x1, y1, color) => ({ test: (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1, color });
  const merlons = (x0, x1, y, count, color) => {
    const list = [];
    const width = (x1 - x0) / (count * 2 - 1);
    for (let index = 0; index < count; index += 1) {
      const left = x0 + index * width * 2;
      list.push(rect(left, y - width * 0.9, left + width, y + 0.001, color));
    }
    return list;
  };
  return [
    // towers and keep
    rect(0.17, 0.45, 0.34, 0.82, stone),
    ...merlons(0.17, 0.34, 0.45, 3, stone),
    rect(0.66, 0.45, 0.83, 0.82, stone),
    ...merlons(0.66, 0.83, 0.45, 3, stone),
    rect(0.36, 0.31, 0.64, 0.82, stone),
    ...merlons(0.36, 0.64, 0.31, 4, stone),
    // door with a round top
    { test: (x, y) => (x >= 0.445 && x <= 0.555 && y >= 0.66 && y <= 0.82) || (x - 0.5) ** 2 + (y - 0.66) ** 2 <= 0.055 ** 2, color: hole },
    // windows
    rect(0.235, 0.56, 0.275, 0.64, hole),
    rect(0.725, 0.56, 0.765, 0.64, hole),
    rect(0.475, 0.42, 0.525, 0.52, hole),
    // flag
    rect(0.495, 0.13, 0.515, 0.27, stone),
    { test: (x, y) => x >= 0.515 && x <= 0.66 && y >= 0.13 && y <= 0.22 && x - 0.515 <= (0.66 - 0.515) * (1 - Math.abs(y - 0.175) / 0.09 * 0.35), color: flag },
    // ground
    rect(0.12, 0.81, 0.88, 0.86, stone)
  ];
}

function background(theme, x, y) {
  const radius = 0.22;
  const cx = Math.min(Math.max(x, radius), 1 - radius);
  const cy = Math.min(Math.max(y, radius), 1 - radius);
  if ((x - cx) ** 2 + (y - cy) ** 2 > radius ** 2) {
    return null;
  }
  const top = theme.top;
  const bottom = theme.bottom;
  return top.map((channel, index) => Math.round(channel + (bottom[index] - channel) * y));
}

function render(size, theme) {
  const samples = 4;
  const pixels = Buffer.alloc(size * size * 4);
  const list = shapes(theme);
  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const x = (px + (sx + 0.5) / samples) / size;
          const y = (py + (sy + 0.5) / samples) / size;
          let color = background(theme, x, y);
          if (!color) {
            continue;
          }
          for (const shape of list) {
            if (shape.test(x, y)) {
              color = shape.color;
            }
          }
          r += color[0];
          g += color[1];
          b += color[2];
          a += 1;
        }
      }
      const offset = (py * size + px) * 4;
      if (a > 0) {
        pixels[offset] = Math.round(r / a);
        pixels[offset + 1] = Math.round(g / a);
        pixels[offset + 2] = Math.round(b / a);
      }
      pixels[offset + 3] = Math.round((a / (samples * samples)) * 255);
    }
  }
  return encodePng(size, pixels);
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

const live = { top: hex("#5a7bb0"), bottom: hex("#34497a"), flag: "#d9483f" };
const paused = { top: hex("#8d8a84"), bottom: hex("#5f5c57"), flag: "#b9b4aa" };

const outputs = [
  ["build/icon.png", 512, live],
  ["electron/assets/icon.png", 256, live],
  ["electron/assets/tray.png", 16, live],
  ["electron/assets/tray@2x.png", 32, live],
  ["electron/assets/tray-paused.png", 16, paused],
  ["electron/assets/tray-paused@2x.png", 32, paused]
];

for (const [file, size, theme] of outputs) {
  const target = join(root, file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, render(size, theme));
  console.log(`wrote ${file} (${size}px)`);
}
