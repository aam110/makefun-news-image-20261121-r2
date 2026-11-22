// render.ts — pure-Node (stdlib only) raster renderer for the news-image entry.
// Draws into a 2x-supersampled RGB buffer, downsamples for anti-aliasing,
// and encodes a PNG with zlib. Text is rendered from real embedded serif
// font outlines (see glyphs.ts), flattened from quadratic Beziers.
import { deflateSync } from "node:zlib";
import { FACES } from "./glyphs.ts";

export type RGB = [number, number, number];

export const SS = 2; // supersampling factor

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

export class Canvas {
  readonly w: number;
  readonly h: number;
  readonly buf: Uint8Array; // RGB at SS resolution

  constructor(w: number, h: number, bg: RGB) {
    this.w = w;
    this.h = h;
    this.buf = new Uint8Array(w * SS * h * SS * 3);
    this.fillRect(0, 0, w, h, bg);
  }

  private idx(x: number, y: number): number {
    return (y * this.w * SS + x) * 3;
  }

  setPixelSS(x: number, y: number, c: RGB): void {
    if (x < 0 || y < 0 || x >= this.w * SS || y >= this.h * SS) return;
    const i = this.idx(x, y);
    this.buf[i] = c[0];
    this.buf[i + 1] = c[1];
    this.buf[i + 2] = c[2];
  }

