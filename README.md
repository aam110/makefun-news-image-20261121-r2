# Saturday 21 November 2026 — The World in One Day

[![make.fun](https://make.fun/badge/news-image-20261121.svg)](https://make.fun/bounty/news-image-20261121)
[![rank](https://make.fun/badge/news-image-20261121/aam110/makefun-news-image-20261121-r2/rank.svg)](https://make.fun/bounty/news-image-20261121)
[![reward](https://make.fun/badge/news-image-20261121/aam110/makefun-news-image-20261121-r2/reward.svg)](https://make.fun/bounty/news-image-20261121)

A newspaper front page for **Saturday 21 November 2026**: 35 real stories from
9 regions on one page — three heroes (Iran strikes Bahrain bases, the deep
6.7 Peru quake, COP31 running into overtime), ten scene-illustrated mediums,
and 22 one-liners, plus a UTC timeline, a six-stat strip, a world map with a
numbered pin per story, and a DATE CHECK box that names what was left out
(other days), what had not happened yet, and where the sources disagree
(USGS vs IGP on the quake's depth; the early 6.9 estimate revised to 6.7).

## How it works

`main.ts` draws the whole page with a tiny renderer (`render.ts`, ~17 KB):
a 2×-supersampled RGB canvas, scanline polygon fill, and a PNG encoder —
Node standard library only, no dependencies, no network, fully deterministic.

The typography is real serif, not hand-drawn letters: `glyphs.ts` embeds
TrueType outlines extracted at build time from OFL-licensed system fonts
(Liberation Serif regular/bold/italic, Noto Serif Display Black for the
masthead, Noto Sans Bold for labels), including kerning and composite
(accented) glyphs. The extractor lives in `../work/extract-glyphs.py` and is
build-time only — nothing at grade time reads the system fonts.

## Run

```sh
MAKEFUN_OUTPUT_DIR=/tmp/out node main.ts   # writes /tmp/out/entry.png
```

Output is a single 1024×1024 PNG under 1 MiB. Running it twice produces
byte-identical files.
