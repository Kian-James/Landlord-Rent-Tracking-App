// Reads an uploaded contract PDF and describes where every piece of text sits:
// page -> paragraphs -> lines -> styled runs, each with exact coordinates.
//
// This "layout model" is what lets us redraw the contract exactly as it looked
// while swapping a few values. Nothing here is AI: it's geometry.

import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
// Loaded directly (rather than found at runtime) so serverless hosting always bundles it.
import * as pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs';
import ApiError from '../utils/ApiError.js';
import { charWidth, classifyFont, textWidth } from './contractFonts.js';
import { loadPdf, pageContentString, textColorEvents } from './contractPdfStream.js';

globalThis.pdfjsWorker = pdfjsWorker;

const MAX_PAGES = 30;
const MAX_ITEMS = 40000;

const r2 = (n) => Math.round(n * 100) / 100;
const MARKER = /^(?:[•○●◦▪■□\-–—*]|\(?\d{1,2}[.)]|[a-zA-Z][.)]|[IVXLCDM]{1,6}\.)$/;

function standardFontDataUrl() {
  try {
    const require = createRequire(import.meta.url);
    const dir = path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts');
    return fs.existsSync(dir) ? `${dir}${path.sep}` : undefined;
  } catch {
    return undefined;
  }
}

const isBlank = (s) => !s || !s.trim();

// Colour (hex) of the text that starts at this spot, or null for black / unknown.
function colorAt(events, x, y) {
  if (!events) return null;
  let best = null;
  let bestDist = 1.6;
  for (const e of events) {
    const d = Math.max(Math.abs(e.x - x), Math.abs(e.y - y));
    if (d < bestDist) { best = e; bestDist = d; }
  }
  if (!best || best.rgb.every((v) => v <= 40)) return null;
  return best.rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// 1. Raw text items -> lines -> segments (a segment is one run of text with no
//    big gap in it; table cells and signature columns become separate segments)
// ---------------------------------------------------------------------------

function itemsToSegments(items) {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines = [];
  for (const it of sorted) {
    const line = lines.find((l) => Math.abs(l.y - it.y) <= Math.max(1, 0.3 * it.s));
    if (line) line.items.push(it);
    else lines.push({ y: it.y, items: [it] });
  }

  const segments = [];
  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);
    let current = [];
    const flush = () => {
      while (current.length && isBlank(current[0].t)) current.shift();
      while (current.length && isBlank(current[current.length - 1].t)) current.pop();
      if (current.length) {
        const last = current[current.length - 1];
        segments.push({
          y: line.y,
          x0: current[0].x,
          x1: last.x + last.w,
          size: Math.max(...current.map((i) => i.s)),
          items: current,
        });
      }
      current = [];
    };
    for (const it of line.items) {
      // pdf.js reports the empty space between columns as one very wide space character.
      if (isBlank(it.t) && it.w > Math.max(1.6 * it.s, 14)) {
        flush();
        continue;
      }
      const prev = current[current.length - 1];
      if (prev) {
        const gap = it.x - (prev.x + prev.w);
        if (gap > Math.max(1.6 * it.s, 14) && !isBlank(it.t)) flush();
      }
      current.push(it);
    }
    flush();
  }
  return segments;
}

const solidItems = (seg) => seg.items.filter((i) => !isBlank(i.t));
const allBold = (seg) => solidItems(seg).every((i) => i.f[1]);
const firstText = (seg) => solidItems(seg)[0]?.t.trim() || '';
const startsWithMarker = (seg) => MARKER.test(firstText(seg));

// ---------------------------------------------------------------------------
// 2. Segments -> paragraphs
// ---------------------------------------------------------------------------

// A line continues a paragraph only if it really wrapped: the first word of the
// new line would not have fit at the end of the previous one. (Table cells and
// short lists stacked in a column fail this test, so they stay separate.)
function wrapped(prev, seg, pageRight) {
  const item = solidItems(seg)[0];
  if (!item) return false;
  const word = item.t.trimStart().split(/\s+/)[0];
  const st = styleOf(item.f);
  const needed = prev.x1 + charWidth(st, ' ', item.s) + textWidth(st, word, item.s);
  return needed >= pageRight - 6;
}

