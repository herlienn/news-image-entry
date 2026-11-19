// WORLD NEWS IN ONE PICTURE - WEDNESDAY, 18 NOVEMBER 2026.
// A dense one-page newspaper: 35 stories from 6 continents, three big
// illustrated hero scenes, a world map with numbered pins, an "Also on"
// list, a UTC timeline, sources and a date check. Everything is drawn
// by this program alone: its own 5x7 bitmap letterforms, its own PNG
// writer, its own shapes. Node standard library only, no network.
// Two runs must write identical bytes, so there is no clock, no random
// number and no input other than the constants below.
import * as fs from "node:fs";
import * as zlib from "node:zlib";

// ---------- PNG writer (own code) ----------
const CRC: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC[n] = c >>> 0;
}
function crcOf(bytes: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(kind: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(kind, 4, "ascii");
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crcOf(Buffer.concat([Buffer.from(kind, "ascii"), data])), 0);
  return Buffer.concat([head, data, tail]);
}
function toPNG(width: number, height: number, pixels: Buffer): Buffer {
  const scan = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    scan[y * (1 + width * 4)] = 0;
    pixels.copy(scan, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const idat = zlib.deflateSync(scan, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- paper and ink ----------
const PAGE_W = 1024;
const PAGE_H = 1024;
type RGB = [number, number, number];
const PAPER: RGB = [248, 243, 232];
const INK: RGB = [24, 24, 24];
const CRIMSON: RGB = [178, 24, 24];
const DEEPBLUE: RGB = [28, 52, 92];
const SKY: RGB = [52, 110, 200];
const MUSTARD: RGB = [208, 156, 24];
const FOREST: RGB = [34, 110, 72];
const SLATE: RGB = [96, 96, 96];
const PALE: RGB = [233, 227, 211];
const SNOW: RGB = [255, 255, 255];
const SAND: RGB = [222, 206, 170];
const TEAL: RGB = [14, 116, 108];
const DUSK: RGB = [18, 26, 66];

const canvas = Buffer.alloc(PAGE_W * PAGE_H * 4);
function dot(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= PAGE_W || y >= PAGE_H) return;
  const i = (y * PAGE_W + x) * 4;
  canvas[i] = c[0]; canvas[i + 1] = c[1]; canvas[i + 2] = c[2]; canvas[i + 3] = 255;
}
function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) dot(i, j, c);
}
function ruleH(x: number, y: number, w: number, c: RGB): void { fillRect(x, y, w, 1, c); }
function ruleV(x: number, y: number, h: number, c: RGB): void { fillRect(x, y, 1, h, c); }
function frame(x: number, y: number, w: number, h: number, c: RGB): void {
  ruleH(x, y, w, c); ruleH(x, y + h - 1, w, c); ruleV(x, y, h, c); ruleV(x + w - 1, y, h, c);
}
function disc(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    if (x * x + y * y <= r * r) dot(cx + x, cy + y, c);
  }
}
function circ(cx: number, cy: number, r: number, c: RGB): void {
  for (let a = 0; a < 360; a += 2) {
    const t = (a * Math.PI) / 180;
    dot(Math.round(cx + r * Math.cos(t)), Math.round(cy + r * Math.sin(t)), c);
  }
}
function segment(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    dot(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}
function fillPoly(pts: [number, number][], c: RGB): void {
  let lo = 1e9;
  let hi = -1e9;
  for (const [, y] of pts) { lo = Math.min(lo, y); hi = Math.max(hi, y); }
  for (let y = Math.max(0, lo); y <= Math.min(PAGE_H - 1, hi); y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[(i + 1) % pts.length];
      if ((ay <= y && by > y) || (by <= y && ay > y)) {
        xs.push(Math.round(ax + ((y - ay) * (bx - ax)) / (by - ay)));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = xs[k]; x <= xs[k + 1]; x++) dot(x, y, c);
    }
  }
}

