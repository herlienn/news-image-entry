// News image for 18 November 2026.
// Draws a one-page newspaper front page (1024x1024) with a hand-made
// bitmap font and a hand-written PNG encoder. Standard library only,
// no network, no randomness: every run writes identical bytes.

import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

// ---------------------------------------------------------------- canvas

const W = 1024;
const H = 1024;

// RGBA pixel buffer, row-major.
const px = Buffer.alloc(W * H * 4);

type RGB = [number, number, number];

const PAPER: RGB = [247, 242, 228];
const CARD: RGB = [255, 253, 246];
const INK: RGB = [18, 18, 18];
const GREY: RGB = [96, 92, 84];
const RED: RGB = [176, 30, 36];
const NAVY: RGB = [27, 58, 107];
const GOLD: RGB = [198, 152, 48];
const SKY: RGB = [126, 178, 214];
const TEAL: RGB = [38, 120, 110];
const LIGHT_LINE: RGB = [210, 202, 182];

function setPixel(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
  px[i + 3] = 255;
}

function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) setPixel(i, j, c);
  }
}

function strokeRect(x: number, y: number, w: number, h: number, c: RGB, t: number): void {
  fillRect(x, y, w, t, c);
  fillRect(x, y + h - t, w, t, c);
  fillRect(x, y, t, h, c);
  fillRect(x + w - t, y, t, h, c);
}

function hline(x: number, y: number, len: number, c: RGB, t: number): void {
  fillRect(x, y, len, t, c);
}

function vline(x: number, y: number, len: number, c: RGB, t: number): void {
  fillRect(x, y, t, len, c);
}

// Bresenham line, with a square brush of side `t`.
function line(x0: number, y0: number, x1: number, y1: number, c: RGB, t: number): void {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  const half = Math.floor(t / 2);
  for (let guard = 0; guard < 4096; guard++) {
    fillRect(x - half, y - half, t, t, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

function fillCircle(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y));
    for (let x = -half; x <= half; x++) setPixel(cx + x, cy + y, c);
  }
}

function circleOutline(cx: number, cy: number, r: number, c: RGB, t: number): void {
  for (let a = 0; a < 360; a += 1) {
    const rad = (a * Math.PI) / 180;
    const x = Math.round(cx + r * Math.cos(rad));
    const y = Math.round(cy + r * Math.sin(rad));
    fillRect(x - Math.floor(t / 2), y - Math.floor(t / 2), t, t, c);
  }
}

// Ellipse outline, drawn parametrically.
function ellipseOutline(cx: number, cy: number, rx: number, ry: number, c: RGB, t: number): void {
  for (let a = 0; a < 360; a += 1) {
    const rad = (a * Math.PI) / 180;
    const x = Math.round(cx + rx * Math.cos(rad));
    const y = Math.round(cy + ry * Math.sin(rad));
    fillRect(x - Math.floor(t / 2), y - Math.floor(t / 2), t, t, c);
  }
}

function fillTriangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
  const minX = Math.min(x0, x1, x2);
  const maxX = Math.max(x0, x1, x2);
  const minY = Math.min(y0, y1, y2);
  const maxY = Math.max(y0, y1, y2);
  const d = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
  if (d === 0) return;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const a = ((y1 - y2) * (x - x2) + (x2 - x1) * (y - y2)) / d;
      const b = ((y2 - y0) * (x - x2) + (x0 - x2) * (y - y2)) / d;
      const cc = 1 - a - b;
      if (a >= 0 && b >= 0 && cc >= 0) setPixel(x, y, c);
    }
  }
}

// ---------------------------------------------------------------- PNG out