function joinsParagraph(p, seg, pageRight) {
  const last = p.lines[p.lines.length - 1];
  if (!wrapped(last, seg, pageRight)) return false;
  const dy = last.y - seg.y;
  const size = p.size;
  if (dy < 0.85 * size || dy > 1.9 * size) return false;
  if (p.lines.length >= 2 && Math.abs(dy - p.pitch) > 0.3 * p.pitch + 0.6) return false;
  // headings (all bold) don't merge with body text, in either direction
  if (allBold(seg) !== allBold(last) && (allBold(seg) || allBold(last))) return false;
  if (seg.x1 < p.minX0 || seg.x0 > p.maxX1) return false;

  const first = p.lines[0];
  if (p.contX !== null) return Math.abs(seg.x0 - p.contX) <= 3;
  const diff = seg.x0 - first.x0;
  if (Math.abs(diff) <= 3) return true;
  if (startsWithMarker(first) && diff > 0 && diff < 70) return true; // hanging indent after a bullet
  if (diff < 0 && -diff > 6 && -diff < 70) return true; // indented first line
  return false;
}

function groupParagraphs(segments, pageRight) {
  const sorted = [...segments].sort((a, b) => b.y - a.y || a.x0 - b.x0);
  const paras = [];
  for (const seg of sorted) {
    let target = null;
    let best = Infinity;
    for (const p of paras) {
      const last = p.lines[p.lines.length - 1];
      if (last.y <= seg.y + 0.01) continue;
      if (!joinsParagraph(p, seg, pageRight)) continue;
      const dy = last.y - seg.y;
      if (dy < best) {
        best = dy;
        target = p;
      }
    }
    if (target) {
      const first = target.lines[0];
      if (target.lines.length === 1) {
        target.contX = seg.x0;
        target.pitch = first.y - seg.y;
      } else {
        target.pitch = (target.pitch * (target.lines.length - 1) + (target.lines[target.lines.length - 1].y - seg.y)) / target.lines.length;
      }
      target.lines.push(seg);
      target.minX0 = Math.min(target.minX0, seg.x0);
      target.maxX1 = Math.max(target.maxX1, seg.x1);
    } else {
      paras.push({
        lines: [seg],
        size: seg.size,
        contX: null,
        pitch: seg.size * 1.2,
        minX0: seg.x0,
        maxX1: seg.x1,
      });
    }
  }
  return paras;
}

// Where body text wraps: the right end of the long lines in the document.
function estimateRight(segmentsByPage, pageWidth) {
  const ends = [];
  for (const segs of segmentsByPage) {
    for (const seg of segs) if (seg.x1 - seg.x0 >= pageWidth * 0.5) ends.push(seg.x1);
  }
  ends.sort((a, b) => a - b);
  return ends.length ? ends[Math.floor(ends.length * 0.9)] : pageWidth - 72;
}

// ---------------------------------------------------------------------------
// 3. Alignment + right edge of each paragraph
// ---------------------------------------------------------------------------

// Right edge of the text column for the whole document: where wrapped (non-final)
// lines of body text end. Short lists and signature blocks don't count.
function documentRightEdge(allParas, pageWidth) {
  const ends = [];
  for (const p of allParas) {
    if (p.lines.length < 2) continue;
    p.lines.slice(0, -1).forEach((l) => {
      if (l.x1 >= pageWidth * 0.6) ends.push(l.x1);
    });
  }
  ends.sort((a, b) => a - b);
  return ends.length ? ends[Math.floor(ends.length * 0.97)] : pageWidth - 72;
}

