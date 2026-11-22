// main.ts — news-image-20261121 round 2 entry generator.
// Draws one 1024x1024 newspaper front page for Saturday 21 November 2026
// with real embedded serif outlines (Liberation Serif / Noto Serif Display).
// Node stdlib only. No network, no timestamps, no randomness: deterministic.
// Writes $MAKEFUN_OUTPUT_DIR/entry.png (default /output).
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { Canvas, encodePNG, rgb, wrapText, fitSize, type RGB } from "./render.ts";

// ---------- palette ----------
const PAPER = rgb("#f7f2e7");
const PAPER2 = rgb("#efe8d6");
const INK = rgb("#1a1a1a");
const MUTED = rgb("#55504a");
const RED = rgb("#b91c1c");
const RED_DK = rgb("#8f1414");
const NAVY = rgb("#1e3a5f");
const GREEN_OK = rgb("#15803d");
const BLUE_OFF = rgb("#1d4ed8");
const LINE = rgb("#c9bfa8");
const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [20, 20, 20];

// ---------- regions ----------
interface Region { name: string; count: number; color: RGB }
const REGIONS: Region[] = [
  { name: "Europe", count: 7, color: rgb("#2563eb") },
  { name: "Middle East", count: 5, color: rgb("#c2410c") },
  { name: "Africa", count: 4, color: rgb("#16a34a") },
  { name: "South Asia", count: 4, color: rgb("#7c3aed") },
  { name: "East Asia", count: 4, color: rgb("#0891b2") },
  { name: "SE Asia", count: 3, color: rgb("#059669") },
  { name: "Americas", count: 4, color: rgb("#dc2626") },
  { name: "Oceania", count: 2, color: rgb("#0d9488") },
  { name: "Global", count: 2, color: rgb("#64748b") },
];
const REGION_COLOR: Record<string, RGB> = {};
for (const r of REGIONS) REGION_COLOR[r.name] = r.color;

// ---------- content ----------
// All 35 stories verified as Saturday 21 November 2026 news (see build notes).
interface Hero { n: number; region: string; kicker: string; badge: string; badgeColor: RGB; headline: string; summary: string; source: string }
const HEROES: Hero[] = [
  {
    n: 1, region: "Middle East", kicker: "BAHRAIN · HORMUZ · IRAN WAR", badge: "CONFIRMED", badgeColor: GREEN_OK,
    headline: "Iran strikes Bahrain bases; tankers hit off Oman",
    summary: "IRGC says it hit US radar at two bases; Bahrain says a civilian plant burned. UKMTO: two tankers struck off Khasab.",
    source: "Al Jazeera · Anadolu · Reuters · UKMTO",
  },
  {
    n: 2, region: "Americas", kicker: "JUNÍN, PERU · EARTHQUAKE", badge: "CONFIRMED", badgeColor: GREEN_OK,
    headline: "Deep 6.7 earthquake shakes central Peru",
    summary: "Centred near Ondores and felt in Lima; landslides and minor damage, no deaths and no tsunami threat.",
    source: "USGS · IGP · AFP · Anadolu",
  },
  {
    n: 3, region: "Global", kicker: "ANTALYA, TÜRKIYE · CLIMATE", badge: "CONFIRMED", badgeColor: GREEN_OK,
    headline: "COP31 climate talks run into overtime",
    summary: "Talks in Antalya ran through Saturday over fossil fuels and finance; approval session set for Sunday 06:00 GMT.",
    source: "Reuters · AFP · Anadolu",
  },
];

interface Medium { n: number; region: string; kicker: string; badge: string; badgeColor: RGB; headline: string; summary: string }
const MEDIUMS: Medium[] = [
  { n: 4, region: "Europe", kicker: "KYIV · WAR", badge: "CONFIRMED", badgeColor: GREEN_OK, headline: "Russian missiles hit Zelenskyy's hometown", summary: "Double-tap strike on Kryvyi Rih; 2 killed, 60 hurt, six of them children." },
  { n: 5, region: "Americas", kicker: "SINALOA, MEXICO · CRIME", badge: "CONFIRMED", badgeColor: GREEN_OK, headline: "Mexico captures cartel boss 'El Chapo Isidro'", summary: "FBI most-wanted, seized in Guasave; 4 soldiers, 7 gunmen die in the raid." },
  { n: 6, region: "SE Asia", kicker: "INDONESIA–EU · TRADE", badge: "OFFICIAL", badgeColor: BLUE_OFF, headline: "Indonesia and EU sign trade pact", summary: "Signed in Brussels after ten years of talks; in force from 2027." },
  { n: 7, region: "Middle East", kicker: "BASRA, IRAQ · DISASTER", badge: "CONFIRMED", badgeColor: GREEN_OK, headline: "Basra power-station fire kills 4", summary: "800 MW Hartha plant shut; 35 injured. A gas pipeline is blamed." },
  { n: 8, region: "East Asia", kicker: "TAIPEI · MARKETS", badge: "OFFICIAL", badgeColor: BLUE_OFF, headline: "Taiwan curbs short-selling after rout", summary: "FSC acts after the worst week since 1990; TAIEX down 17.5%." },
  { n: 9, region: "Africa", kicker: "ABUJA · FOOTBALL", badge: "OFFICIAL", badgeColor: BLUE_OFF, headline: "All 54 CAF members back Infantino", summary: "FIFA vote set for March 2027 in Rabat; grants rise to $25m." },
  { n: 10, region: "Europe", kicker: "LONDON · RUGBY", badge: "OFFICIAL", badgeColor: BLUE_OFF, headline: "England beat All Blacks 37–12", summary: "Record margin over New Zealand at Twickenham; five tries." },
  { n: 11, region: "Americas", kicker: "LAS VEGAS · FORMULA 1", badge: "OFFICIAL", badgeColor: BLUE_OFF, headline: "Verstappen takes pole in Las Vegas", summary: "Antonelli fastest but docked 5 places; Russell 2nd on the grid." },
  { n: 12, region: "South Asia", kicker: "MASTUNG, PAKISTAN · SECURITY", badge: "OFFICIAL", badgeColor: BLUE_OFF, headline: "Pakistan says 15 militants killed", summary: "Balochistan raids; hideouts destroyed and arms seized." },
  { n: 13, region: "Europe", kicker: "GULF OF FINLAND · SECURITY", badge: "CONFIRMED", badgeColor: GREEN_OK, headline: "Drones hit Russian ship off Finland", summary: "Sparta II ablaze, crew evacuated; Finland suspects Ukraine." },
];

