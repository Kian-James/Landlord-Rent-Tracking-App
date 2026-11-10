// Produces a filled-in contract that looks exactly like the uploaded one.
//
//   1. Take the uploaded PDF and delete all of its text (tables, lines and
//      spacing stay). The old text is truly removed, so a previous tenant's
//      name can't hide underneath.
//   2. Redraw every line of text at its original position, size and style.
//   3. Where a tagged value sits (a name, a date, an amount...) draw the
//      current lease's value instead, and re-wrap just that paragraph.

import {
  beginText, endText, setFontAndSize, setTextMatrix, showText, setFillingGrayscaleColor, setFillingRgbColor,
  pushGraphicsState, popGraphicsState,
} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import ApiError from '../utils/ApiError.js';
import { charWidth, fontBytes, fontKeyFor, textWidth } from './contractFonts.js';
import { paragraphChars } from './contractLayout.js';
import { formatSlotText } from './contractFields.js';

import { loadPdf, stripPage } from './contractPdfStream.js';

// ---------------------------------------------------------------------------
// 2/3. Drawing
// ---------------------------------------------------------------------------

const SCALE_STEPS = [1, 0.97, 0.94, 0.91, 0.88, 0.85];
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

// One drawn piece of text.
const run = (text, st, size, x, y, sx = 1, col = null) => ({ text, st, size, x, y, sx, col });

// Group consecutive characters into runs that use the same font file.
function runsFromChars(chars, x, y, sx, advance) {
  const runs = [];
  let cur = null;
  let pos = x;
  for (const c of chars) {
    const key = fontKeyFor(c.st, c.ch);
    if (!cur || cur.key !== key || cur.size !== c.size || cur.col !== (c.col || null)) {
      cur = { key, size: c.size, st: c.st, text: '', x: pos, col: c.col || null };
      runs.push(cur);
    }
    cur.text += c.ch;
    pos += advance(c);
  }
  return runs.map((r) => run(r.text, r.st, r.size, r.x, y, sx, r.col));
}