function inferAlignments(paras, pageWidth, docRight) {
  for (const p of paras) {
    const ends = p.lines.slice(0, -1).map((l) => l.x1);
    p.align = 'left';
    if (p.lines.length >= 2 && ends.every((e) => Math.abs(e - docRight) <= 2)) p.align = 'justify';
    else if (p.lines.length >= 2) {
      const centers = p.lines.map((l) => (l.x0 + l.x1) / 2);
      if (Math.max(...centers) - Math.min(...centers) <= 2 && Math.abs(p.lines[0].x0 - p.lines[1].x0) > 4) p.align = 'center';
    }
  }

  // Single lines that sit centered under/over another line (signature names) or on the page centre.
  for (const p of paras) {
    if (p.lines.length !== 1 || p.align !== 'left') continue;
    const l = p.lines[0];
    const c = (l.x0 + l.x1) / 2;
    const width = l.x1 - l.x0;
    if (Math.abs(c - pageWidth / 2) < 2 && l.x0 > 100 && width < pageWidth * 0.8) {
      p.align = 'center';
      continue;
    }
    const mate = paras.find(
      (q) =>
        q !== p &&
        q.lines.length === 1 &&
        Math.abs(q.lines[0].y - l.y) <= 3.2 * l.size &&
        Math.abs(q.lines[0].y - l.y) > 0.5 * l.size &&
        Math.abs((q.lines[0].x0 + q.lines[0].x1) / 2 - c) <= 2.5 &&
        Math.abs(q.lines[0].x1 - q.lines[0].x0 - width) > 4
    );
    if (mate) p.align = 'center';
  }

  // Right limit available to each paragraph (stops short of a neighbour on the same baseline).
  for (const p of paras) {
    const top = p.lines[0].y + p.size;
    const bottom = p.lines[p.lines.length - 1].y - 0.3 * p.size;
    let limit = docRight;
    for (const q of paras) {
      if (q === p) continue;
      const overlapsY = q.lines.some((l) => l.y <= top && l.y >= bottom);
      if (overlapsY && q.minX0 >= p.maxX1 - 1) limit = Math.min(limit, q.minX0 - 6);
    }
    if (p.lines.length === 1) {
      // table cells / signature columns: also stop before text just above or below on the right
      const y = p.lines[0].y;
      for (const q of paras) {
        if (q === p) continue;
        const near = q.lines.some((l) => Math.abs(l.y - y) <= 2.2 * p.size);
        if (near && q.minX0 - p.maxX1 >= 10) limit = Math.min(limit, q.minX0 - 6);
      }
    }
    p.right = Math.max(limit, p.maxX1);
  }
}

// ---------------------------------------------------------------------------
// Public: analyse a PDF
// ---------------------------------------------------------------------------

export async function analyzePdf(buffer, { requireText = true } = {}) {
  if (!buffer || buffer.length < 5 || buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
    throw new ApiError(400, 'That file is not a PDF.');
  }

  let doc;
  try {
    doc = await pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: false,
      disableFontFace: true,
      fontExtraProperties: true,
      isEvalSupported: false,
      verbosity: 0,
      standardFontDataUrl: standardFontDataUrl(),
    }).promise;
  } catch (err) {
    if (err?.name === 'PasswordException') {
      throw new ApiError(422, 'This PDF is password-protected. Remove the password and upload it again.');
    }
    throw new ApiError(422, 'Could not read this PDF. Try exporting it again from Word or Google Docs.');
  }

  if (doc.numPages > MAX_PAGES) {
    throw new ApiError(422, `This PDF has ${doc.numPages} pages. Contracts up to ${MAX_PAGES} pages are supported.`);
  }

  // Colour of each piece of text, read straight from the page's drawing instructions.
  let colorEvents = [];
  try {
    const lib = await loadPdf(buffer);
    colorEvents = lib.getPages().map((pg) => textColorEvents(pageContentString(lib, pg)));
  } catch {
    colorEvents = []; // every colour falls back to black
  }

  const pages = [];
  let totalItems = 0;
  let letters = 0;
  let skipped = 0;

  for (let n = 1; n <= doc.numPages; n += 1) {
    const page = await doc.getPage(n);
    if (page.rotate) throw new ApiError(422, 'This PDF has rotated pages, which are not supported. Export it again without rotation.');
    const [vx0, vy0, vx1, vy1] = page.view;
    const content = await page.getTextContent();
    await page.getOperatorList(); // makes pdf.js load the real font names

    const fontStyles = new Map();
    const styleFor = (fontId) => {
      if (!fontStyles.has(fontId)) {
        let name = '';
        try {
          name = page.commonObjs.get(fontId)?.name || '';
        } catch {
          /* font not loaded */
        }
        const family = content.styles?.[fontId]?.fontFamily || '';
        const c = classifyFont(name, family);
        fontStyles.set(fontId, [c.family, c.bold ? 1 : 0, c.italic ? 1 : 0]);
      }
      return fontStyles.get(fontId);
    };

    const items = [];
    for (const it of content.items) {
      if (typeof it.str !== 'string' || !it.transform || it.str === '') continue;
      const [a, b, c] = it.transform;
      if (Math.abs(b) > 0.01 || Math.abs(c) > 0.01 || a <= 0) { // horizontal text only
        if (it.str.trim()) skipped += 1;
        continue;
      }
      const item = {
        t: it.str,
        x: r2(it.transform[4]),
        y: r2(it.transform[5]),
        w: r2(it.width),
        s: r2(Math.hypot(a, b)),
        f: styleFor(it.fontName),
      };
      const color = colorAt(colorEvents[n - 1], it.transform[4], it.transform[5]);
      if (color) item.c = color;
      items.push(item);
      letters += (it.str.match(/\p{L}/gu) || []).length;
    }
    totalItems += items.length;
    if (totalItems > MAX_ITEMS) throw new ApiError(422, 'This PDF has too much text to process.');

    const width = r2(vx1 - vx0);
    const height = r2(vy1 - vy0);
    pages.push({ width, height, segments: itemsToSegments(items) });
  }

  if (skipped > 0 && requireText) {
    throw new ApiError(422, 'This PDF has rotated or vertical text (for example a diagonal watermark), which is not supported.');
  }

  if (letters < 80 && requireText) {
    throw new ApiError(
      422,
      'This PDF has no readable text (it looks like a scan or a photo). Upload a PDF exported from Word or Google Docs instead.'
    );
  }

  const pageRight = estimateRight(pages.map((pg) => pg.segments), pages[0]?.width || 612);
  for (const pg of pages) pg.paras = groupParagraphs(pg.segments, pageRight);
  const docRight = documentRightEdge(pages.flatMap((pg) => pg.paras), pages[0]?.width || 612);
  const finished = pages.map((pg, n) => {
    inferAlignments(pg.paras, pg.width, docRight);
    // reading order: top to bottom, then left to right
    pg.paras.sort((p, q) => q.lines[0].y - p.lines[0].y || p.minX0 - q.minX0);
    return {
      width: pg.width,
      height: pg.height,
      paragraphs: pg.paras.map((p, i) => ({
        id: `${n}.${i}`,
        align: p.align,
        size: r2(p.size),
        pitch: r2(p.pitch),
        contX: p.contX === null ? null : r2(p.contX),
        right: r2(p.right),
        minX0: r2(p.minX0),
        maxX1: r2(p.maxX1),
        lines: p.lines.map((l) => ({ y: r2(l.y), x0: r2(l.x0), x1: r2(l.x1), size: r2(l.size), items: l.items })),
      })),
    };
  });

  return { version: 1, pages: finished, itemCount: totalItems };
}