interface OneLiner { n: number; region: string; text: string }
const ONELINERS: OneLiner[] = [
  { n: 14, region: "Middle East", text: "Gaza: strike on food-aid van kills three (Reuters)" },
  { n: 15, region: "Middle East", text: "Hormuz: IRGC says it downed a US MQ-9 drone (IRIB)" },
  { n: 16, region: "Middle East", text: "Bahrain seeks UN action over Iran strikes (Govt)" },
  { n: 17, region: "Europe", text: "Zelenskyy: Crimea Bridge 'will not stay' (Kyiv Indep.)" },
  { n: 18, region: "Europe", text: "EU approves €1bn military support for Ukraine (Kyiv I.)" },
  { n: 19, region: "Europe", text: "NATO chief Rutte visits Poland after missiles land (ISW)" },
  { n: 20, region: "Europe", text: "Dublin: Ireland beat South Africa 20–17 (Reuters)" },
  { n: 21, region: "Africa", text: "Blue Nile: Sudan army says it is restoring security (AA)" },
  { n: 22, region: "Africa", text: "Nigeria: bandits kill five in Niger State raid (Police)" },
  { n: 23, region: "Africa", text: "Abuja: CAF adopts Kiswahili as fifth language (CAF)" },
  { n: 24, region: "South Asia", text: "Dhaka: two more die with measles symptoms (TBS)" },
  { n: 25, region: "South Asia", text: "Congress vows more protests against Meta (Reuters)" },
  { n: 26, region: "South Asia", text: "Pakistan drop Rizwan, Masood from contracts (AFP)" },
  { n: 27, region: "East Asia", text: "Japan: snow cuts off 1,000 in Fukushima village (Kyodo)" },
  { n: 28, region: "East Asia", text: "Kim tours factories after no Trump meeting (AFP)" },
  { n: 29, region: "East Asia", text: "Taipei mayor urges cabinet not to block payout (CNA)" },
  { n: 30, region: "SE Asia", text: "Bangkok: six-point plan on arsenic in two rivers (Nation)" },
  { n: 31, region: "SE Asia", text: "Bali: Russian Interpol fugitive refused entry (Antara)" },
  { n: 32, region: "Americas", text: "FBI crime database hacked for a second time (FBI)" },
  { n: 33, region: "Oceania", text: "Cricket Australia backs Cummins as captain (AFP)" },
  { n: 34, region: "Oceania", text: "Australia beat England by 3 wickets in a T20 (Reuters)" },
  { n: 35, region: "Global", text: "Bitcoin falls below $59,000 on Saturday (CoinGecko)" },
];

const STATS: Array<[string, string]> = [
  ["6.7", "Peru quake magnitude (USGS)"],
  ["2", "tankers hit off Khasab (UKMTO)"],
  ["128", "nations in Geneva robot-arms talks"],
  ["90.4%", "tariff lines duty-free (IEU-CEPA)"],
  ["82,500", "marchers in France (ministry)"],
  ["37–12", "England over New Zealand"],
];

const TIMELINE: Array<[string, string]> = [
  ["00:09", "Peru quake M6.7, Junín (USGS)"],
  ["01:00", "'El Chapo Isidro' captured"],
  ["03:45", "Geneva robot talks end"],
  ["04:00", "Las Vegas qualifying: Verstappen P1"],
  ["05:00", "Tanker hit 11 nm N of Khasab"],
  ["15:30", "Antara reports EU pact signed"],
  ["17:30", "Newcastle v Arsenal 2–2"],
];

// Map pins: [story number, lat, lon, dx, dy] (dx/dy nudge crowded pins apart)
const PINS: Array<[number, number, number, number, number]> = [
  [1, 26.2, 50.6, 0, 0], [2, -11.2, -76.0, 0, 0], [3, 36.9, 30.7, 6, -4],
  [4, 47.9, 33.4, 4, 6], [5, 25.6, -108.5, 0, 0], [6, 50.85, 4.35, -2, -6],
  [7, 30.5, 47.8, 0, 6], [8, 25.0, 121.6, 0, -6], [9, 9.1, 7.5, -6, 2],
  [10, 51.5, -0.1, 0, 0], [11, 36.2, -115.1, 0, 0], [12, 29.8, 66.8, 0, 0],
  [13, 60.0, 27.0, 0, 0], [14, 31.5, 34.5, -8, 4], [15, 26.6, 56.3, 6, 2],
  [16, 26.2, 50.6, 10, -8], [17, 50.45, 30.5, -6, -4], [18, 50.85, 4.35, 8, 6],
  [19, 52.2, 21.0, 0, 0], [20, 53.35, -6.26, -8, 0], [21, 11.0, 34.0, 0, 0],
  [22, 10.0, 6.0, 6, -4], [23, 9.1, 7.5, 6, 8], [24, 23.8, 90.4, 0, 0],
  [25, 28.6, 77.2, 0, 0], [26, 31.5, 74.3, -8, -4], [27, 37.75, 140.47, 0, 0],
  [28, 39.0, 125.75, 0, 0], [29, 25.0, 121.6, 8, 6], [30, 13.75, 100.5, 0, 0],
  [31, -8.65, 115.2, 0, 0], [32, 38.9, -77.0, 0, 0], [33, -37.8, 145.0, -6, 0],
  [34, -37.8, 145.0, 6, 0], [35, 40.7, -74.0, 6, -6],
];
const STORY_REGION: Record<number, string> = {};
for (const h of HEROES) STORY_REGION[h.n] = h.region;
for (const m of MEDIUMS) STORY_REGION[m.n] = m.region;
for (const o of ONELINERS) STORY_REGION[o.n] = o.region;

// ---------- helpers ----------
function badge(cv: Canvas, x: number, y: number, label: string, color: RGB): void {
  // small filled badge, text vertically centred at y (top edge)
  const w = cv.measure("sansBold", 8, label) + 8;
  cv.fillRect(x, y, w, 11, color);
  cv.text("sansBold", 8, x + 4, y + 8.5, label, WHITE);
}

function kickerLine(cv: Canvas, x: number, y: number, w: number, n: number, kicker: string, badgeText: string, badgeColor: RGB): void {
  // number chip
  cv.circle(x + 7, y + 5, 7, RED);
  cv.text("sansBold", 9, x + 7, y + 8.5, String(n), WHITE, { align: "center" });
  const kw = cv.measure("sansBold", 9.5, kicker);
  const maxK = w - 18 - (cv.measure("sansBold", 8, badgeText) + 12);
  const ks = kw > maxK ? fitSize(cv, "sansBold", 9.5, kicker, maxK, 7.5) : 9.5;
  cv.text("sansBold", ks, x + 17, y + 8.5, kicker, RED);
  const bw = cv.measure("sansBold", 8, badgeText) + 8;
  badge(cv, x + w - bw, y, badgeText, badgeColor);
}