const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  // Raw scanlines, filter type 0 (none) per row.
  const raw = Buffer.alloc(H * (1 + W * 4));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 4)] = 0;
    px.copy(raw, y * (1 + W * 4) + 1, y * W * 4, (y + 1) * W * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- bitmap font
//
// Hand-drawn 5x7 pixel font. Each glyph is 7 rows of 5 bits, written as
// strings of "1" (filled) and "0" (empty). Only the characters the page
// uses are defined; anything else renders as a blank.

const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  $: ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "+": ["00000", "00100", "00100", "01110", "00100", "00100", "00000"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  a: ["00000", "00000", "01110", "00001", "01111", "10001", "01111"],
  b: ["10000", "10000", "10110", "11001", "10001", "10001", "11110"],
  c: ["00000", "00000", "01110", "10001", "10000", "10001", "01110"],
  d: ["00001", "00001", "01101", "10011", "10001", "10001", "01111"],
  e: ["00000", "00000", "01110", "10001", "11111", "10000", "01110"],
  f: ["00110", "01001", "01000", "11110", "01000", "01000", "01000"],
  g: ["00000", "01111", "10001", "10001", "01111", "00001", "01110"],
  h: ["10000", "10000", "10110", "11001", "10001", "10001", "10001"],
  i: ["00100", "00000", "01100", "00100", "00100", "00100", "01110"],
  j: ["00010", "00000", "00110", "00010", "00010", "10010", "01100"],
  k: ["10000", "10000", "10010", "10100", "11000", "10100", "10010"],
  l: ["01100", "00100", "00100", "00100", "00100", "00100", "01110"],
  m: ["00000", "00000", "11010", "10101", "10101", "10101", "10101"],
  n: ["00000", "00000", "10110", "11001", "10001", "10001", "10001"],
  o: ["00000", "00000", "01110", "10001", "10001", "10001", "01110"],
  p: ["00000", "00000", "11110", "10001", "11110", "10000", "10000"],
  q: ["00000", "00000", "01101", "10011", "01111", "00001", "00001"],
  r: ["00000", "00000", "10110", "11001", "10000", "10000", "10000"],
  s: ["00000", "00000", "01111", "10000", "01110", "00001", "11110"],
  t: ["01000", "01000", "11100", "01000", "01000", "01001", "00110"],
  u: ["00000", "00000", "10001", "10001", "10001", "10011", "01101"],
  v: ["00000", "00000", "10001", "10001", "10001", "01010", "00100"],
  w: ["00000", "00000", "10001", "10101", "10101", "10101", "01010"],
  x: ["00000", "00000", "10001", "01010", "00100", "01010", "10001"],
  y: ["00000", "00000", "10001", "10001", "01111", "00001", "01110"],
  z: ["00000", "00000", "11111", "00010", "00100", "01000", "11111"],
};

const BLANK_GLYPH = ["00000", "00000", "00000", "00000", "00000", "00000", "00000"];

// One character cell is 5 units wide plus 1 unit of tracking.
function charAdvance(scale: number): number {
  return 6 * scale;
}

function textWidth(text: string, scale: number): number {
  if (text.length === 0) return 0;
  return text.length * charAdvance(scale) - scale;
}

function drawChar(ch: string, x: number, y: number, scale: number, c: RGB, bold: boolean): void {
  const glyph = FONT[ch] ?? BLANK_GLYPH;
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 5; col++) {
      if (glyph[row][col] === "1") {
        fillRect(x + col * scale, y + row * scale, scale, scale, c);
        if (bold) fillRect(x + col * scale + 1, y + row * scale, scale, scale, c);
      }
    }
  }
}

function drawText(text: string, x: number, y: number, scale: number, c: RGB, bold = false): number {
  let cx = x;
  for (const ch of text) {
    drawChar(ch, cx, y, scale, c, bold);
    cx += charAdvance(scale);
  }
  return cx - x - scale;
}

function drawTextCentered(text: string, cx: number, y: number, scale: number, c: RGB, bold = false): void {
  const w = textWidth(text, scale);
  drawText(text, cx - Math.floor(w / 2), y, scale, c, bold);
}