  // Fill a rect in page coordinates (floats allowed).
  fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
    const x0 = Math.max(0, Math.round(x * SS));
    const y0 = Math.max(0, Math.round(y * SS));
    const x1 = Math.min(this.w * SS, Math.round((x + w) * SS));
    const y1 = Math.min(this.h * SS, Math.round((y + h) * SS));
    for (let yy = y0; yy < y1; yy++) {
      let i = this.idx(x0, yy);
      for (let xx = x0; xx < x1; xx++) {
        this.buf[i] = c[0];
        this.buf[i + 1] = c[1];
        this.buf[i + 2] = c[2];
        i += 3;
      }
    }
  }

  // Stroke a rect (1px page units by default).
  strokeRect(x: number, y: number, w: number, h: number, c: RGB, t = 1): void {
    this.fillRect(x, y, w, t, c);
    this.fillRect(x, y + h - t, w, t, c);
    this.fillRect(x, y, t, h, c);
    this.fillRect(x + w - t, y, t, h, c);
  }

  // Fill a polygon (page coords) with the non-zero winding rule.
  fillPoly(pts: Array<[number, number]>, c: RGB): void {
    if (pts.length < 3) return;
    const spts = pts.map(([x, y]) => [x * SS, y * SS] as [number, number]);
    this.fillPolySS(spts, c);
  }

  // Fill a polygon given in SS-pixel coordinates.
  fillPolySS(pts: Array<[number, number]>, c: RGB): void {
    this.fillPolysSS([pts], c);
  }

  // Fill several polygons together in ONE scanline pass, so inner contours
  // (counterforms / holes) cut out correctly under the non-zero winding rule.
  fillPolysSS(polys: Array<Array<[number, number]>>, c: RGB): void {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const pts of polys) {
      for (const [, y] of pts) {
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    const y0 = Math.max(0, Math.floor(minY));
    const y1 = Math.min(this.h * SS - 1, Math.ceil(maxY));
    const crossings: Array<[number, number]> = [];
    for (let y = y0; y <= y1; y++) {
      const yc = y + 0.5;
      crossings.length = 0;
      for (const pts of polys) {
        const n = pts.length;
        for (let i = 0; i < n; i++) {
          const [x0, y0p] = pts[i];
          const [x1, y1p] = pts[(i + 1) % n];
          if (y0p === y1p) continue;
          const lo = Math.min(y0p, y1p);
          const hi = Math.max(y0p, y1p);
          if (yc < lo || yc >= hi) continue;
          const t = (yc - y0p) / (y1p - y0p);
          const x = x0 + t * (x1 - x0);
          crossings.push([x, y1p > y0p ? 1 : -1]);
        }
      }
      if (crossings.length === 0) continue;
      crossings.sort((a, b) => a[0] - b[0]);
      let winding = 0;
      let spanStart = -1;
      for (const [x, dir] of crossings) {
        if (winding === 0) spanStart = x;
        winding += dir;
        if (winding === 0 && spanStart >= 0) {
          const xa = Math.max(0, Math.ceil(spanStart - 0.5));
          const xb = Math.min(this.w * SS - 1, Math.floor(x - 0.5));
          for (let xx = xa; xx <= xb; xx++) {
            const idx = this.idx(xx, y);
            this.buf[idx] = c[0];
            this.buf[idx + 1] = c[1];
            this.buf[idx + 2] = c[2];
          }
          spanStart = -1;
        }
      }
    }
  }

  // Thick line in page coords (drawn as a polygon).
  line(x0: number, y0: number, x1: number, y1: number, w: number, c: RGB): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len === 0) return;
    const nx = (-dy / len) * (w / 2);
    const ny = (dx / len) * (w / 2);
    this.fillPoly(
      [
        [x0 + nx, y0 + ny],
        [x1 + nx, y1 + ny],
        [x1 - nx, y1 - ny],
        [x0 - nx, y0 - ny],
      ],
      c,
    );
  }

  // Dashed line in page coords.
  dashedLine(x0: number, y0: number, x1: number, y1: number, w: number, c: RGB, dash = 5, gap = 4): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len === 0) return;
    const ux = dx / len;
    const uy = dy / len;
    let d = 0;
    while (d < len) {
      const e = Math.min(d + dash, len);
      this.line(x0 + ux * d, y0 + uy * d, x0 + ux * e, y0 + uy * e, w, c);
      d = e + gap;
    }
  }

  // Polyline (connected thick segments) in page coords.
  polyline(pts: Array<[number, number]>, w: number, c: RGB): void {
    for (let i = 0; i + 1 < pts.length; i++) {
      this.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], w, c);
    }
  }

  circle(cx: number, cy: number, r: number, c: RGB, segments = 40): void {
    const pts: Array<[number, number]> = [];
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    this.fillPoly(pts, c);
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, c: RGB, segments = 40): void {
    const pts: Array<[number, number]> = [];
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
    this.fillPoly(pts, c);
  }

  // Ring outline (stroke circle) approximated with segments.
  ring(cx: number, cy: number, r: number, w: number, c: RGB, segments = 48): void {
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    this.polyline(pts, w, c);
  }

  // Rounded rect: fill body + corner circles. Radius in page units.
  roundRect(x: number, y: number, w: number, h: number, r: number, c: RGB): void {
    const rr = Math.min(r, w / 2, h / 2);
    this.fillRect(x + rr, y, w - 2 * rr, h, c);
    this.fillRect(x, y + rr, w, h - 2 * rr, c);
    this.circle(x + rr, y + rr, rr, c);
    this.circle(x + w - rr, y + rr, rr, c);
    this.circle(x + rr, y + h - rr, rr, c);
    this.circle(x + w - rr, y + h - rr, rr, c);
  }

  // Starburst (explosion) centered at cx,cy with outer radius r.
  starburst(cx: number, cy: number, r: number, c: RGB, spikes = 12, innerRatio = 0.45): void {
    const pts: Array<[number, number]> = [];
    for (let i = 0; i < spikes * 2; i++) {
      const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
      const rad = i % 2 === 0 ? r : r * innerRatio;
      pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
    }
    this.fillPoly(pts, c);
  }

  // ---- text ------------------------------------------------------------

  measure(face: string, size: number, text: string, tracking = 0): number {
    const f = FACES[face];
    if (!f) throw new Error(`unknown face ${face}`);
    const scale = size / f.upm;
    let w = 0;
    let prev = -1;
    for (const ch of text) {
      const cp = ch.codePointAt(0)!;
      const g = f.glyphs[String(cp)];
      if (!g) continue;
      if (prev >= 0) {
        const k = f.kern[prev + "|" + cp];
        if (k) w += k * scale;
      }
      w += g[0] * scale + tracking;
      prev = cp;
    }
    return w - (text.length > 0 ? tracking : 0);
  }

  // Draw text with the baseline at (x, y). align: left|center|right.
  text(
    face: string,
    size: number,
    x: number,
    y: number,
    str: string,
    c: RGB,
    opts: { align?: "left" | "center" | "right"; tracking?: number } = {},
  ): void {
    const f = FACES[face];
    if (!f) throw new Error(`unknown face ${face}`);
    const tracking = opts.tracking ?? 0;
    let startX = x;
    if (opts.align === "center") startX = x - this.measure(face, size, str, tracking) / 2;
    if (opts.align === "right") startX = x - this.measure(face, size, str, tracking);
    const scale = size / f.upm;
    let penX = startX;
    let prev = -1;
    for (const ch of str) {
      const cp = ch.codePointAt(0)!;
      const g = f.glyphs[String(cp)];
      if (!g) {
        // missing glyph: advance by a space
        const sp = f.glyphs["32"];
        penX += (sp ? sp[0] : 500) * scale + tracking;
        prev = -1;
        continue;
      }
      if (prev >= 0) {
        const k = f.kern[prev + "|" + cp];
        if (k) penX += k * scale;
      }
      this.drawGlyph(f, g, penX, y, scale, c);
      penX += g[0] * scale + tracking;
      prev = cp;
    }
  }

  private drawGlyph(
    f: { upm: number },
    g: [number, number[][]],
    penX: number,
    baselineY: number,
    scale: number,
    c: RGB,
  ): void {
    void f;
    const polys: Array<Array<[number, number]>> = [];
    for (const contour of g[1]) {
      const pts = flattenContour(contour, penX, baselineY, scale);
      if (pts.length >= 3) polys.push(pts);
    }
    if (polys.length > 0) this.fillPolysSS(polys, c);
  }

  // Downsample SS buffer to page resolution and return RGB bytes.
  toRGB(): Uint8Array {
    const out = new Uint8Array(this.w * this.h * 3);
    const W = this.w * SS;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        let r = 0;
        let g = 0;
        let b = 0;
        for (let sy = 0; sy < SS; sy++) {
          for (let sx = 0; sx < SS; sx++) {
            const i = ((y * SS + sy) * W + (x * SS + sx)) * 3;
            r += this.buf[i];
            g += this.buf[i + 1];
            b += this.buf[i + 2];
          }
        }
        const n = SS * SS;
        const o = (y * this.w + x) * 3;
        out[o] = Math.round(r / n);
        out[o + 1] = Math.round(g / n);
        out[o + 2] = Math.round(b / n);
      }
    }
    return out;
  }
}