// ---------- illustrations ----------
function heroBanner(cv: Canvas, x: number, y: number, title: string, tag: string, source: string, w: number, h: number): void {
  cv.fillRect(x, y, cv.measure("sansBold", 13, title) + 14, 20, RED);
  cv.text("sansBold", 13, x + 7, y + 15, title, WHITE);
  cv.fillRect(x, y + 23, cv.measure("sansBold", 10.5, tag) + 12, 16, WHITE);
  cv.text("sansBold", 10.5, x + 6, y + 35, tag, BLACK);
  cv.fillRect(x, y + h - 13, w, 13, BLACK);
  cv.text("sansBold", 8, x + 5, y + h - 4, source, WHITE);
}

function drawHero1(cv: Canvas, x: number, y: number, w: number, h: number): void {
  // Gulf map: land + sea + strikes
  cv.fillRect(x, y, w, h, rgb("#e6d9b8"));
  // sea (Persian Gulf): diagonal band
  cv.fillPoly([[x, y + 8], [x + w * 0.42, y + 8], [x + w * 0.72, y + h], [x + w * 0.30, y + h]], rgb("#7fa8c9"));
  cv.fillPoly([[x + w * 0.42, y + 8], [x + w * 0.55, y + 8], [x + w * 0.86, y + h], [x + w * 0.72, y + h]], rgb("#6b97bd"));
  // Iran (top right landmass)
  cv.fillPoly([[x + w * 0.55, y], [x + w, y], [x + w, y + h * 0.42], [x + w * 0.78, y + h * 0.30], [x + w * 0.62, y + h * 0.22]], rgb("#dccda4"));
  // Qatar peninsula
  cv.fillPoly([[x + w * 0.52, y + h * 0.55], [x + w * 0.58, y + h * 0.52], [x + w * 0.60, y + h * 0.72], [x + w * 0.55, y + h * 0.78]], rgb("#dccda4"));
  // Bahrain island
  cv.ellipse(x + w * 0.47, y + h * 0.60, 7, 5, rgb("#c9b489"));
  cv.ring(x + w * 0.47, y + h * 0.60, 9, 1.5, RED);
  cv.text("sansBold", 9, x + w * 0.47, y + h * 0.60 + 22, "BAHRAIN", RED_DK, { align: "center" });
  // labels
  cv.text("sansBold", 10, x + w * 0.78, y + 16, "IRAN", rgb("#6b5d3f"));
  cv.text("sansBold", 9, x + w * 0.88, y + h - 30, "HORMUZ", rgb("#6b5d3f"), { align: "center" });
  cv.text("sansBold", 8, x + w * 0.16, y + h - 22, "SAUDI ARABIA", rgb("#6b5d3f"));
  // missile arcs from Iran to Bahrain
  cv.dashedLine(x + w * 0.72, y + h * 0.18, x + w * 0.52, y + h * 0.50, 1.5, RED_DK, 4, 3);
  cv.dashedLine(x + w * 0.80, y + h * 0.34, x + w * 0.55, y + h * 0.62, 1.5, RED_DK, 4, 3);
  // explosions: 2 bases on Bahrain, 2 tankers in the gulf
  cv.starburst(x + w * 0.44, y + h * 0.55, 8, rgb("#f97316"));
  cv.starburst(x + w * 0.44, y + h * 0.55, 4, rgb("#fde68a"));
  cv.starburst(x + w * 0.50, y + h * 0.66, 7, rgb("#f97316"));
  cv.starburst(x + w * 0.50, y + h * 0.66, 3.5, rgb("#fde68a"));
  // tankers
  cv.fillRect(x + w * 0.62, y + h * 0.78, 22, 6, rgb("#334155"));
  cv.fillRect(x + w * 0.62 + 6, y + h * 0.78 - 5, 6, 5, rgb("#334155"));
  cv.starburst(x + w * 0.62 + 11, y + h * 0.78 - 4, 7, rgb("#f97316"));
  cv.fillRect(x + w * 0.74, y + h * 0.60, 20, 5, rgb("#334155"));
  cv.fillRect(x + w * 0.74 + 5, y + h * 0.60 - 4, 5, 4, rgb("#334155"));
  cv.starburst(x + w * 0.74 + 10, y + h * 0.60 - 3, 6, rgb("#f97316"));
  cv.text("sansBold", 8, x + w * 0.30, y + h * 0.52, "2 air bases hit", RED_DK);
  heroBanner(cv, x, y, "GULF: IRAN STRIKES", "2 air bases · 2 tankers hit", "Al Jazeera · Anadolu · Reuters · UKMTO", w, h);
}

function drawHero2(cv: Canvas, x: number, y: number, w: number, h: number): void {
  // Quake cross-section diagram
  cv.fillRect(x, y, w, h, rgb("#efe6d0"));
  const surfY = y + 30;
  // sky
  cv.fillRect(x, y, w, 30, rgb("#dbe7f0"));
  // strata
  cv.fillRect(x, surfY, w, 22, rgb("#b08968"));
  cv.fillRect(x, surfY + 22, w, 24, rgb("#8c6a4a"));
  cv.fillRect(x, surfY + 46, w, h - 89, rgb("#6b4e33"));
  // surface: houses + shaking lines
  cv.fillRect(x + 14, surfY - 12, 16, 12, rgb("#f5f0e6"));
  cv.fillPoly([[x + 12, surfY - 12], [x + 22, surfY - 19], [x + 32, surfY - 12]], rgb("#b91c1c"));
  cv.fillRect(x + 40, surfY - 9, 12, 9, rgb("#f5f0e6"));
  cv.fillPoly([[x + 38, surfY - 9], [x + 46, surfY - 15], [x + 54, surfY - 9]], rgb("#1e3a5f"));
  cv.line(x + 22, surfY - 24, x + 18, surfY - 30, 1.5, RED);
  cv.line(x + 22, surfY - 24, x + 26, surfY - 30, 1.5, RED);
  cv.text("sansBold", 8, x + 14, surfY - 32, "LIMA", rgb("#1e3a5f"));
  cv.text("sansBold", 8, x + w - 52, surfY - 6, "ONDORES", rgb("#1e3a5f"));
  // fault line
  cv.polyline([[x + w * 0.62, surfY], [x + w * 0.58, surfY + 22], [x + w * 0.55, surfY + 44]], 2, rgb("#3d2b1a"));
  // hypocentre star + rings (kept inside the illustration box)
  const hx = x + w * 0.55;
  const hy = surfY + 44;
  cv.ring(hx, hy, 18, 1.5, rgb("#fca5a5"));
  cv.ring(hx, hy, 12, 1.5, rgb("#f87171"));
  cv.starburst(hx, hy, 9, RED);
  cv.starburst(hx, hy, 4, rgb("#fde68a"));
  // depth bracket
  const bx = x + w - 26;
  cv.line(bx, surfY, bx, hy, 1.5, INK);
  cv.line(bx - 4, surfY, bx + 4, surfY, 1.5, INK);
  cv.line(bx - 4, hy, bx + 4, hy, 1.5, INK);
  cv.fillRect(x + w - 78, hy - 22, 74, 15, WHITE);
  cv.text("sansBold", 9.5, x + w - 74, hy - 11, "108–129 km", RED_DK);
  // seismograph squiggle top right
  cv.polyline(
    [[x + w * 0.66, y + 14], [x + w * 0.70, y + 20], [x + w * 0.74, y + 6], [x + w * 0.78, y + 22], [x + w * 0.82, y + 10], [x + w * 0.86, y + 16], [x + w * 0.92, y + 12]],
    1.5, RED,
  );
  cv.text("sansBold", 8, x + w * 0.62, y + 26, "M6.7", RED_DK);
  heroBanner(cv, x, y, "PERU: QUAKE 6.7", "00:09 UTC · deep · no deaths", "USGS · IGP · AFP · Anadolu", w, h);
}