// Greedy word wrap to a maximum pixel width. Words longer than the
// width are split by character.
function wrapText(text: string, maxWidth: number, scale: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const trial = cur === "" ? word : cur + " " + word;
    if (textWidth(trial, scale) <= maxWidth) {
      cur = trial;
      continue;
    }
    if (cur !== "") lines.push(cur);
    if (textWidth(word, scale) > maxWidth) {
      let rest = word;
      while (textWidth(rest, scale) > maxWidth) {
        let cut = 0;
        while (cut < rest.length && textWidth(rest.slice(0, cut + 1), scale) <= maxWidth) cut++;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      cur = rest;
    } else {
      cur = word;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

// ---------------------------------------------------------------- pictograms
//
// Each icon is drawn from plain shapes inside a square of side `s` whose
// top-left corner is (x, y).

// A globe: blue disc, cream latitude lines and a longitude ellipse.
function iconGlobe(x: number, y: number, s: number): void {
  const cx = x + Math.floor(s / 2);
  const cy = y + Math.floor(s / 2);
  const r = Math.floor(s / 2) - 3;
  fillCircle(cx, cy, r, NAVY);
  circleOutline(cx, cy, r, INK, 2);
  ellipseOutline(cx, cy, Math.floor(r * 0.45), r, PAPER, 2);
  hline(cx - r + 4, cy - Math.floor(r * 0.55), 2 * r - 8, PAPER, 2);
  hline(cx - r + 1, cy, 2 * r - 2, PAPER, 2);
  hline(cx - r + 4, cy + Math.floor(r * 0.55), 2 * r - 8, PAPER, 2);
  // A small red marker dot for Shenzhen.
  fillCircle(cx + Math.floor(r * 0.42), cy + Math.floor(r * 0.18), 4, RED);
}

// Four linked circles: the four Quad partners talking.
function iconQuad(x: number, y: number, s: number): void {
  const cy = y + Math.floor(s * 0.42);
  const step = Math.floor(s / 4);
  const cols: RGB[] = [RED, NAVY, TEAL, GOLD];
  for (let i = 0; i < 4; i++) {
    const cx = x + Math.floor(step / 2) + i * step;
    if (i < 3) line(cx + 12, cy, cx + step - 12, cy, INK, 3);
    fillCircle(cx, cy, 11, cols[i]);
    circleOutline(cx, cy, 11, INK, 2);
  }
  // A small flag on a pole above the row.
  const px0 = x + Math.floor(s / 2) - 1;
  vline(px0, y + 8, Math.floor(s * 0.2), INK, 3);
  fillRect(px0 + 2, y + 8, 34, 12, RED);
  fillRect(px0 + 2, y + 20, 34, 4, PAPER);
  fillRect(px0 + 2, y + 24, 34, 4, RED);
  // Podium line under the row.
  hline(x + 8, y + s - 16, s - 16, INK, 3);
}

// A burst: radiating spikes around a core, for strikes and blasts.
function iconBurst(x: number, y: number, s: number): void {
  const cx = x + Math.floor(s / 2);
  const cy = y + Math.floor(s / 2);
  const r0 = Math.floor(s * 0.16);
  const r1 = Math.floor(s * 0.48);
  for (let a = 0; a < 12; a++) {
    const ang = (a * Math.PI) / 6;
    const inner = a % 2 === 0 ? r0 : Math.floor(r0 * 1.7);
    const xA = Math.round(cx + inner * Math.cos(ang));
    const yA = Math.round(cy + inner * Math.sin(ang));
    const xB = Math.round(cx + r1 * Math.cos(ang + 0.22));
    const yB = Math.round(cy + r1 * Math.sin(ang + 0.22));
    const xC = Math.round(cx + r1 * Math.cos(ang - 0.22));
    const yC = Math.round(cy + r1 * Math.sin(ang - 0.22));
    fillTriangle(xA, yA, xB, yB, xC, yC, a % 2 === 0 ? RED : GOLD);
  }
  fillCircle(cx, cy, r0, INK);
  fillCircle(cx, cy, Math.floor(r0 * 0.55), PAPER);
}

// A bridge over waves.
function iconBridge(x: number, y: number, s: number): void {
  const deckY = y + Math.floor(s * 0.42);
  const towerH = Math.floor(s * 0.34);
  // Towers.
  fillRect(x + Math.floor(s * 0.18), deckY - towerH, 6, towerH, INK);
  fillRect(x + Math.floor(s * 0.78), deckY - towerH, 6, towerH, INK);
  // Cables from tower tops to the deck.
  line(x + Math.floor(s * 0.18) + 3, deckY - towerH, x + Math.floor(s * 0.5), deckY, RED, 3);
  line(x + Math.floor(s * 0.78) + 3, deckY - towerH, x + Math.floor(s * 0.5), deckY, RED, 3);
  line(x + Math.floor(s * 0.18) + 3, deckY - towerH, x + 6, deckY, INK, 2);
  line(x + Math.floor(s * 0.78) + 3, deckY - towerH, x + s - 6, deckY, INK, 2);
  // Deck.
  hline(x + 4, deckY, s - 8, INK, 5);
  // Waves below.
  for (let w = 0; w < 3; w++) {
    const wy = deckY + 16 + w * 12;
    for (let i = 0; i < 4; i++) {
      const wx = x + 8 + i * Math.floor((s - 16) / 4);
      line(wx, wy, wx + 10, wy - 5, SKY, 3);
      line(wx + 10, wy - 5, wx + 20, wy, SKY, 3);
    }
  }
}

// A rocket climbing diagonally, with a flame.
function iconRocket(x: number, y: number, s: number): void {
  const cx = x + Math.floor(s / 2);
  const cy = y + Math.floor(s / 2);
  // Flame.
  fillTriangle(cx - 16, cy + 22, cx + 16, cy + 22, cx, cy + Math.floor(s * 0.48), GOLD);
  fillTriangle(cx - 9, cy + 22, cx + 9, cy + 22, cx, cy + Math.floor(s * 0.38), RED);
  // Body.
  fillRect(cx - 11, cy - 30, 22, 52, NAVY);
  strokeRect(cx - 11, cy - 30, 22, 52, INK, 2);
  // Nose cone.
  fillTriangle(cx - 11, cy - 30, cx + 11, cy - 30, cx, cy - 46, RED);
  // Window.
  fillCircle(cx, cy - 8, 6, SKY);
  circleOutline(cx, cy - 8, 6, INK, 2);
  // Fins.
  fillTriangle(cx - 11, cy + 8, cx - 11, cy + 22, cx - 24, cy + 26, RED);
  fillTriangle(cx + 11, cy + 8, cx + 11, cy + 22, cx + 24, cy + 26, RED);
}

// A computer chip with rising bars: markets and tech.
function iconChip(x: number, y: number, s: number): void {
  const cx = x + Math.floor(s / 2);
  const cy = y + Math.floor(s / 2);
  const half = Math.floor(s * 0.26);
  // Pins on all four sides.
  for (let i = -1; i <= 1; i++) {
    const off = i * 16;
    hline(cx + off - 4, cy - half - 12, 8, INK, 3);
    hline(cx + off - 4, cy + half + 9, 8, INK, 3);
    vline(cx - half - 12, cy + off - 4, 8, INK, 3);
    vline(cx + half + 9, cy + off - 4, 8, INK, 3);
  }
  fillRect(cx - half, cy - half, half * 2, half * 2, TEAL);
  strokeRect(cx - half, cy - half, half * 2, half * 2, INK, 3);
  // Rising bars inside the chip.
  const barW = 9;
  const baseY = cy + half - 8;
  const heights = [10, 17, 24];
  for (let i = 0; i < 3; i++) {
    const bx = cx - half + 9 + i * (barW + 6);
    fillRect(bx, baseY - heights[i], barW, heights[i], PAPER);
  }
  // Arrow over the bars.
  line(cx - half + 8, baseY - 26, cx + half - 10, baseY - 34, GOLD, 3);
  fillTriangle(cx + half - 12, baseY - 40, cx + half - 4, baseY - 30, cx + half - 16, baseY - 28, GOLD);
}

// A cyclone: three concentric arcs with a calm eye.
function iconCyclone(x: number, y: number, s: number): void {
  const cx = x + Math.floor(s / 2);
  const cy = y + Math.floor(s / 2);
  for (let k = 0; k < 3; k++) {
    const r = 8 + k * 9;
    for (let a = 20 + k * 40; a < 320 + k * 40; a += 2) {
      const rad = (a * Math.PI) / 180;
      setPixel(Math.round(cx + r * Math.cos(rad)), Math.round(cy + r * Math.sin(rad)), TEAL);
      setPixel(Math.round(cx + r * Math.cos(rad)) + 1, Math.round(cy + r * Math.sin(rad)), TEAL);
    }
  }
  fillCircle(cx, cy, 5, RED);
}

// A cricket bat and ball.
function iconBat(x: number, y: number, s: number): void {
  const cx = x + Math.floor(s / 2);
  const cy = y + Math.floor(s / 2);
  // Bat blade, tilted.
  fillRect(cx - 26, cy - 6, 34, 12, GOLD);
  strokeRect(cx - 26, cy - 6, 34, 12, INK, 2);
  // Handle.
  fillRect(cx + 8, cy - 3, 22, 6, INK);
  // Ball.
  fillCircle(cx + 2, cy + 22, 8, RED);
  circleOutline(cx + 2, cy + 22, 8, INK, 2);
}

// ---------------------------------------------------------------- the page
//
// Layout (1024x1024, margin 32):
//   masthead + date, lead story (APEC), five full-width story rows,
//   a bottom strip with two short items, and a footer line.

const MARGIN = 32;
const RIGHT = W - MARGIN;

function drawMasthead(): void {
  drawTextCentered("WORLD NEWS", Math.floor(W / 2), 20, 8, INK, true);
  hline(MARGIN, 86, RIGHT - MARGIN, RED, 6);
  hline(MARGIN, 96, RIGHT - MARGIN, GOLD, 2);
  drawTextCentered("WEDNESDAY, 18 NOVEMBER 2026", Math.floor(W / 2), 106, 3, NAVY, true);
  hline(MARGIN, 134, RIGHT - MARGIN, INK, 2);
}

function drawLead(): void {
  const y = 144;
  const h = 158;
  fillRect(MARGIN, y, RIGHT - MARGIN, h, CARD);
  strokeRect(MARGIN, y, RIGHT - MARGIN, h, INK, 2);
  iconGlobe(48, 156, 134);
  const tx = 204;
  drawText("ASIA-PACIFIC - LEAD STORY", tx, y + 14, 2, RED, true);
  drawText("APEC OPENS IN SHENZHEN", tx, y + 40, 5, INK, true);
  const summary = [
    "Leaders gather in Shenzhen, China, as the APEC summit opens.",
    "Trade, growth and regional cooperation are on the agenda.",
    "The summit brings together leaders from around the Pacific Rim.",
  ];
  for (let i = 0; i < summary.length; i++) {
    drawText(summary[i], tx, y + 88 + i * 24, 2, INK);
  }
}

interface Story {
  label: string;
  headline: string;
  summary: string;
  icon: (x: number, y: number, s: number) => void;
}

const STORIES: Story[] = [
  {
    label: "ASIA - DIPLOMACY",
    headline: "TRUMP IN MANILA FOR QUAD",
    summary:
      "President Donald Trump arrives in Manila for Quad talks ahead of a visit to China. A Trump-Xi-Putin summit is set for 19 Nov.",
    icon: iconQuad,
  },
  {
    label: "MIDDLE EAST - CONFLICT",
    headline: "US AND IRAN TRADE STRIKES",
    summary:
      "The US hits a missile base on Qeshm Island; Iran strikes a US radar system in Bahrain with drones. Kuwait reports interceptions.",
    icon: iconBurst,
  },
  {
    label: "EUROPE - WAR IN UKRAINE",
    headline: "UKRAINE HITS CRIMEAN BRIDGE",
    summary:
      "Ukraine strikes the Crimean bridge for a second day, as Russia pounds bridges in Kyiv.",
    icon: iconBridge,
  },
  {
    label: "ASIA - SECURITY",
    headline: "NORTH KOREA FIRES MISSILE",
    summary:
      "North Korea launches a ballistic missile towards the Sea of Japan, South Korea says.",
    icon: iconRocket,
  },
  {
    label: "BUSINESS - TECHNOLOGY",
    headline: "NVIDIA REVENUE DOUBLES",
    summary:
      "Nvidia reports quarterly revenue of $115.84 billion, double a year earlier.",
    icon: iconChip,
  },
];

function drawStoryRow(story: Story, y: number): void {
  const h = 112;
  fillRect(MARGIN, y, RIGHT - MARGIN, h, CARD);
  strokeRect(MARGIN, y, RIGHT - MARGIN, h, INK, 2);
  story.icon(48, y + 12, 88);
  const tx = 156;
  const maxW = RIGHT - tx - 14;
  drawText(story.label, tx, y + 10, 2, RED, true);
  drawText(story.headline, tx, y + 30, 4, INK, true);
  const lines = wrapText(story.summary, maxW, 2);
  for (let i = 0; i < lines.length && i < 2; i++) {
    drawText(lines[i], tx, y + 64 + i * 24, 2, INK);
  }
}

function drawStrip(): void {
  const y = 918;
  const h = 64;
  const w = 468;
  const items = [
    {
      title: "CYCLONE AKVAN HEADS FOR INDIA",
      sub: "Storm heads for Andhra Pradesh",
      icon: iconCyclone,
    },
    {
      title: "DHONI RETIRES FROM IPL",
      sub: "Dhoni to mentor Super Kings",
      icon: iconBat,
    },
  ];
  for (let k = 0; k < 2; k++) {
    const x = k === 0 ? MARGIN : MARGIN + w + 24;
    fillRect(x, y, w, h, CARD);
    strokeRect(x, y, w, h, INK, 2);
    items[k].icon(x + 10, y + 8, 48);
    drawText(items[k].title, x + 66, y + 12, 2, INK, true);
    drawText(items[k].sub, x + 66, y + 36, 2, GREY);
  }
}

function drawFooter(): void {
  drawTextCentered(
    "THE WORLD IN ONE PICTURE - WEDNESDAY, 18 NOVEMBER 2026",
    Math.floor(W / 2),
    994,
    2,
    GREY,
  );
}

function drawPage(): void {
  fillRect(0, 0, W, H, PAPER);
  drawMasthead();
  drawLead();
  for (let i = 0; i < STORIES.length; i++) {
    drawStoryRow(STORIES[i], 314 + i * 120);
  }
  drawStrip();
  drawFooter();
}

// ---------------------------------------------------------------- entrypoint

function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  fs.mkdirSync(outDir, { recursive: true });
  drawPage();
  const png = encodePng();
  fs.writeFileSync(path.join(outDir, "entry.png"), png);
}

main();