// Flatten one TrueType contour (flat [x,y,onCurve,...] in font units) into
// SS-pixel polygon points, translating by (penX, baselineY) in page coords.
function flattenContour(
  contour: number[],
  penX: number,
  baselineY: number,
  scale: number,
): Array<[number, number]> {
  const n = contour.length / 3;
  if (n < 2) return [];
  const px = (i: number): number => (penX + contour[i * 3] * scale) * SS;
  const py = (i: number): number => (baselineY - contour[i * 3 + 1] * scale) * SS;
  const on = (i: number): boolean => contour[i * 3 + 2] === 1;

  // Find a starting on-curve point (or implied midpoint).
  let start = 0;
  while (start < n && !on(start)) start++;
  const pts: Array<[number, number]> = [];
  if (start === n) {
    // all off-curve: implied on-curve midpoints between consecutive points
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      pts.push([(px(i) + px(j)) / 2, (py(i) + py(j)) / 2]);
    }
    // treat as a closed quadratic spline through midpoints
    return quadSplineClosed(pts, contour, px, py, n);
  }
  pts.push([px(start), py(start)]);
  let i = (start + 1) % n;
  while (i !== start) {
    if (on(i)) {
      pts.push([px(i), py(i)]);
      i = (i + 1) % n;
    } else {
      // off-curve control point; next point is on-curve or implied midpoint
      const j = (i + 1) % n;
      let ex: number;
      let ey: number;
      if (on(j)) {
        ex = px(j);
        ey = py(j);
      } else {
        ex = (px(i) + px(j)) / 2;
        ey = (py(i) + py(j)) / 2;
      }
      const cx = px(i);
      const cy = py(i);
      const [sx, sy] = pts[pts.length - 1];
      const segs = Math.max(2, Math.ceil(Math.hypot(ex - sx, ey - sy) / 3));
      for (let s = 1; s <= segs; s++) {
        const t = s / segs;
        const mt = 1 - t;
        pts.push([
          mt * mt * sx + 2 * mt * t * cx + t * t * ex,
          mt * mt * sy + 2 * mt * t * cy + t * t * ey,
        ]);
      }
      // If the segment ends at the start point, the contour is closed.
      if (on(j) && j === start) break;
      i = on(j) ? (j + 1) % n : j;
    }
  }
  return pts;
}