function drawHero3(cv: Canvas, x: number, y: number, w: number, h: number): void {
  // COP31 calendar grid
  cv.fillRect(x, y, w, h, rgb("#e4f0e2"));
  // calendar grid: Nov 9-21, 7 per row
  const gx = x + 12;
  const gy = y + 46;
  const cw = 24;
  const ch = 17;
  cv.text("sansBold", 8.5, gx, gy - 6, "NOV 9–20 SCHEDULED", rgb("#166534"));
  for (let d = 9; d <= 21; d++) {
    const i = d - 9;
    const cx = gx + (i % 7) * (cw + 3);
    const cy = gy + Math.floor(i / 7) * (ch + 3);
    const is21 = d === 21;
    cv.fillRect(cx, cy, cw, ch, is21 ? RED : WHITE);
    cv.strokeRect(cx, cy, cw, ch, is21 ? RED : rgb("#9db89a"), 1);
    cv.text("sansBold", 10, cx + cw / 2, cy + 12.5, String(d), is21 ? WHITE : INK, { align: "center" });
  }
  // (the red day-21 cell and +1 DAY badge already say "overtime")
  // thermometer
  const tx = x + w - 62;
  const ty = y + 44;
  cv.fillRect(tx + 4, ty, 8, 36, WHITE);
  cv.strokeRect(tx + 4, ty, 8, 36, rgb("#9db89a"), 1);
  cv.fillRect(tx + 5, ty + 22, 6, 13, RED);
  cv.circle(tx + 8, ty + 38, 7, RED);
  cv.circle(tx + 8, ty + 38, 4, rgb("#fca5a5"));
  cv.text("sansBold", 11, tx + 20, ty + 12, "1.5°C", RED_DK);
  cv.text("sansBold", 8, tx + 20, ty + 24, "limit", MUTED);
  // +1 DAY badge
  cv.fillRect(x + w - 118, y + h - 36, 50, 18, RED);
  cv.text("sansBold", 11, x + w - 93, y + h - 23, "+1 DAY", WHITE, { align: "center" });
  heroBanner(cv, x, y, "COP31: OVERTIME", "Day 13 of a 12-day summit", "Reuters · AFP · Anadolu", w, h);
}

// Medium illustrations: each draws a scene in (x,y,w,h) with a stat tag.
function medTag(cv: Canvas, x: number, y: number, big: string, small: string, color: RGB): void {
  cv.text("sansBold", 20, x, y + 20, big, color);
  cv.text("sansBold", 8.5, x, y + 32, small, color);
}