// ---------- letterforms: a 5-wide, 7-tall bitmap alphabet, drawn by hand ----------
// Each row is five bits, most significant bit on the left.
const GLYPHS: Record<string, number[]> = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  "0": [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  "1": [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  "2": [0x0e, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1f],
  "3": [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  "4": [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  "5": [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  "6": [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  "7": [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  "8": [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  "9": [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  " ": [0, 0, 0, 0, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 0x0c, 0x0c],
  ",": [0, 0, 0, 0, 0x0c, 0x04, 0x08],
  ":": [0, 0x0c, 0x0c, 0, 0x0c, 0x0c, 0],
  ";": [0, 0x0c, 0x0c, 0, 0x0c, 0x04, 0x08],
  "'": [0x04, 0x04, 0x08, 0, 0, 0, 0],
  '"': [0x0a, 0x0a, 0, 0, 0, 0, 0],
  "-": [0, 0, 0, 0x1f, 0, 0, 0],
  "/": [0x01, 0x01, 0x02, 0x04, 0x08, 0x10, 0x10],
  "(": [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ")": [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  "%": [0x19, 0x19, 0x02, 0x04, 0x08, 0x13, 0x13],
  "$": [0x04, 0x0f, 0x14, 0x0e, 0x05, 0x1e, 0x04],
  "&": [0x0c, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0d],
  "+": [0, 0x04, 0x04, 0x1f, 0x04, 0x04, 0],
  "=": [0, 0, 0x1f, 0, 0x1f, 0, 0],
  "?": [0x0e, 0x11, 0x01, 0x02, 0x04, 0, 0x04],
  "!": [0x04, 0x04, 0x04, 0x04, 0x04, 0, 0x04],
  "#": [0x0a, 0x0a, 0x1f, 0x0a, 0x1f, 0x0a, 0x0a],
  "*": [0, 0x04, 0x15, 0x0e, 0x15, 0x04, 0],
  "~": [0, 0, 0x08, 0x15, 0x02, 0, 0],
  "_": [0, 0, 0, 0, 0, 0, 0x1f],
  "@": [0x0e, 0x11, 0x17, 0x15, 0x16, 0x10, 0x0e],
};
const STEP = 6; // glyph advance in units, before scaling
function measure(s: string, size: number): number {
  return s.length * STEP * size - size;
}
function putText(x: number, y: number, s: string, size: number, c: RGB): void {
  let cx = x;
  for (const ch of s.toUpperCase()) {
    const g = GLYPHS[ch] ?? GLYPHS["?"];
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if ((g[r] >> (4 - col)) & 1) fillRect(cx + col * size, y + r * size, size, size, c);
      }
    }
    cx += STEP * size;
  }
}
function putCentered(cx: number, y: number, s: string, size: number, c: RGB): void {
  putText(cx - Math.floor(measure(s, size) / 2), y, s, size, c);
}
function splitWords(s: string, maxChars: number): string[] {
  const out: string[] = [];
  let cur = "";
  for (const w of s.split(" ")) {
    if ((cur + (cur ? " " : "") + w).length <= maxChars) cur += (cur ? " " : "") + w;
    else { if (cur) out.push(cur); cur = w; }
  }
  if (cur) out.push(cur);
  return out;
}
function putPara(x: number, y: number, s: string, size: number, maxChars: number, c: RGB, maxLines = 99): number {
  const lines = splitWords(s, maxChars).slice(0, maxLines);
  lines.forEach((ln, i) => putText(x, y + i * 8 * size, ln, size, c));
  return lines.length;
}

// ---------- three big hero scenes ----------
// 1. Shenzhen at dusk: a night sky, a moon, towers with lit windows,
//    a waterfront and three flags on poles.
function sceneShenzhen(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, DUSK);
  fillRect(x, y + 52, w, h - 52, [22, 34, 78]);
  disc(x + w - 46, y + 20, 12, [255, 214, 96]);
  disc(x + w - 46, y + 20, 8, [255, 228, 140]);
  const ground = y + h - 10;
  const towers: [number, number, number][] = [
    [10, 34, 58], [48, 26, 74], [80, 40, 64], [124, 30, 86],
    [158, 44, 58], [206, 28, 76], [238, 38, 62], [280, 30, 70],
  ];
  for (const [tx, tw, th] of towers) {
    fillRect(x + tx, ground - th, tw, th, [44, 58, 96]);
    for (let wy = ground - th + 7; wy < ground - 5; wy += 11) {
      for (let wx = x + tx + 4; wx < x + tx + tw - 5; wx += 10) {
        if ((wx * 5 + wy * 7) % 13 < 7) fillRect(wx, wy, 3, 4, [255, 205, 80]);
      }
    }
  }
  // tallest tower with an antenna
  fillRect(x + 158, ground - 58 - 16, 4, 16, [44, 58, 96]);
  disc(x + 160, ground - 58 - 17, 2, CRIMSON);
  fillRect(x, ground, w, 10, [10, 16, 40]);
  const flagCols: RGB[] = [[204, 30, 36], [226, 44, 18], SNOW];
  for (let i = 0; i < 3; i++) {
    const fx = x + 16 + i * 28;
    ruleV(fx, y + h - 36, 28, [225, 225, 225]);
    fillRect(fx + 1, y + h - 36, 20, 11, flagCols[i]);
  }
}
// 2. The Gulf at dawn: a rising sun, a dark sea, an oil platform and
//    two drones crossing the sky on dotted trails.
function sceneGulf(x: number, y: number, w: number, h: number): void {
  const skyBands: RGB[] = [[252, 214, 140], [244, 178, 110], [226, 130, 96]];
  const bh = Math.ceil(h / 3);
  skyBands.forEach((c, i) => fillRect(x, y + i * bh, w, bh, c));
  disc(x + w / 2, y + h - 30, 20, [255, 236, 170]);
  disc(x + w / 2, y + h - 30, 14, [255, 244, 200]);
  fillRect(x, y + h - 34, w, 34, [24, 52, 92]);
  for (let i = 0; i < 14; i++) {
    const wx = x + 12 + i * 24;
    segment(wx, y + h - 26, wx + 12, y + h - 20, [70, 120, 170]);
  }
  // oil platform, left
  fillRect(x + 22, y + h - 52, 60, 18, [30, 30, 34]);
  fillRect(x + 30, y + h - 70, 6, 18, [30, 30, 34]);
  fillRect(x + 68, y + h - 70, 6, 18, [30, 30, 34]);
  fillRect(x + 26, y + h - 76, 52, 6, [30, 30, 34]);
  fillRect(x + 48, y + h - 92, 4, 16, [30, 30, 34]);
  disc(x + 50, y + h - 94, 3, CRIMSON);
  // drones with dotted trails
  for (let i = 0; i < 9; i++) {
    dot(x + 190 + i * 8, y + 26 - Math.floor(i / 3), INK);
    dot(x + 210 + i * 7, y + 44 + Math.floor(i / 4), INK);
  }
  fillRect(x + 262, y + 22, 10, 4, INK);
  fillRect(x + 264, y + 18, 6, 4, INK);
  fillRect(x + 268, y + 40, 10, 4, INK);
  fillRect(x + 270, y + 36, 6, 4, INK);
}
// 3. The Capitol in Washington: a pale sky, a domed hall with columns,
//    wide steps and a flag.
function sceneCapitol(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [216, 228, 240]);
  disc(x + 46, y + 22, 13, [255, 212, 110]);
  fillRect(x + 74, y + 36, w - 148, h - 54, [240, 234, 220]);
  fillPoly([[x + 74, y + 36], [x + w - 74, y + 36], [x + w / 2, y + 14]], [178, 48, 48]);
  disc(x + w / 2, y + 28, 5, MUSTARD);
  // dome
  disc(x + w / 2, y + 34, 22, [238, 232, 218]);
  fillRect(x + w / 2 - 22, y + 34, 44, 6, [238, 232, 218]);
  ruleV(x + w / 2, y + 8, 6, [90, 90, 90]);
  disc(x + w / 2, y + 7, 2, MUSTARD);
  for (let i = 0; i < 5; i++) {
    const cx = x + 90 + i * ((w - 180) / 4);
    fillRect(cx, y + 42, 11, h - 76, SNOW);
    fillRect(cx - 2, y + 38, 15, 5, [222, 216, 200]);
    fillRect(cx - 2, y + h - 38, 15, 5, [222, 216, 200]);
  }
  fillRect(x + w / 2 - 13, y + h - 40, 26, 22, [64, 64, 74]);
  fillRect(x + 58, y + h - 18, w - 116, 4, [202, 198, 186]);
  fillRect(x + 50, y + h - 12, w - 100, 4, [188, 184, 172]);
  fillRect(x + 42, y + h - 6, w - 84, 6, [174, 170, 158]);
  ruleV(x + w - 28, y + 16, 42, [90, 90, 90]);
  fillRect(x + w - 27, y + 18, 18, 11, SKY);
  fillRect(x + w - 27, y + 18, 18, 4, CRIMSON);
  fillRect(x + w - 27, y + 25, 18, 4, SNOW);
  disc(x + 28, y + h - 32, 11, FOREST);
  disc(x + w - 54, y + h - 30, 9, FOREST);
}

// ---------- small drawings, one per featured story (56 x 56) ----------
function miniFlags(x: number, y: number): void {
  fillRect(x, y, 56, 56, PAPER);
  ruleV(x + 12, y + 8, 40, [90, 90, 90]);
  ruleV(x + 38, y + 8, 40, [90, 90, 90]);
  fillRect(x + 13, y + 10, 20, 6, SNOW); fillRect(x + 13, y + 16, 20, 6, SKY); fillRect(x + 13, y + 22, 20, 6, CRIMSON);
  fillRect(x + 39, y + 10, 14, 18, SKY); fillRect(x + 45, y + 10, 6, 18, SNOW); fillRect(x + 39, y + 10, 2, 18, SKY);
  fillRect(x + 39, y + 10, 14, 6, SKY);
  disc(x + 25, y + 46, 4, MUSTARD);
}
function miniBridge(x: number, y: number): void {
  fillRect(x, y, 56, 56, [202, 226, 240]);
  segment(x + 4, y + 30, x + 28, y + 14, [90, 90, 90]);
  segment(x + 52, y + 30, x + 28, y + 14, [90, 90, 90]);
  ruleV(x + 28, y + 14, 16, [90, 90, 90]);
  fillRect(x + 4, y + 30, 48, 4, [70, 70, 70]);
  for (let i = 0; i < 5; i++) segment(x + 8 + i * 9, y + 38, x + 12 + i * 9, y + 44, SKY);
  ruleH(x + 4, y + 46, 48, SKY);
  segment(x + 20, y + 8, x + 28, y + 14, CRIMSON);
  segment(x + 36, y + 8, x + 28, y + 14, CRIMSON);
}
function miniMissile(x: number, y: number): void {
  fillRect(x, y, 56, 56, [16, 24, 64]);
  disc(x + 12, y + 12, 2, SNOW); disc(x + 44, y + 20, 2, SNOW); disc(x + 20, y + 42, 2, SNOW);
  fillPoly([[x + 28, y + 6], [x + 34, y + 20], [x + 28, y + 44], [x + 22, y + 20]], [220, 220, 220]);
  fillPoly([[x + 28, y + 6], [x + 32, y + 14], [x + 24, y + 14]], CRIMSON);
  fillPoly([[x + 22, y + 34], [x + 14, y + 44], [x + 22, y + 40]], CRIMSON);
  fillPoly([[x + 34, y + 34], [x + 42, y + 44], [x + 34, y + 40]], CRIMSON);
  fillPoly([[x + 25, y + 44], [x + 31, y + 44], [x + 28, y + 52]], MUSTARD);
}
function miniChip(x: number, y: number): void {
  fillRect(x, y, 56, 56, [238, 240, 246]);
  fillRect(x + 16, y + 16, 24, 24, DEEPBLUE);
  fillRect(x + 22, y + 22, 12, 12, [120, 200, 120]);
  for (let i = 0; i < 4; i++) {
    ruleH(x + 18 + i * 6, y + 12, 2, MUSTARD); ruleH(x + 18 + i * 6, y + 44, 2, MUSTARD);
    ruleV(x + 12, y + 18 + i * 6, 2, MUSTARD); ruleV(x + 44, y + 18 + i * 6, 2, MUSTARD);
  }
}
function miniCyclone(x: number, y: number): void {
  fillRect(x, y, 56, 56, [220, 235, 245]);
  for (let r = 4; r <= 24; r += 5) circ(x + 28, y + 28, r, r % 10 === 4 ? SKY : TEAL);
  disc(x + 28, y + 28, 5, SNOW);
  disc(x + 28, y + 28, 2, CRIMSON);
  ruleH(x + 6, y + 50, 44, SKY);
}
function miniDish(x: number, y: number): void {
  fillRect(x, y, 56, 56, [16, 24, 64]);
  disc(x + 28, y + 14, 3, SNOW);
  disc(x + 14, y + 30, 2, SNOW);
  disc(x + 44, y + 38, 2, SNOW);
  fillPoly([[x + 14, y + 22], [x + 42, y + 22], [x + 28, y + 38]], MUSTARD);
  fillRect(x + 26, y + 38, 4, 8, [200, 200, 200]);
  circ(x + 28, y + 12, 8, [140, 200, 255]);
  circ(x + 28, y + 12, 13, [140, 200, 255]);
}
function miniBank(x: number, y: number): void {
  fillRect(x, y, 56, 56, [214, 228, 240]);
  fillRect(x + 10, y + 34, 36, 16, [240, 236, 224]);
  disc(x + 28, y + 34, 13, [240, 236, 224]);
  ruleV(x + 27, y + 14, 8, [90, 90, 90]);
  disc(x + 28, y + 13, 3, MUSTARD);
  for (let i = 0; i < 4; i++) ruleV(x + 14 + i * 8, y + 38, 10, [180, 174, 160]);
  fillRect(x + 6, y + 50, 44, 4, [180, 174, 160]);
  disc(x + 44, y + 12, 8, MUSTARD);
  putText(x + 41, y + 9, "E", 1, INK);
}
function miniHelmet(x: number, y: number): void {
  fillRect(x, y, 56, 56, [238, 236, 228]);
  disc(x + 28, y + 24, 15, DEEPBLUE);
  fillRect(x + 13, y + 24, 30, 6, DEEPBLUE);
  fillRect(x + 13, y + 30, 30, 3, MUSTARD);
  ruleV(x + 40, y + 26, 14, [200, 200, 200]);
  fillRect(x + 40, y + 26, 2, 14, [200, 200, 200]);
  segment(x + 10, y + 50, x + 30, y + 40, [150, 110, 60]);
  fillRect(x + 28, y + 38, 10, 5, [150, 110, 60]);
  disc(x + 46, y + 46, 4, CRIMSON);
}
function miniStumps(x: number, y: number): void {
  fillRect(x, y, 56, 56, [222, 235, 210]);
  fillRect(x + 20, y + 18, 4, 26, MUSTARD);
  fillRect(x + 27, y + 18, 4, 26, MUSTARD);
  fillRect(x + 34, y + 18, 4, 26, MUSTARD);
  fillRect(x + 20, y + 14, 18, 3, MUSTARD);
  fillRect(x + 14, y + 44, 28, 4, [150, 110, 60]);
  disc(x + 46, y + 12, 5, CRIMSON);
  segment(x + 44, y + 16, x + 38, y + 26, CRIMSON);
  segment(x + 10, y + 50, x + 46, y + 50, FOREST);
}
function miniLectern(x: number, y: number): void {
  fillRect(x, y, 56, 56, [238, 236, 228]);
  fillRect(x + 18, y + 22, 20, 26, [90, 60, 40]);
  fillPoly([[x + 14, y + 22], [x + 42, y + 22], [x + 28, y + 12]], [110, 75, 50]);
  segment(x + 28, y + 12, x + 34, y + 6, [60, 60, 60]);
  disc(x + 34, y + 5, 2, [60, 60, 60]);
  fillRect(x + 24, y + 48, 8, 4, [60, 60, 60]);
  fillRect(x + 22, y + 30, 12, 2, SNOW);
}
function miniMedCross(x: number, y: number): void {
  fillRect(x, y, 56, 56, [238, 240, 246]);
  disc(x + 28, y + 28, 20, SNOW);
  circ(x + 28, y + 28, 20, CRIMSON);
  fillRect(x + 25, y + 16, 6, 24, CRIMSON);
  fillRect(x + 16, y + 25, 24, 6, CRIMSON);
}
function miniVirus(x: number, y: number): void {
  fillRect(x, y, 56, 56, [238, 240, 246]);
  disc(x + 28, y + 28, 14, CRIMSON);
  for (let a = 0; a < 360; a += 45) {
    const t = (a * Math.PI) / 180;
    segment(x + 28 + Math.round(13 * Math.cos(t)), y + 28 + Math.round(13 * Math.sin(t)),
      x + 28 + Math.round(20 * Math.cos(t)), y + 28 + Math.round(20 * Math.sin(t)), CRIMSON);
  }
  disc(x + 23, y + 24, 3, SNOW);
  disc(x + 33, y + 32, 2, SNOW);
}

// ---------- world map: rough continent outlines, drawn from memory ----------
const LAND: [number, number][][] = [
  // North America
  [[-168, 66], [-140, 70], [-120, 71], [-100, 72], [-85, 70], [-75, 68], [-60, 62], [-55, 52], [-65, 45], [-75, 38], [-80, 32], [-84, 30], [-90, 21], [-95, 18], [-100, 20], [-105, 23], [-112, 29], [-120, 34], [-125, 42], [-125, 49], [-135, 58], [-155, 58], [-168, 66]],
  // South America
  [[-80, 9], [-72, 12], [-62, 10], [-52, 5], [-44, -3], [-38, -8], [-40, -15], [-46, -24], [-52, -32], [-58, -38], [-65, -45], [-70, -52], [-73, -40], [-72, -25], [-78, -15], [-80, -5], [-80, 5]],
  // Europe
  [[-10, 37], [-9, 43], [-2, 48], [0, 51], [4, 53], [8, 57], [12, 55], [18, 56], [21, 55], [24, 59], [28, 61], [30, 65], [25, 68], [18, 69], [12, 64], [5, 60], [-4, 57], [-8, 51], [-10, 44]],
  // Africa
  [[-17, 15], [-12, 28], [-6, 34], [2, 37], [10, 37], [19, 32], [30, 31], [34, 28], [38, 20], [43, 12], [48, 11], [51, 12], [44, 2], [40, -8], [36, -18], [33, -26], [28, -33], [20, -35], [16, -28], [12, -18], [9, -2], [9, 4], [-6, 5], [-13, 8], [-17, 12]],
  // Asia
  [[30, 62], [40, 68], [55, 69], [70, 72], [90, 75], [110, 76], [130, 72], [150, 70], [170, 66], [178, 65], [170, 60], [162, 56], [155, 59], [142, 52], [140, 42], [135, 34], [129, 33], [127, 38], [122, 31], [118, 25], [110, 20], [106, 10], [102, 8], [98, 14], [94, 17], [90, 22], [86, 20], [80, 14], [77, 8], [75, 18], [70, 24], [64, 25], [58, 26], [54, 27], [50, 29], [48, 30], [44, 29], [40, 31], [36, 36], [33, 36], [30, 36], [28, 41], [30, 44], [28, 49], [30, 54]],
  // Australia
  [[114, -22], [114, -30], [116, -35], [122, -34], [128, -32], [133, -32], [136, -35], [140, -38], [145, -38], [150, -37], [153, -28], [150, -23], [146, -19], [142, -14], [142, -11], [137, -12], [134, -13], [130, -13], [126, -14], [122, -17], [118, -20]],
];
function project(lon: number, lat: number, mx: number, my: number, mw: number, mh: number): [number, number] {
  return [Math.round(mx + ((lon + 180) / 360) * mw), Math.round(my + ((82 - lat) / 164) * mh)];
}
type Pin = { lon: number; lat: number; num: string; dx: number; dy: number };
function drawWorldMap(x: number, y: number, w: number, h: number, pins: Pin[]): void {
  fillRect(x, y, w, h, [222, 235, 240]);
  for (const land of LAND) {
    const pts = land.map(([lo, la]) => project(lo, la, x, y, w, h));
    fillPoly(pts, [196, 204, 170]);
    for (let i = 0; i < pts.length; i++) {
      segment(pts[i][0], pts[i][1], pts[(i + 1) % pts.length][0], pts[(i + 1) % pts.length][1], [140, 150, 120]);
    }
  }
  for (const p of pins) {
    const [px, py] = project(p.lon, p.lat, x, y, w, h);
    disc(px, py, 6, CRIMSON);
    disc(px, py, 3, SNOW);
    putText(px + p.dx, py + p.dy, p.num, 1, CRIMSON);
  }
}

// ---------- the day's stories: 35, from 6 continents ----------
// Heroes: the three biggest stories, each with its own drawn scene.
type Hero = { tag: string; place: string; head: string; body: string; scene: "shenzhen" | "gulf" | "capitol" };
const HEROES: Hero[] = [
  {
    tag: "1 ASIA - SUMMIT", place: "SHENZHEN", head: "APEC OPENS IN SHENZHEN",
    body: "Xi opens the summit defending free trade. Putin arrives; Trump due Thursday.",
    scene: "shenzhen",
  },
  {
    tag: "2 MIDDLE EAST - WAR", place: "THE GULF", head: "IRAN HITS BACK IN THE GULF",
    body: "Tehran fires drones at US bases in Kuwait and Bahrain after US strikes on Qeshm.",
    scene: "gulf",
  },
  {
    tag: "3 AMERICAS - POLITICS", place: "WASHINGTON", head: "DEMOCRATS TAKE THE SENATE",
    body: "Peltola beats Sullivan in Alaska, AP calls it. Democrats take a 56-44 majority.",
    scene: "capitol",
  },
];
// Featured: 12 stories, each with its own small drawing.
type Featured = { n: number; tag: string; head: string; body: string; draw: (x: number, y: number) => void };
const FEATURED: Featured[] = [
  { n: 4, tag: "ASIA - DIPLOMACY", head: "TRUMP MEETS MARCOS IN MANILA",
    body: "Trump meets the Philippine president, then flies on to Shenzhen.",
    draw: miniFlags },
  { n: 5, tag: "EUROPE - WAR", head: "CRIMEA BRIDGE HIT AGAIN",
    body: "A Ukrainian attack partly collapses the bridge. Traffic halts on the link to Russia.",
    draw: miniBridge },
  { n: 6, tag: "ASIA - DEFENCE", head: "NORTH KOREA CLAIMS HYPERSONIC TEST",
    body: "Pyongyang says a missile flew Mach 12 for 1,500 km. Seoul doubts the claim.",
    draw: miniMissile },
  { n: 7, tag: "AMERICAS - TECH", head: "NVIDIA DOUBLES ITS REVENUE",
    body: "Sales hit $115.84B, up 103%. First quarter since Huang left; Kress in charge.",
    draw: miniChip },
  { n: 8, tag: "ASIA - WEATHER", head: "CYCLONE AKVAN NEARS INDIA",
    body: "Seven districts on red alert as the storm bears down. Gusts to 145 km/h.",
    draw: miniCyclone },
  { n: 9, tag: "WORLD - SPACE", head: "VOYAGER 1 REACHES ONE LIGHT-DAY",
    body: "NASA's probe passes the milestone almost 50 years after launch.",
    draw: miniDish },
  { n: 10, tag: "EUROPE - ECONOMY", head: "EU PLANS 45B-EURO UKRAINE LOAN",
    body: "Commission proposes 45B euros for 2027: 25B in arms and 20B in budget support.",
    draw: miniBank },
  { n: 11, tag: "ASIA - SPORT", head: "DHONI BOWS OUT OF THE IPL",
    body: "Tributes pour in as the 45-year-old cuts a farewell cake. CSK name him mentor.",
    draw: miniHelmet },
  { n: 12, tag: "OCEANIA - SPORT", head: "DUCKETT'S 133 WINS ODI SERIES",
    body: "England beat Australia by 97 runs in Hobart to take the three-match series 2-1.",
    draw: miniStumps },
  { n: 13, tag: "MIDDLE EAST - DIPLOMACY", head: "BOARD OF PEACE BLAMES BOTH SIDES",
    body: "Trump's Board of Peace says Israel and Hamas both failed their commitments.",
    draw: miniLectern },
  { n: 14, tag: "AFRICA - HEALTH", head: "EBOLA HITS CHILDREN HARDEST IN DRC",
    body: "Three in four children under five die in the outbreak, health workers report.",
    draw: miniMedCross },
  { n: 15, tag: "AMERICAS - HEALTH", head: "US LOSES MEASLES-FREE STATUS",
    body: "More than 5,400 cases and 10 deaths end a status held for 26 years.",
    draw: miniVirus },
];
// Also on: 20 more one-line stories, taking the total to 35.
type AlsoOn = { n: number; head: string; body: string };
const ALSO: AlsoOn[] = [
  { n: 16, head: "XI AND PUTIN MEET IN SHENZHEN", body: "Leaders coordinate ahead of Thursday's talks." },
  { n: 17, head: "MARCOS FLIES TO SHENZHEN", body: "President leaves for APEC after hosting ASEAN." },
  { n: 18, head: "LEE BUILDS BRIDGES WITH BEIJING", body: "Seoul's president warms ties with China." },
  { n: 19, head: "THAILAND SIGNS US TRADE DEAL", body: "Preliminary pact cuts some tariffs to zero." },
  { n: 20, head: "EU SIGNS OFF INDONESIA DEAL", body: "Council authorises trade and investment pacts." },
  { n: 21, head: "NATO SETS NEXT-GEN COMMS PLAN", body: "Alliance adopts a strategy for future networks." },
  { n: 22, head: "UK INFLATION HITS ONE-YEAR HIGH", body: "Markets trim bets on a rate rise; FTSE slips." },
  { n: 23, head: "OIL SLIDES AS SURPLUS LOOMS", body: "Brent settles at $91.95 as traders weigh supply." },
  { n: 24, head: "MARKETS FALL WORLDWIDE", body: "S and P 500 down 1.03%; VIX jumps 11%." },
  { n: 25, head: "RUSSIAN PLANE CRASHES IN SIBERIA", body: "19 dead in a military plane crash." },
  { n: 26, head: "DRONES OVER DNIPRO INJURE SIX", body: "Ukraine downs 126 of 141 drones by 0800." },
  { n: 27, head: "RUSSIAN JETS BUZZ TAIWAN, JAPAN", body: "Two aircraft violate Japanese airspace." },
  { n: 28, head: "KIM'S DESTROYER LAUNCH FAILS", body: "New 5,000-ton warship damaged at Chongjin." },
  { n: 29, head: "US OUTAGES REACH THE NSA", body: "Repeated computer failures hit federal networks." },
  { n: 30, head: "COGAT SCANNER OPENS AT EREZ", body: "Aid trucks face a new check into Gaza." },
  { n: 31, head: "CANADA TALKS DEFENCE BANK WITH MEXICO", body: "Anand raises joining a global defence bank." },
  { n: 32, head: "GAZA COLD KILLS IN TENTS", body: "WHO: 950,000 displaced on flood-prone ground." },
  { n: 33, head: "64 CHILDREN KILLED IN YEMEN", body: "UNICEF counts the toll since 3 September." },
  { n: 34, head: "TANKER STRUCK OFF HORMUZ", body: "Crew member missing after a projectile hit." },
  { n: 35, head: "CHAHAL FIRST INDIAN TO 400 T20 WICKETS", body: "Leg-spinner reaches the mark in Indore." },
];
const CLOCK: string[] = [
  "07:25 MARCOS LEAVES MANILA FOR SHENZHEN",
  "08:00 UKRAINE COUNTS 141 DRONES, 126 DOWNED",
  "10:16 VOYAGER 1 PASSES ONE LIGHT-DAY",
  "13:52 DUCKETT'S 133 SEALS THE ODI SERIES",
  "20:47 NVIDIA'S $115.84B BEATS THE STREET",
  "22:47 SEOUL DOUBTS PYONGYANG'S MISSILE CLAIM",
];
const PINS: Pin[] = [
  { lon: 114.1, lat: 22.5, num: "1", dx: 7, dy: -3 },
  { lon: 48.0, lat: 29.3, num: "2", dx: 7, dy: -3 },
  { lon: -150.0, lat: 61.5, num: "3", dx: 7, dy: -3 },
  { lon: 121.0, lat: 14.6, num: "4", dx: 7, dy: -3 },
  { lon: 34.0, lat: 45.0, num: "5", dx: 7, dy: -3 },
  { lon: 125.8, lat: 39.0, num: "6", dx: 7, dy: -3 },
  { lon: -121.9, lat: 37.4, num: "7", dx: 7, dy: 6 },
  { lon: 83.3, lat: 17.7, num: "8", dx: 7, dy: -3 },
  { lon: 4.4, lat: 50.8, num: "10", dx: 7, dy: 8 },
  { lon: 147.3, lat: -42.9, num: "12", dx: 7, dy: -3 },
  { lon: 25.0, lat: -2.5, num: "14", dx: 7, dy: -3 },
];
const REGIONS: [string, number, RGB][] = [
  ["EUROPE 7", 7, SKY],
  ["MIDDLE EAST 5", 5, TEAL],
  ["ASIA 12", 12, CRIMSON],
  ["AFRICA 1", 1, MUSTARD],
  ["AMERICAS 6", 6, DEEPBLUE],
  ["OCEANIA 1", 1, FOREST],
  ["WORLD 3", 3, SLATE],
];

// ---------- page layout ----------
function buildPage(): void {
  fillRect(0, 0, PAGE_W, PAGE_H, PAPER);
  // top strip
  putText(8, 7, "THE WORLD'S NEWS IN ONE PICTURE", 1, CRIMSON);
  const countLine = "35 STORIES - 6 CONTINENTS - ONE DAY";
  putText(PAGE_W - 8 - measure(countLine, 1), 7, countLine, 1, INK);
  fillRect(8, 21, PAGE_W - 16, 2, CRIMSON);
  fillRect(8, 23, PAGE_W - 16, 1, MUSTARD);
  // masthead
  putCentered(PAGE_W / 2, 30, "WEDNESDAY 18 NOVEMBER 2026", 4, INK);
  putCentered(PAGE_W / 2, 64, "EVERY STORY HERE HAPPENED, OR WAS FIRST REPORTED, ON WEDNESDAY 18 NOVEMBER 2026 (UTC).", 1, DEEPBLUE);
  ruleH(8, 76, PAGE_W - 16, INK);
  // region bar: seven coloured segments with the story count of each
  const segW = Math.floor((PAGE_W - 16) / REGIONS.length);
  REGIONS.forEach(([label, , col], i) => {
    const sx = 8 + i * segW;
    fillRect(sx, 80, segW - 2, 16, col);
    putText(sx + Math.floor((segW - 2 - measure(label, 1)) / 2), 83, label, 1, SNOW);
  });
  // the day in numbers
  putText(8, 102, "THE DAY IN NUMBERS: 3 LEADERS, 1 SUMMIT - $115.84B NVIDIA - 56-44 SENATE - 145 KM/H AKVAN GUSTS - 5,400 MEASLES CASES - 97-RUN ODI WIN - 1 LIGHT-DAY VOYAGER", 1, INK);
  ruleH(8, 114, PAGE_W - 16, INK);
  // three hero panels
  const heroW = 328;
  const heroX = [8, 348, 688];
  HEROES.forEach((hero, i) => {
    const x = heroX[i];
    frame(x, 120, heroW, 160, INK);
    if (hero.scene === "shenzhen") sceneShenzhen(x + 1, 121, heroW - 2, 88);
    else if (hero.scene === "gulf") sceneGulf(x + 1, 121, heroW - 2, 88);
    else sceneCapitol(x + 1, 121, heroW - 2, 88);
    putText(x + 6, 213, hero.tag + " - " + hero.place, 1, CRIMSON);
    putPara(x + 6, 225, hero.head, 2, 26, INK, 2);
    putPara(x + 6, 258, hero.body, 1, 53, INK, 2);
  });
  ruleH(8, 288, PAGE_W - 16, INK);
  // twelve featured stories: three columns, four rows
  const colX = [8, 348, 688];
  FEATURED.forEach((s, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const x = colX[col];
    const y = 296 + row * 80;
    s.draw(x, y + 4);
    const tx = x + 62;
    putText(tx, y, s.n + " " + s.tag, 1, CRIMSON);
    putPara(tx, y + 11, s.head, 2, 22, INK, 2);
    putPara(tx, y + 45, s.body, 1, 43, INK, 2);
  });
  ruleH(8, 622, PAGE_W - 16, INK);
  // world map, left
  putText(8, 630, "WHERE IT HAPPENED", 1, CRIMSON);
  drawWorldMap(8, 644, 322, 160, PINS);
  putPara(8, 810, "Numbered pins mark the stories above.", 1, 52, SLATE, 1);
  // also on, right: twenty more stories in two columns
  putText(340, 630, "ALSO ON WEDNESDAY 18 NOVEMBER", 1, CRIMSON);
  const alsoX = [340, 684];
  ALSO.forEach((s, idx) => {
    const col = idx < 10 ? 0 : 1;
    const row = idx % 10;
    const x = alsoX[col];
    const y = 644 + row * 20;
    putText(x, y, s.n + " " + s.head, 1, INK);
    putText(x + 12, y + 9, s.body, 1, SLATE);
  });
  ruleH(8, 850, PAGE_W - 16, INK);
  // by the clock
  putText(8, 858, "BY THE CLOCK - UTC", 1, CRIMSON);
  CLOCK.forEach((c, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    putText(8 + col * 340, 874 + row * 18, c, 1, INK);
  });
  ruleH(8, 910, PAGE_W - 16, INK);
  // footer
  putPara(8, 918, "SOURCES: REUTERS, AP, AFP, BBC, AL JAZEERA, BLOOMBERG. ORIGINAL DRAWINGS.", 1, 168, INK, 1);
  putPara(8, 932, "DATE CHECK: ISRAEL'S KNESSET ELECTED MATAN KAHANA SPEAKER ON 17 NOV, NOT TODAY, SO HE IS NOT IN THIS PICTURE. THE HOUTHI DRONE ATTACK ON THE SAUDI PIPELINE WAS 17 NOV TOO.", 1, 168, INK, 2);
  putCentered(PAGE_W / 2, 968, "THE WORLD IN ONE PICTURE - WEDNESDAY, 18 NOVEMBER 2026", 1, SLATE);
}

function main(): void {
  buildPage();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR;
  const target = outDir ? outDir + "/entry.png" : process.argv[2] || "/output/entry.png";
  fs.writeFileSync(target, toPNG(PAGE_W, PAGE_H, canvas));
}

main();