// ---------------------------------------------------------------------------
// Characters of a paragraph in reading order, with their original x positions.
// The same function runs when detecting fields and when drawing, so a
// character index means the same thing in both places.
// ---------------------------------------------------------------------------

function styleOf(f) {
  return { family: f[0], bold: Boolean(f[1]), italic: Boolean(f[2]) };
}
const style = styleOf;
export { styleOf };

export function paragraphChars(p) {
  const chars = [];
  p.lines.forEach((line, li) => {
    let prevEnd = null;
    line.items.forEach((item, ii) => {
      const st = style(item.f);
      if (prevEnd !== null) {
        const gap = item.x - prevEnd;
        const last = chars[chars.length - 1];
        if (gap > 0.15 * item.s && last && last.ch !== ' ' && !item.t.startsWith(' ')) {
          chars.push({ ch: ' ', synthetic: true, line: li, item: ii, st, size: item.s, x: prevEnd, col: item.c || null });
        }
      }
      // Reproduce how the original spread this run across its width: justified
      // lines widen the spaces; anything else stretches/squeezes the letters a little.
      const natural = textWidth(st, item.t, item.s);
      const extra = item.w - natural;
      const spaces = [...item.t].filter((c) => c === ' ').length;
      let sx = 1;
      let gap = 0;
      if (natural > 0 && item.w > 0) {
        if (extra > 0.4 && spaces > 0 && extra / spaces < 0.7 * item.s) gap = extra / spaces;
        else sx = item.w / natural;
      }
      let x = item.x;
      for (const ch of item.t) {
        chars.push({ ch, synthetic: false, line: li, item: ii, st, size: item.s, x, sx, spaced: gap > 0, col: item.c || null });
        x += charWidth(st, ch, item.s) * sx + (ch === ' ' ? gap : 0);
      }
      prevEnd = item.x + item.w;
    });
    if (li < p.lines.length - 1) {
      const last = chars[chars.length - 1];
      if (last && last.ch !== ' ') {
        chars.push({ ch: ' ', synthetic: true, line: li, item: -1, st: last.st, size: last.size, x: line.x1, col: last.col });
      }
    }
  });
  return chars;
}

export const paragraphText = (p) => paragraphChars(p).map((c) => c.ch).join('');