function drawMed(cv: Canvas, n: number, x: number, y: number, w: number, h: number): void {
  const cx = x + w / 2;
  switch (n) {
    case 4: { // Kryvyi Rih night strike
      cv.fillRect(x, y, w, h, rgb("#101c33"));
      for (let i = 0; i < 14; i++) {
        const sx = x + 8 + ((i * 37) % (w - 16));
        const sy = y + 4 + ((i * 13) % 18);
        cv.fillRect(sx, sy, 1.5, 1.5, WHITE);
      }
      cv.fillRect(x + 8, y + h - 26, 34, 26, rgb("#1f3350"));
      cv.fillRect(x + 46, y + h - 34, 26, 34, rgb("#1f3350"));
      cv.fillRect(x + 76, y + h - 22, 40, 22, rgb("#1f3350"));
      for (let i = 0; i < 5; i++) cv.fillRect(x + 12 + i * 7, y + h - 22, 3, 4, rgb("#fbbf24"));
      cv.starburst(x + 59, y + h - 40, 12, rgb("#f97316"));
      cv.starburst(x + 59, y + h - 40, 5, rgb("#fde68a"));
      cv.dashedLine(x + 150, y + 6, x + 66, y + h - 42, 1.5, rgb("#fca5a5"), 4, 3);
      cv.fillRect(x + w - 66, y + 6, 60, 22, rgb("#b91c1c"));
      cv.text("sansBold", 11, x + w - 36, y + 21, "2 KILLED", WHITE, { align: "center" });
      break;
    }
    case 5: { // Sinaloa raid
      cv.fillRect(x, y, w, h, rgb("#14291d"));
      cv.fillPoly([[x, y + h], [x + w * 0.3, y + h * 0.45], [x + w * 0.6, y + h], [x, y + h]], rgb("#1e3d2a"));
      cv.fillPoly([[x + w * 0.45, y + h], [x + w * 0.75, y + h * 0.4], [x + w, y + h * 0.7], [x + w, y + h]], rgb("#1e3d2a"));
      // helicopter
      cv.fillRect(x + 26, y + 12, 34, 8, BLACK);
      cv.line(x + 20, y + 10, x + 66, y + 10, 2, BLACK);
      cv.fillRect(x + 56, y + 14, 14, 3, BLACK);
      cv.fillRect(x + 30, y + 20, 3, 6, BLACK);
      cv.fillRect(x + 52, y + 20, 3, 6, BLACK);
      cv.fillPoly([[x + 30, y + 26], [x + 56, y + 26], [x + 66, y + h - 6], [x + 20, y + h - 6]], rgb("#fef08a"));
      // roadblock fire
      cv.fillRect(x + 120, y + h - 14, 44, 6, rgb("#3b2f2f"));
      cv.starburst(x + 142, y + h - 18, 8, rgb("#f97316"));
      cv.starburst(x + 142, y + h - 18, 3.5, rgb("#fde68a"));
      cv.fillRect(x + w - 78, y + 6, 72, 22, rgb("#b91c1c"));
      cv.text("sansBold", 11, x + w - 42, y + 21, "11 KILLED", WHITE, { align: "center" });
      break;
    }
    case 6: { // EU-Indonesia flags + document
      cv.fillRect(x, y, w, h, rgb("#eef2f7"));
      // EU flag
      cv.fillRect(x + 10, y + 10, 52, 30, rgb("#003399"));
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
        cv.circle(x + 36 + Math.cos(a) * 10, y + 25 + Math.sin(a) * 10, 1.6, rgb("#ffcc00"));
      }
      // Indonesia flag
      cv.fillRect(x + w - 62, y + 10, 52, 30, WHITE);
      cv.fillRect(x + w - 62, y + 10, 52, 15, rgb("#ce1126"));
      cv.strokeRect(x + w - 62, y + 10, 52, 30, rgb("#cbd5e1"), 1);
      // document
      cv.fillRect(cx - 22, y + 8, 44, 32, WHITE);
      cv.strokeRect(cx - 22, y + 8, 44, 32, rgb("#94a3b8"), 1);
      cv.line(cx - 16, y + 14, cx + 16, y + 14, 1.5, rgb("#64748b"));
      cv.line(cx - 16, y + 20, cx + 16, y + 20, 1.5, rgb("#64748b"));
      cv.line(cx - 16, y + 26, cx + 2, y + 26, 1.5, rgb("#64748b"));
      cv.polyline([[cx - 12, y + 34], [cx - 4, y + 29], [cx + 12, y + 36]], 2, GREEN_OK);
      cv.fillRect(x + 10, y + h - 16, w - 20, 14, NAVY);
      cv.text("sansBold", 9.5, cx, y + h - 6, "90.4% DUTY-FREE", WHITE, { align: "center" });
      break;
    }
    case 7: { // Basra power station fire
      cv.fillRect(x, y, w, h, rgb("#fdf0d5"));
      // cooling towers
      cv.fillPoly([[x + 18, y + h - 8], [x + 24, y + 16], [x + 44, y + 16], [x + 50, y + h - 8]], rgb("#b8a88a"));
      cv.fillPoly([[x + 56, y + h - 8], [x + 61, y + 22], [x + 77, y + 22], [x + 82, y + h - 8]], rgb("#b8a88a"));
      cv.fillRect(x + 96, y + 30, 8, h - 38, rgb("#8a7a5f"));
      cv.fillRect(x + 110, y + 22, 8, h - 30, rgb("#8a7a5f"));
      // flames + smoke
      cv.starburst(x + 34, y + 16, 11, rgb("#f97316"));
      cv.starburst(x + 34, y + 16, 5, rgb("#fde68a"));
      cv.circle(x + 66, y + 14, 7, rgb("#78716c"));
      cv.circle(x + 76, y + 8, 9, rgb("#a8a29e"));
      cv.circle(x + 88, y + 12, 6, rgb("#78716c"));
      cv.fillRect(x + w - 60, y + 6, 54, 22, rgb("#b91c1c"));
      cv.text("sansBold", 11, x + w - 33, y + 21, "4 DEAD", WHITE, { align: "center" });
      cv.text("sansBold", 8.5, x + w - 60, y + h - 8, "800 MW plant", RED_DK);
      break;
    }
    case 8: { // Taiwan falling chart
      cv.fillRect(x, y, w, h, WHITE);
      cv.line(x + 8, y + 8, x + 8, y + h - 8, 1, rgb("#cbd5e1"));
      cv.line(x + 8, y + h - 8, x + w - 8, y + h - 8, 1, rgb("#cbd5e1"));
      cv.polyline([[x + 14, y + h * 0.16], [x + 50, y + h * 0.29], [x + 80, y + h * 0.26], [x + 110, y + h * 0.52], [x + 140, y + h * 0.61], [x + 168, y + h * 0.81]], 2.5, RED);
      cv.polyline([[x + 156, y + h * 0.68], [x + 168, y + h * 0.81], [x + 154, y + h * 0.84]], 2.5, RED);
      medTag(cv, x + 96, y + 4, "–17.5%", "TAIEX, WEEK", RED);
      cv.text("sansBold", 8, x + 10, y + h - 4, "FSC bans short sales", MUTED);
      break;
    }
    case 9: { // CAF football
      cv.fillRect(x, y, w, h, rgb("#dcfce7"));
      cv.fillRect(x + 8, y + 8, w - 16, h - 16, rgb("#22c55e"));
      cv.strokeRect(x + 8, y + 8, w - 16, h - 16, WHITE, 1.5);
      cv.line(cx, y + 8, cx, y + h - 8, 1.5, WHITE);
      cv.ring(cx, y + h / 2, 10, 1.5, WHITE);
      // ball
      cv.circle(x + 34, y + h - 20, 10, WHITE);
      cv.circle(x + 34, y + h - 20, 3.5, BLACK);
      cv.text("sansBold", 26, x + w - 92, y + 34, "54/54", NAVY);
      cv.text("sansBold", 9, x + w - 92, y + 48, "BACK INFANTINO", NAVY);
      break;
    }
    case 10: { // England rugby
      cv.fillRect(x, y, w, h, rgb("#14532d"));
      // posts
      cv.fillRect(cx - 16, y + 10, 3, 30, WHITE);
      cv.fillRect(cx + 13, y + 10, 3, 30, WHITE);
      cv.fillRect(cx - 16, y + 24, 32, 3, WHITE);
      // ball
      cv.ellipse(cx, y + h - 16, 14, 8, rgb("#92400e"));
      cv.line(cx - 8, y + h - 16, cx + 8, y + h - 16, 1.5, WHITE);
      cv.text("sansBold", 26, x + 10, y + 34, "37–12", WHITE);
      cv.text("sansBold", 9, x + 10, y + 48, "ENG v NZL", WHITE);
      cv.text("sansBold", 9, x + w - 46, y + h - 8, "RECORD", rgb("#fbbf24"));
      break;
    }
    case 11: { // Verstappen F1
      cv.fillRect(x, y, w, h, rgb("#0f172a"));
      // track
      cv.ellipse(cx, y + h - 16, 90, 12, rgb("#1e293b"));
      cv.ellipse(cx, y + h - 16, 70, 7, rgb("#0f172a"));
      // car
      cv.fillRect(x + 30, y + h - 30, 58, 8, rgb("#dc2626"));
      cv.fillRect(x + 44, y + h - 36, 18, 6, rgb("#dc2626"));
      cv.circle(x + 38, y + h - 20, 6, BLACK);
      cv.circle(x + 38, y + h - 20, 3, rgb("#94a3b8"));
      cv.circle(x + 78, y + h - 20, 6, BLACK);
      cv.circle(x + 78, y + h - 20, 3, rgb("#94a3b8"));
      // checkered flag
      for (let r = 0; r < 3; r++) for (let c2 = 0; c2 < 4; c2++) {
        if ((r + c2) % 2 === 0) cv.fillRect(x + w - 52 + c2 * 6, y + 8 + r * 6, 6, 6, WHITE);
        else cv.fillRect(x + w - 52 + c2 * 6, y + 8 + r * 6, 6, 6, BLACK);
      }
      cv.text("sansBold", 26, x + w - 52, y + 46, "P1", rgb("#fbbf24"));
      cv.text("sansBold", 9, x + 10, y + 16, "VERSTAPPEN", WHITE);
      break;
    }
    case 12: { // Pakistan raid
      cv.fillRect(x, y, w, h, rgb("#e7d8b8"));
      cv.fillPoly([[x, y + h], [x + 30, y + 18], [x + 60, y + h]], rgb("#a08b62"));
      cv.fillPoly([[x + 40, y + h], [x + 80, y + 8], [x + 120, y + h]], rgb("#8a744e"));
      cv.fillPoly([[x + 100, y + h], [x + 140, y + 22], [x + 180, y + h]], rgb("#a08b62"));
      cv.fillPoly([[x + 72, y + 14], [x + 80, y + 8], [x + 88, y + 14], [x + 84, y + 18], [x + 76, y + 18]], WHITE);
      // crosshair
      cv.ring(x + 150, y + 26, 13, 2, RED);
      cv.ring(x + 150, y + 26, 5, 1.5, RED);
      cv.line(x + 150 - 18, y + 26, x + 150 + 18, y + 26, 1.5, RED);
      cv.line(x + 150, y + 26 - 18, x + 150, y + 26 + 18, 1.5, RED);
      medTag(cv, x + 10, y + 4, "15", "MILITANTS KILLED", RED_DK);
      break;
    }
    case 13: { // Sparta II ship fire
      cv.fillRect(x, y, w, h, rgb("#dbeafe"));
      // sea
      cv.fillRect(x, y + h * 0.55, w, h * 0.45, rgb("#3b82f6"));
      cv.line(x + 10, y + h * 0.66, x + 60, y + h * 0.66, 1.5, WHITE);
      cv.line(x + 120, y + h * 0.78, x + 180, y + h * 0.78, 1.5, WHITE);
      // ship
      cv.fillPoly([[x + 30, y + h * 0.55], [x + 150, y + h * 0.55], [x + 140, y + h * 0.78], [x + 40, y + h * 0.78]], rgb("#1e293b"));
      cv.fillRect(x + 56, y + h * 0.55 - 14, 22, 14, rgb("#64748b"));
      cv.fillRect(x + 100, y + h * 0.55 - 10, 30, 10, rgb("#475569"));
      cv.starburst(x + 88, y + h * 0.55 - 6, 10, rgb("#f97316"));
      cv.starburst(x + 88, y + h * 0.55 - 6, 4, rgb("#fde68a"));
      cv.circle(x + 100, y + h * 0.55 - 22, 6, rgb("#78716c"));
      cv.circle(x + 110, y + h * 0.55 - 28, 8, rgb("#a8a29e"));
      // drone
      cv.fillRect(x + 150, y + 10, 16, 3, BLACK);
      cv.circle(x + 158, y + 11, 3, BLACK);
      cv.fillRect(x + w - 66, y + 6, 60, 22, rgb("#b91c1c"));
      cv.text("sansBold", 11, x + w - 36, y + 21, "2 DRONES", WHITE, { align: "center" });
      break;
    }
  }
}