// Closed contour made only of off-curve points: quadratic spline through
// the implied midpoints. (Rare; kept for correctness.)
function quadSplineClosed(
  mids: Array<[number, number]>,
  contour: number[],
  px: (i: number) => number,
  py: (i: number) => number,
  n: number,
): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  pts.push(mids[0]);
  for (let i = 0; i < n; i++) {
    const [sx, sy] = pts[pts.length - 1];
    const cx = px(i);
    const cy = py(i);
    const [ex, ey] = mids[(i + 1) % n];
    const segs = Math.max(2, Math.ceil(Math.hypot(ex - sx, ey - sy) / 3));
    for (let s = 1; s <= segs; s++) {
      const t = s / segs;
      const mt = 1 - t;
      pts.push([
        mt * mt * sx + 2 * mt * t * cx + t * t * ex,
        mt * mt * sy + 2 * mt * t * cy + t * t * ey,
      ]);
    }
  }
  void contour;
  return pts;
}

// ---- text layout helpers ------------------------------------------------

// Greedy word wrap; returns lines that fit maxWidth (no truncation).
export function wrapText(
  cv: Canvas,
  face: string,
  size: number,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur === "" ? w : cur + " " + w;
    if (cv.measure(face, size, trial) <= maxWidth) {
      cur = trial;
    } else {
      if (cur !== "") lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

// Shrink font size until text fits maxWidth (never below minSize).
export function fitSize(
  cv: Canvas,
  face: string,
  size: number,
  text: string,
  maxWidth: number,
  minSize = 8,
): number {
  let s = size;
  while (s > minSize && cv.measure(face, s, text) > maxWidth) s -= 0.5;
  return s;
}

// ---- PNG encoding --------------------------------------------------------

const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 0);
  crc.copy(out, 8 + data.length);
  return out;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

// Encode RGB bytes (w*h*3) as a PNG. Per-row filter chosen by min cost.
export function encodePNG(w: number, h: number, rgb: Uint8Array): Buffer {
  const stride = w * 3;
  const raw = Buffer.alloc(h * (stride + 1));
  const prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const row = Buffer.from(rgb.buffer, rgb.byteOffset + y * stride, stride);
    let best: Buffer | null = null;
    let bestFilter = 0;
    let bestCost = Infinity;
    for (let f = 0; f < 5; f++) {
      const out = Buffer.alloc(stride);
      for (let i = 0; i < stride; i++) {
        const v = row[i];
        const a = i >= 3 ? row[i - 3] : 0;
        const b = prev[i];
        const c = i >= 3 ? prev[i - 3] : 0;
        let pred = 0;
        if (f === 1) pred = a;
        else if (f === 2) pred = b;
        else if (f === 3) pred = Math.floor((a + b) / 2);
        else if (f === 4) pred = paeth(a, b, c);
        out[i] = (v - pred) & 0xff;
      }
      let cost = 0;
      for (let i = 0; i < stride; i++) {
        const s = out[i] < 128 ? out[i] : out[i] - 256;
        cost += Math.abs(s);
      }
      if (cost < bestCost) {
        bestCost = cost;
        best = out;
        bestFilter = f;
      }
    }
    raw[y * (stride + 1)] = bestFilter;
    best!.copy(raw, y * (stride + 1) + 1);
    row.copy(prev);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return png;
}

export function rgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export { clamp255 };
