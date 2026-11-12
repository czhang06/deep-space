// Draws the Deep Space station mark and writes the app and tray icons as PNGs.
// Run with: node scripts/make-icons.mjs   (no dependencies; uses zlib for PNG encoding)
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const hex = (value) => [parseInt(value.slice(1, 3), 16), parseInt(value.slice(3, 5), 16), parseInt(value.slice(5, 7), 16)];

// Shapes in a 0..1 square, painted in order. Later shapes cover earlier ones.
// A space station: solar wings either side of a central hab with a docking ring.
function shapes(theme) {
  const hull = hex("#eef1f5");
  const cell = hex(theme.cell);
  const frame = hex(theme.frame);
  const accent = hex(theme.accent);
  const dark = theme.bottom;
  const rect = (x0, y0, x1, y1, color) => ({ test: (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1, color });
  const circle = (cx, cy, r, color) => ({ test: (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r, color });
  const ring = (cx, cy, r0, r1, color) => ({ test: (x, y) => { const d = (x - cx) ** 2 + (y - cy) ** 2; return d <= r1 * r1 && d >= r0 * r0; }, color });
  const wing = (x0, x1) => [
    rect(x0, 0.33, x1, 0.67, cell),
    rect(x0, 0.49, x1, 0.51, frame),
    rect((x0 + x1) / 2 - 0.008, 0.33, (x0 + x1) / 2 + 0.008, 0.67, frame)
  ];
  return [
    // stars
    circle(0.2, 0.18, 0.012, hull),
    circle(0.82, 0.8, 0.012, hull),
    circle(0.75, 0.16, 0.009, hull),
    // truss
    rect(0.27, 0.475, 0.73, 0.525, frame),
    ...wing(0.08, 0.27),
    ...wing(0.73, 0.92),
    // central hab with a ring around it
    ring(0.5, 0.5, 0.2, 0.245, hull),
    circle(0.5, 0.5, 0.15, hull),
    rect(0.35, 0.49, 0.65, 0.51, hull),
    circle(0.5, 0.5, 0.06, dark),
    // antenna and beacon
    rect(0.495, 0.14, 0.505, 0.35, hull),
    circle(0.5, 0.14, 0.035, accent)
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

const live = { top: hex("#26365f"), bottom: hex("#0b1124"), cell: "#3f7fd6", frame: "#9aa6b8", accent: "#f08a3c" };
const paused = { top: hex("#6b6f78"), bottom: hex("#3c3f46"), cell: "#8a8f99", frame: "#b4b8c0", accent: "#c9ccd2" };

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