// ---------- world map ----------
const CONTINENTS: Array<Array<[number, number]>> = [
  // North America
  [[-168, 65], [-140, 70], [-125, 71], [-110, 72], [-95, 70], [-85, 69], [-78, 71], [-68, 58], [-60, 52], [-64, 45], [-70, 42], [-76, 35], [-80, 31], [-81, 26], [-84, 30], [-90, 21], [-97, 16], [-93, 15], [-87, 13], [-83, 9], [-79, 9], [-84, 12], [-90, 14], [-96, 16], [-105, 22], [-110, 24], [-114, 30], [-120, 34], [-124, 42], [-124, 48], [-132, 56], [-150, 60], [-162, 58]],
  // South America
  [[-79, 9], [-72, 12], [-62, 10], [-52, 5], [-44, -3], [-35, -8], [-38, -15], [-40, -22], [-48, -28], [-52, -33], [-58, -38], [-62, -41], [-65, -45], [-68, -50], [-70, -54], [-72, -54], [-73, -45], [-73, -37], [-71, -30], [-70, -20], [-75, -15], [-79, -6], [-80, 1]],
  // Europe
  [[-10, 36], [-9, 43], [-2, 48], [-4, 50], [0, 53], [3, 58], [5, 60], [10, 58], [12, 54], [18, 56], [21, 55], [24, 58], [28, 60], [30, 62], [28, 66], [24, 71], [18, 69], [14, 67], [12, 64], [8, 62], [5, 60], [-2, 57], [-6, 53], [-10, 51], [-10, 43]],
  // UK
  [[-5, 50], [-3, 53], [-5, 57], [-3, 59], [-1, 57], [1, 53], [0, 51], [-3, 50]],
  // Africa
  [[-6, 35], [0, 36], [10, 37], [20, 32], [32, 31], [35, 28], [34, 22], [37, 18], [43, 12], [51, 11], [48, 4], [42, -2], [40, -10], [36, -18], [32, -26], [28, -33], [20, -35], [17, -29], [14, -22], [12, -14], [9, -1], [4, 6], [-8, 5], [-13, 8], [-17, 15], [-16, 20], [-10, 30]],
  // Asia
  [[28, 36], [36, 36], [42, 38], [44, 40], [48, 38], [50, 30], [54, 27], [57, 26], [60, 25], [66, 25], [68, 23], [72, 20], [76, 8], [80, 7], [80, 13], [85, 19], [88, 22], [92, 22], [94, 17], [97, 16], [100, 8], [103, 2], [104, 9], [106, 10], [109, 13], [109, 20], [107, 22], [110, 21], [114, 23], [120, 28], [122, 32], [120, 37], [122, 40], [126, 40], [130, 42], [132, 44], [135, 44], [138, 46], [141, 50], [142, 54], [140, 60], [135, 60], [130, 62], [125, 65], [120, 68], [115, 70], [110, 73], [105, 75], [100, 76], [95, 76], [90, 75], [85, 72], [80, 70], [75, 70], [70, 68], [65, 68], [60, 68], [55, 68], [50, 68], [45, 68], [40, 67], [35, 66], [30, 64], [28, 60], [30, 55], [32, 50], [35, 47], [38, 44], [40, 42], [42, 38], [38, 36], [35, 36], [30, 36]],
  // Japan
  [[130, 31], [132, 33], [135, 34], [137, 35], [139, 36], [141, 39], [141, 42], [143, 44], [145, 44], [143, 41], [140, 38], [138, 35], [135, 33], [132, 32]],
  // Indonesia
  [[95, 5], [100, 0], [105, -5], [110, -7], [115, -8], [120, -10], [125, -9], [130, -3], [131, 0], [128, 2], [122, 1], [118, 0], [112, 1], [106, 0], [100, 3]],
  // Australia
  [[114, -22], [113, -26], [115, -33], [118, -35], [124, -33], [129, -32], [132, -32], [135, -35], [138, -35], [140, -38], [145, -38], [150, -37], [153, -30], [153, -27], [150, -23], [146, -19], [142, -15], [142, -11], [140, -17], [136, -15], [132, -12], [130, -13], [126, -14], [122, -17], [118, -20]],
  // New Zealand
  [[167, -46], [170, -43], [173, -40], [175, -38], [178, -38], [176, -40], [174, -42], [171, -44], [168, -47]],
];