// Unchanged text: every original item at its original spot, stretched to its original width.
function originalRuns(p, chars, upTo, yOff = 0) {
  const out = [];
  const groups = new Map();
  chars.forEach((c, idx) => {
    if (idx >= upTo || c.synthetic || c.item < 0) return;
    const k = `${c.line}:${c.item}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(c);
  });
  for (const [, list] of groups) {
    const y = p.lines[list[0].line].y + yOff;
    if (list[0].spaced) {
      // justified run: draw each word where the original had it
      let word = [];
      const flush = () => {
        if (word.length) out.push(...runsFromChars(word, word[0].x, y, 1, (c) => charWidth(c.st, c.ch, c.size)));
        word = [];
      };
      for (const c of list) {
        if (c.ch === ' ') flush();
        else word.push(c);
      }
      flush();
    } else {
      const sx = clamp(list[0].sx, 0.75, 1.25);
      out.push(...runsFromChars(list, list[0].x, y, sx, (c) => charWidth(c.st, c.ch, c.size) * sx));
    }
  }
  return out;
}

// Lay words out left to right, wrapping at `right`.
function wrapTail(tail, { startX, startY, contX, right, pitch, f, justifyTo, center }) {
  const words = [];
  let cur = [];
  for (const c of tail) {
    if (c.ch === ' ') {
      if (cur.length) words.push({ chars: cur });
      cur = [];
      words.push({ space: true, c });
    } else cur.push(c);
  }
  if (cur.length) words.push({ chars: cur });

  const wordWidth = (w) => w.chars.reduce((s, c) => s + charWidth(c.st, c.ch, c.size) * f, 0);
  const spaceWidth = (w) => charWidth(w.c.st, ' ', w.c.size) * f;

  const lines = [{ x: startX, y: startY, items: [] }];
  let pos = startX;
  for (const w of words) {
    const line = lines[lines.length - 1];
    if (w.space) {
      if (line.items.length) { line.items.push({ space: w }); pos += spaceWidth(w); }
      continue;
    }
    const ww = wordWidth(w);
    if (line.items.length && !center && pos + ww > right + 0.4) {
      while (line.items.length && line.items[line.items.length - 1].space) line.items.pop();
      line.end = pos - 0;
      const next = { x: contX, y: line.y - pitch, items: [] };
      lines.push(next);
      pos = contX;
    }
    lines[lines.length - 1].items.push({ word: w, x: pos, width: ww });
    pos += ww;
  }
  // recompute line ends and positions (spaces were trimmed at wraps)
  for (const line of lines) {
    let x = line.x;
    let lastEnd = x;
    for (const it of line.items) {
      if (it.word) { it.x = x; x += it.width; lastEnd = x; } else x += charWidth(it.space.c.st, ' ', it.space.c.size) * f;
    }
    line.end = lastEnd;
    while (line.items.length && line.items[line.items.length - 1].space) line.items.pop();
  }
  // justify every line but the last
  if (justifyTo) {
    lines.slice(0, -1).forEach((line) => {
      const spaces = line.items.filter((it) => it.space);
      if (!spaces.length) return;
      const extra = justifyTo - line.end;
      if (extra <= 0 || extra > 0.35 * (justifyTo - line.x)) return;
      const per = extra / spaces.length;
      let x = line.x;
      let gap = 0;
      for (const it of line.items) {
        if (it.word) { it.x = x + gap; x += it.width; } else { x += charWidth(it.space.c.st, ' ', it.space.c.size) * f; gap += per; }
      }
      line.end = justifyTo;
    });
  }
  return lines;
}

// ctx: { yOff, shift, canGrow(extraLines) }
//   yOff    - how far earlier changes have already pushed this paragraph (negative = down)
//   shift   - may text below move? (only on pages without tables / rules)
// Returns { runs, delta } where delta is how far everything below should move.
function layoutParagraph(p, slots, values, page, warnings, missing, ctx) {
  const { yOff, shift, canGrow } = ctx;
  const chars = paragraphChars(p);
  const sorted = [...slots].sort((a, b) => a.s - b.s);
  const centered = p.align === 'center' && p.lines.length === 1;
  const s0 = centered ? 0 : sorted[0].s;
  const first = chars[Math.min(s0, chars.length - 1)];
  if (!first) return { runs: originalRuns(p, chars, chars.length, yOff), delta: 0 };

  // Characters to (re)draw: the original text, with each tagged range swapped for its value.
  const tail = [];
  let idx = s0;
  for (const slot of sorted) {
    for (; idx < slot.s; idx += 1) tail.push({ ch: chars[idx].ch, st: chars[idx].st, size: chars[idx].size, col: chars[idx].col });
    const model = chars[slot.s] || first;
    const result = formatSlotText(slot.token, values);
    result.missing.forEach((label) => missing.add(label));
    let valueText = result.text.replace(/\s+/g, ' ');
    // The contract already says "Unit " before the number: don't print "Unit Unit 5B".
    const lead = /^(unit|apt\.?|apartment|room)\s+(.+)$/i.exec(valueText);
    if (lead && slot.token.includes('unit_name')) {
      const before = chars.slice(Math.max(0, slot.s - 14), slot.s).map((c) => c.ch).join('').toLowerCase().trimEnd();
      if (before.endsWith(lead[1].toLowerCase())) valueText = lead[2];
    }
    for (const ch of valueText) tail.push({ ch, st: model.st, size: model.size, col: model.col });
    idx = slot.e;
  }
  for (; idx < chars.length; idx += 1) tail.push({ ch: chars[idx].ch, st: chars[idx].st, size: chars[idx].size, col: chars[idx].col });

  const prefix = originalRuns(p, chars, s0, yOff);
  const startLine = p.lines[first.line];
  const lastLine = p.lines[p.lines.length - 1];
  const pitch = p.lines.length >= 2 ? p.pitch : p.size * 1.2;
  const contX = p.contX ?? p.lines[0].x0;
  const remaining = p.lines.length - first.line;
  const startY = startLine.y + yOff;

  const justifyTo = p.align === 'justify' ? Math.max(...p.lines.slice(0, -1).map((l) => l.x1)) : null;
  const right = justifyTo ? justifyTo + 0.3 : p.right;

  if (centered) {
    const cx = (startLine.x0 + startLine.x1) / 2;
    const half = Math.min(p.right - cx, cx - Math.min(...page.paragraphs.map((q) => q.minX0)));
    let f = 1;
    let width = tail.reduce((sum, c) => sum + charWidth(c.st, c.ch, c.size), 0);
    if (width > 2 * half) { f = clamp((2 * half) / width, 0.7, 1); width *= f; }
    const lines = wrapTail(tail, { startX: cx - width / 2, startY, contX: 0, right: Infinity, pitch, f, center: true });
    return { runs: linesToRuns(lines, f), delta: 0 };
  }

  const layout = (f, r = right, j = justifyTo) => wrapTail(tail, { startX: first.x, startY, contX, right: r, pitch, f, justifyTo: j });

  // Natural layout first. Where text below may move, just let the paragraph take the lines it needs.
  const natural = layout(1);
  const grow = natural.length - remaining;
  if (shift && (grow <= 0 || canGrow(grow))) {
    return { runs: [...prefix, ...linesToRuns(natural, 1)], delta: -grow * pitch };
  }

  // A single line on a page with tables or rules is probably a table cell: squeeze the
  // text to fit the cell rather than wrapping out of it.
  if (!shift && remaining === 1) {
    for (const f of [1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7]) {
      const lines = layout(f);
      if (lines.length === 1) return { runs: [...prefix, ...linesToRuns(lines, f)], delta: 0 };
    }
  }

  // Otherwise stay inside the original space: use the gap below, then squeeze the text a little.
  let topNext = 40;
  for (const other of page.paragraphs) {
    if (other === p) continue;
    const top = other.lines[0].y + 0.8 * other.size;
    const overlapsX = other.minX0 <= p.right + 2 && other.maxX1 >= p.minX0 - 2;
    if (overlapsX && other.lines[0].y < lastLine.y - 0.01 && top < lastLine.y) topNext = Math.max(topNext, top);
  }
  const extra = Math.max(0, Math.floor((lastLine.y - 0.25 * p.size - topNext) / pitch));
  const maxLines = remaining + extra;

  let chosen = null;
  for (const f of SCALE_STEPS) {
    chosen = { lines: layout(f), f };
    if (chosen.lines.length <= maxLines) break;
    if (f === SCALE_STEPS[SCALE_STEPS.length - 1]) {
      if (extra === 0 && remaining === 1) chosen = { lines: layout(f, Infinity, null), f };
      warnings.add(`A value is longer than the space available in the contract (page ${page.number}).`);
    }
  }
  return { runs: [...prefix, ...linesToRuns(chosen.lines, chosen.f)], delta: 0 };
}

function linesToRuns(lines, f) {
  const out = [];
  for (const line of lines) {
    for (const it of line.items) {
      if (!it.word) continue;
      out.push(...runsFromChars(it.word.chars, it.x, line.y, f, (c) => charWidth(c.st, c.ch, c.size) * f));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public: fill a contract
// ---------------------------------------------------------------------------

// slots: [{ p: '0.2', s, e, token }]  (p = paragraph id, s/e = character range)
export async function stampContract({ pdfBytes, model, slots, values, title = '', author = '' }) {
  const pdfDoc = await loadPdf(pdfBytes);
  pdfDoc.registerFontkit(fontkit);
  const pdfPages = pdfDoc.getPages();
  if (pdfPages.length !== model.pages.length) throw new ApiError(500, 'The saved contract template is out of date. Please upload it again.');

  const fonts = new Map();
  const getFont = async (key) => {
    if (!fonts.has(key)) fonts.set(key, await pdfDoc.embedFont(fontBytes(key), { subset: true }));
    return fonts.get(key);
  };

  const byParagraph = new Map();
  for (const slot of slots || []) {
    if (!byParagraph.has(slot.p)) byParagraph.set(slot.p, []);
    byParagraph.get(slot.p).push(slot);
  }

  const warnings = new Set();
  const missing = new Set();

  for (let pi = 0; pi < pdfPages.length; pi += 1) {
    const pdfPage = pdfPages[pi];
    const modelPage = { ...model.pages[pi], number: pi + 1 };
    const { graphics } = stripPage(pdfDoc, pdfPage);
    const paras = modelPage.paragraphs;
    const BOTTOM = 40;
    const isFooter = (q) => q.lines[0].y < 56;

    const yOffs = paras.map(() => 0); // pushed down (negative) or up (positive) by earlier changes
    const runs = [];
    paras.forEach((p, i) => {
      const chars = paragraphChars(p);
      const mine = (byParagraph.get(p.id) || []).filter((sl) => sl.s >= 0 && sl.e <= chars.length && sl.e > sl.s);
      if (!mine.length) {
        runs.push(...originalRuns(p, chars, chars.length, yOffs[i]));
        return;
      }
      const lastY = p.lines[p.lines.length - 1].y;
      // everything below this paragraph (headers' numerals and titles share a baseline, so no column test)
      const below = paras
        .map((q, j) => ({ q, j }))
        .filter(({ q, j }) => j > i && q.lines[0].y < lastY - 0.01 && !isFooter(q));
      const canGrow = (lines) => {
        const pitch = p.lines.length >= 2 ? p.pitch : p.size * 1.2;
        const lowest = Math.min(lastY + yOffs[i], ...below.map(({ q, j }) => q.lines[q.lines.length - 1].y + yOffs[j]));
        return lowest - lines * pitch >= BOTTOM;
      };
      const { runs: placed, delta } = layoutParagraph(p, mine, values, modelPage, warnings, missing, {
        yOff: yOffs[i],
        shift: !graphics,
        canGrow,
      });
      runs.push(...placed);
      if (delta !== 0) below.forEach(({ j }) => { yOffs[j] += delta; });
    });

    const ops = [pushGraphicsState(), setFillingGrayscaleColor(0)];
    const fontNames = new Map();
    let currentColor = null;
    for (const r of runs) {
      if (!r.text.trim()) continue;
      if (r.col !== currentColor) {
        ops.push(r.col
          ? setFillingRgbColor(parseInt(r.col.slice(0, 2), 16) / 255, parseInt(r.col.slice(2, 4), 16) / 255, parseInt(r.col.slice(4, 6), 16) / 255)
          : setFillingGrayscaleColor(0));
        currentColor = r.col;
      }
      // split again by font file (a symbol may need the fallback font)
      let buffer = '';
      let bufKey = null;
      let bufX = r.x;
      let x = r.x;
      const flush = async () => {
        if (!buffer) return;
        const font = await getFont(bufKey);
        if (!fontNames.has(bufKey)) fontNames.set(bufKey, pdfPage.node.newFontDictionary(font.name, font.ref));
        ops.push(
          beginText(),
          setFontAndSize(fontNames.get(bufKey), r.size),
          setTextMatrix(r.sx, 0, 0, 1, bufX, r.y),
          showText(font.encodeText(buffer)),
          endText()
        );
        buffer = '';
      };
      for (const ch of r.text) {
        const key = fontKeyFor(r.st, ch);
        if (key !== bufKey) { await flush(); bufKey = key; bufX = x; }
        buffer += ch;
        x += charWidth(r.st, ch, r.size) * r.sx;
      }
      await flush();
    }
    ops.push(popGraphicsState());
    pdfPage.pushOperators(...ops);
  }

  pdfDoc.setTitle(title || 'Contract');
  pdfDoc.setAuthor(author || '');
  pdfDoc.setSubject('');
  pdfDoc.setKeywords([]);
  pdfDoc.setProducer('Rentora');
  pdfDoc.setCreator('Rentora');
  pdfDoc.setCreationDate(new Date());
  pdfDoc.setModificationDate(new Date());

  const bytes = await pdfDoc.save({ useObjectStreams: true });
  return { bytes: Buffer.from(bytes), missing: [...missing], warnings: [...warnings] };
}