function drawWorldMap(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.fillRect(x, y, w, h, rgb("#d7e6f2"));
  cv.strokeRect(x, y, w, h, rgb("#9db8cc"), 1);
  const lon2x = (lon: number) => x + ((lon + 180) / 360) * w;
  const lat2y = (lat: number) => y + ((75 - lat) / 135) * h;
  for (const cont of CONTINENTS) {
    cv.fillPoly(cont.map(([lo, la]) => [lon2x(lo), lat2y(la)] as [number, number]), rgb("#e3d3a8"));
  }
  // pins
  for (const [n, lat, lon, dx, dy] of PINS) {
    const px = lon2x(lon) + dx;
    const py = lat2y(lat) + dy;
    const col = REGION_COLOR[STORY_REGION[n]] ?? INK;
    cv.circle(px, py, 6.5, WHITE);
    cv.circle(px, py, 5.5, col);
    cv.text("sansBold", 7, px, py + 2.5, String(n), WHITE, { align: "center" });
  }
}

// ---------- page ----------
function buildPage(): Canvas {
  const W = 1024;
  const H = 1024;
  const cv = new Canvas(W, H, PAPER);
  const M = 12; // side margin
  const CW = W - 2 * M; // content width 1000

  // ---- top bar ----
  cv.fillRect(0, 0, W, 20, BLACK);
  cv.text("sansBold", 10.5, M, 14.5, "THE WORLD IN ONE DAY", WHITE);
  cv.text("sansBold", 10.5, W - M, 14.5, "35 STORIES · 9 REGIONS · EVERY ONE DATED SATURDAY 21 NOVEMBER 2026", WHITE, { align: "right" });

  // ---- masthead ----
  const mast = "Saturday 21 November 2026";
  const mastSize = fitSize(cv, "display", 66, mast, CW, 40);
  cv.text("display", mastSize, W / 2, 86, mast, INK, { align: "center" });
  cv.fillRect(M, 94, CW, 2, INK);
  cv.fillRect(M, 98, CW, 1, INK);

  // ---- sub-headline ----
  cv.text("serifItalic", 18.5, W / 2, 119, "Iran hits Bahrain bases  ·  a deep quake shakes Peru  ·  COP31 runs into overtime", INK, { align: "center" });

  // ---- timeline strip ----
  const tlY = 126;
  cv.fillRect(M, tlY, 92, 30, BLACK);
  cv.text("sansBold", 10, M + 46, tlY + 13, "THE DAY", WHITE, { align: "center" });
  cv.text("sansBold", 10, M + 46, tlY + 25, "IN UTC", WHITE, { align: "center" });
  const tlX0 = M + 98;
  const tlW = CW - 98;
  const slotW = tlW / TIMELINE.length;
  cv.line(tlX0, tlY + 6, tlX0 + tlW, tlY + 6, 1, rgb("#94a3b8"));
  TIMELINE.forEach(([t, label], i) => {
    const sx = tlX0 + i * slotW;
    cv.circle(sx + 4, tlY + 6, 3, RED);
    cv.text("sansBold", 9.5, sx + 4, tlY + 18, t, RED_DK);
    const lines = wrapText(cv, "serif", 9.5, label, slotW - 6);
    lines.slice(0, 2).forEach((ln, li) => {
      cv.text("serif", 9.5, sx + 4, tlY + 28 + li * 0, ln, INK);
    });
    if (lines.length > 1) cv.text("serif", 9.5, sx + 4, tlY + 28, lines.slice(0, 2).join(" "), INK);
  });
  // NOTE: timeline labels drawn on one fitted line below (second pass fixes wrap)
  // (kept simple: redraw cleanly)
  cv.fillRect(tlX0, tlY + 19, tlW, 11, PAPER);
  TIMELINE.forEach(([t, label], i) => {
    void t;
    const sx = tlX0 + i * slotW;
    const s = fitSize(cv, "serif", 9.5, label, slotW - 6, 7.5);
    cv.text("serif", s, sx + 4, tlY + 28, label, INK);
  });

  // ---- stat strip ----
  const stY = 162;
  const stW = CW / STATS.length;
  STATS.forEach(([num, label], i) => {
    const sx = M + i * stW;
    cv.fillRect(sx, stY, 2, 42, RED);
    cv.text("serifBold", 27, sx + 8, stY + 26, num, INK);
    const lines = wrapText(cv, "serif", 10, label, stW - 12);
    lines.slice(0, 2).forEach((ln, li) => cv.text("serif", 10, sx + 8, stY + 38 + li * 0, ln, MUTED));
    if (lines.length > 1) {
      // two-line label: second line below (strip grows to 46)
      cv.text("serif", 10, sx + 8, stY + 38, lines[0], MUTED);
    }
  });
  // stat labels: single fitted line each (cleaner than wrap)
  cv.fillRect(M, stY + 30, CW, 14, PAPER);
  STATS.forEach(([num, label], i) => {
    void num;
    const sx = M + i * stW;
    const s = fitSize(cv, "serif", 10, label, stW - 12, 8);
    cv.text("serif", s, sx + 8, stY + 41, label, MUTED);
  });
  cv.fillRect(M, stY + 44, CW, 1, LINE);

  // ---- region bar ----
  const rbY = 212;
  let rx = M;
  const total = REGIONS.reduce((a, r) => a + r.count, 0);
  for (const r of REGIONS) {
    const rw = (r.count / total) * CW;
    cv.fillRect(rx, rbY, rw, 18, r.color);
    const label = `${r.name} ${r.count}`;
    const s = fitSize(cv, "sansBold", 10.5, label, rw - 6, 7);
    cv.text("sansBold", s, rx + rw / 2, rbY + 13.5, label, WHITE, { align: "center" });
    rx += rw;
  }

  // ---- heroes ----
  const heroY = 236;
  const heroH = 232;
  const heroIlloH = 104;
  const heroW = (CW - 16) / 3;
  HEROES.forEach((hero, i) => {
    const hx = M + i * (heroW + 8);
    const draw = [drawHero1, drawHero2, drawHero3][i];
    draw(cv, hx, heroY, heroW, heroIlloH);
    let cy = heroY + heroIlloH + 8;
    kickerLine(cv, hx, cy, heroW, hero.n, hero.kicker, hero.badge, hero.badgeColor);
    cy += 16;
    const hl = wrapText(cv, "serifBold", 23, hero.headline, heroW);
    hl.forEach((ln, li) => cv.text("serifBold", 23, hx, cy + 22 + li * 26, ln, INK));
    cy += 22 + hl.length * 26 - 4;
    const sl = wrapText(cv, "serif", 12.5, hero.summary, heroW);
    sl.forEach((ln, li) => cv.text("serif", 12.5, hx, cy + 14 + li * 15, ln, INK));
    // (sources are credited in each illustration's banner strip)
    void heroH;
  });
  cv.fillRect(M, heroY + heroH + 2, CW, 1, INK);

  // ---- mediums ----
  const medY = 476;
  const medRowH = 148;
  const medW = (CW - 4 * 8) / 5;
  const medIlloH = 56;
  MEDIUMS.forEach((med, i) => {
    const row = Math.floor(i / 5);
    const col = i % 5;
    const mx = M + col * (medW + 8);
    const my = medY + row * (medRowH + 4);
    drawMed(cv, med.n, mx, my, medW, medIlloH);
    let cy = my + medIlloH + 4;
    kickerLine(cv, mx, cy, medW, med.n, med.kicker, med.badge, med.badgeColor);
    cy += 15;
    const hl = wrapText(cv, "serifBold", 15.5, med.headline, medW);
    hl.forEach((ln, li) => cv.text("serifBold", 15.5, mx, cy + 14 + li * 17, ln, INK));
    cy += 14 + hl.length * 17;
    const sl = wrapText(cv, "serif", 11, med.summary, medW);
    sl.forEach((ln, li) => cv.text("serif", 11, mx, cy + 10.5 + li * 12.5, ln, INK));
  });
  cv.fillRect(M, medY + 2 * medRowH + 6, CW, 1, INK);

  // ---- bottom: map + one-liners ----
  const botY = 782;
  const botH = 176;
  // map column
  const mapW = 330;
  cv.text("sansBold", 11, M, botY + 11, "WHERE IT HAPPENED", RED_DK);
  drawWorldMap(cv, M, botY + 16, mapW, botH - 30);
  cv.text("serif", 9.5, M, botY + botH - 2, "Pins carry each story's number; colour = region.", MUTED);
  // one-liners
  const olX = M + mapW + 12;
  const olW = CW - mapW - 12;
  cv.text("sansBold", 11, olX, botY + 11, "ALSO ON SATURDAY 21 NOVEMBER 2026 — 22 MORE", RED_DK);
  const colW = (olW - 10) / 2;
  const rowH = (botH - 18) / 11;
  ONELINERS.forEach((ol, i) => {
    const col = Math.floor(i / 11);
    const row = i % 11;
    const ox = olX + col * (colW + 10);
    const oy = botY + 18 + row * rowH;
    const colr = REGION_COLOR[ol.region];
    cv.circle(ox + 6, oy + rowH / 2 - 1, 6.5, colr);
    cv.text("sansBold", 7.5, ox + 6, oy + rowH / 2 + 1.5, String(ol.n), WHITE, { align: "center" });
    const s = fitSize(cv, "serif", 11.5, ol.text, colW - 16, 9.5);
    cv.text("serif", s, ox + 15, oy + rowH / 2 + 4, ol.text, INK);
  });

  // ---- DATE CHECK ----
  const dcY = botY + botH + 6;
  const dcH = 52;
  cv.fillRect(M, dcY, CW, dcH, rgb("#fdf2f2"));
  cv.strokeRect(M, dcY, CW, dcH, RED, 1.5);
  cv.fillRect(M + 6, dcY + 6, 76, 15, RED);
  cv.text("sansBold", 10, M + 44, dcY + 17.5, "DATE CHECK", WHITE, { align: "center" });
  const dcLines = [
    "Left out (other day): World Court's Rohingya ruling, Anthropic's $2tn IPO (Thu 19); Kyiv bridge barrage, Cyclone Akvan, Taiwan's payout bill, Ethiopia's 700,000 displaced (Fri 20).",
    "Not yet (future): COP31 approval session Sun 06:00 GMT; Nepal PM Bhandari's India visit (22–23 Nov).",
    "Corrections: none. Peru quake depth differs between agencies: USGS 108 km, IGP 129 km. Early reports put the quake at 6.9; USGS revised it to 6.7.",
  ];
  dcLines.forEach((ln, i) => {
    const s = fitSize(cv, "serif", 10.5, ln, CW - 96, 8.5);
    cv.text("serif", s, M + 88, dcY + 16 + i * 13, ln, INK);
  });

  // ---- footer ----
  const ftY = dcY + dcH + 8;
  cv.text("serif", 10, M, ftY + 9, "Every story here happened, or was first reported, on Saturday 21 November 2026.", INK);
  cv.text("serif", 9.5, W - M, ftY + 9, "Sources named beside each story · Original drawings", MUTED, { align: "right" });

  return cv;
}

function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  const cv = buildPage();
  const png = encodePNG(1024, 1024, cv.toRGB());
  const outPath = join(outDir, "entry.png");
  writeFileSync(outPath, png);
  const sha = createHash("sha256").update(png).digest("hex");
  console.log(`wrote ${outPath} (${png.length} bytes, sha256 ${sha})`);
  if (png.length > 1048576) {
    console.error("ERROR: entry.png exceeds 1 MiB");
    process.exit(1);
  }
}

main();
