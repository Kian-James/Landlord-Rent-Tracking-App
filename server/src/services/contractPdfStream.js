// Low-level reading of a PDF page's content stream: finding and removing text
// objects, spotting tables/rules, and reading the colour of each piece of text.

import {
  PDFDocument, PDFName, PDFArray, PDFRawStream, decodePDFRawStream,
} from 'pdf-lib';
import ApiError from '../utils/ApiError.js';

// ---------------------------------------------------------------------------
// 1. Remove text objects (BT ... ET) from a page's content stream
// ---------------------------------------------------------------------------

const isWs = (c) => c === 0x20 || c === 0x0a || c === 0x0d || c === 0x09 || c === 0x0c || c === 0x00;
const isDelim = (c) => c === 0x28 || c === 0x29 || c === 0x3c || c === 0x3e || c === 0x5b || c === 0x5d || c === 0x7b || c === 0x7d || c === 0x2f || c === 0x25;

// Walks a content stream and reports each plain token (numbers and operators),
// skipping strings, names, comments, dictionaries and inline image data.
export function* scanTokens(src) {
  const n = src.length;
  let i = 0;
  while (i < n) {
    const c = src.charCodeAt(i);
    if (isWs(c)) { i += 1; continue; }
    if (c === 0x25) { while (i < n && src.charCodeAt(i) !== 0x0a && src.charCodeAt(i) !== 0x0d) i += 1; continue; }
    if (c === 0x28) { // literal string, may nest and escape
      let depth = 1;
      i += 1;
      while (i < n && depth > 0) {
        const d = src.charCodeAt(i);
        if (d === 0x5c) i += 2;
        else { if (d === 0x28) depth += 1; else if (d === 0x29) depth -= 1; i += 1; }
      }
      continue;
    }
    if (c === 0x3c) {
      if (src.charCodeAt(i + 1) === 0x3c) { i += 2; continue; }
      while (i < n && src.charCodeAt(i) !== 0x3e) i += 1;
      i += 1;
      continue;
    }
    if (c === 0x2f) { i += 1; while (i < n && !isWs(src.charCodeAt(i)) && !isDelim(src.charCodeAt(i))) i += 1; continue; }
    if (isDelim(c)) { i += 1; continue; }

    const start = i;
    while (i < n && !isWs(src.charCodeAt(i)) && !isDelim(src.charCodeAt(i))) i += 1;
    const tok = src.slice(start, i);
    if (tok === 'ID') { // inline image: skip the binary data up to EI
      const m = /[\s]EI(?=[\s]|$)/.exec(src.slice(i));
      yield { tok, start, end: i };
      i = m ? i + m.index + 3 : n;
      continue;
    }
    yield { tok, start, end: i };
  }
}

export function stripTextObjects(src) {
  const removed = [];
  let btStart = -1;
  for (const { tok, start, end } of scanTokens(src)) {
    if (tok === 'BT') btStart = start;
    else if (tok === 'ET' && btStart >= 0) { removed.push([btStart, end]); btStart = -1; }
  }
  if (!removed.length) return src;
  let out = '';
  let cursor = 0;
  for (const [x, y] of removed) { out += `${src.slice(cursor, x)}\n`; cursor = y; }
  return out + src.slice(cursor);
}

// Does the page draw anything besides text and a plain white background
// (table borders, rules, underlines, images)? Those can't be moved around.
export function pageHasGraphics(strippedSrc) {
  const stack = [];
  let fillWhite = false;
  let recent = [];
  for (const { tok } of scanTokens(strippedSrc)) {
    if (/^[-+]?[0-9.]+$/.test(tok)) { recent.push(Number(tok)); if (recent.length > 4) recent.shift(); continue; }
    switch (tok) {
      case 'q': stack.push(fillWhite); break;
      case 'Q': fillWhite = stack.length ? stack.pop() : false; break;
      case 'rg': fillWhite = recent.length >= 3 && recent.slice(-3).every((v) => v === 1); break;
      case 'g': fillWhite = recent.length >= 1 && recent[recent.length - 1] === 1; break;
      case 'k': case 'sc': case 'scn': fillWhite = false; break;
      case 'S': case 's': case 'B': case 'B*': case 'b': case 'b*': case 'sh': case 'Do': case 'BI':
        return true;
      case 'f': case 'F': case 'f*':
        if (!fillWhite) return true;
        break;
      default:
    }
    recent = [];
  }
  return false;
}

export function pageContentString(pdfDoc, page) {
  const contents = page.node.Contents();
  if (!contents) return '';
  const refs = contents instanceof PDFArray ? contents.asArray() : [contents];
  let all = '';
  for (const ref of refs) {
    const stream = pdfDoc.context.lookup(ref);
    if (!(stream instanceof PDFRawStream)) throw new ApiError(422, 'This PDF uses an unsupported structure.');
    all += `${Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1')}\n`;
  }
  return all;
}

export function stripPage(pdfDoc, page) {
  const stripped = stripTextObjects(pageContentString(pdfDoc, page));
  const graphics = pageHasGraphics(stripped);
  const stream = pdfDoc.context.flateStream(Buffer.from(stripped, 'latin1'));
  page.node.set(PDFName.of('Contents'), pdfDoc.context.register(stream));
  const resources = page.node.get(PDFName.of('Resources'));
  const dict = resources && pdfDoc.context.lookup(resources);
  if (dict?.delete) dict.delete(PDFName.of('Font')); // the old fonts are no longer used
  return { graphics };
}

export async function loadPdf(bytes) {
  try {
    return await PDFDocument.load(bytes, { updateMetadata: false });
  } catch {
    throw new ApiError(422, 'This PDF is protected or damaged and cannot be used as a template.');
  }
}

// The PDF with its text removed (used to check the template is safe to edit).
export async function textFreeCopy(bytes) {
  const pdfDoc = await loadPdf(bytes);
  for (const page of pdfDoc.getPages()) stripPage(pdfDoc, page);
  return pdfDoc.save();
}


// ---------------------------------------------------------------------------
// Text colours
// ---------------------------------------------------------------------------

const mul = (m, n) => [
  m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3],
  m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3],
  m[4] * n[0] + m[5] * n[2] + n[4], m[4] * n[1] + m[5] * n[3] + n[5],
];
const to255 = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));
const cmykToRgb = (c, m, y, k) => [to255((1 - c) * (1 - k)), to255((1 - m) * (1 - k)), to255((1 - y) * (1 - k))];

// Walks a (not yet stripped) content stream and reports, for every piece of
// shown text, where it starts and what fill colour it has: [{ x, y, rgb }].
// Positions are in page coordinates, matching what pdf.js reports for text.
export function textColorEvents(src) {
  const events = [];
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack = [];
  let fill = [0, 0, 0];
  let tm = [1, 0, 0, 1, 0, 0];
  let tlm = [1, 0, 0, 1, 0, 0];
  let leading = 0;
  let advanced = false;
  let nums = [];

  const lineMove = (tx, ty) => {
    tlm = mul([1, 0, 0, 1, tx, ty], tlm);
    tm = tlm;
    advanced = false;
  };
  const show = () => {
    if (advanced) return; // position after a previous show is unknown; leave that text black
    events.push({
      x: tm[4] * ctm[0] + tm[5] * ctm[2] + ctm[4],
      y: tm[4] * ctm[1] + tm[5] * ctm[3] + ctm[5],
      rgb: [...fill],
    });
    advanced = true;
  };

  for (const { tok } of scanTokens(src)) {
    if (/^[-+]?(\d+\.?\d*|\.\d+)$/.test(tok)) {
      nums.push(Number(tok));
      if (nums.length > 8) nums.shift();
      continue;
    }
    const last = (n) => nums.slice(-n);
    switch (tok) {
      case 'q': stack.push({ ctm: [...ctm], fill: [...fill] }); break;
      case 'Q': { const s = stack.pop(); if (s) { ctm = s.ctm; fill = s.fill; } break; }
      case 'cm': if (nums.length >= 6) ctm = mul(last(6), ctm); break;
      case 'rg': if (nums.length >= 3) fill = last(3).map(to255); break;
      case 'g': if (nums.length >= 1) fill = [to255(last(1)[0]), to255(last(1)[0]), to255(last(1)[0])]; break;
      case 'k': if (nums.length >= 4) fill = cmykToRgb(...last(4)); break;
      case 'sc': case 'scn':
        if (nums.length === 3) fill = last(3).map(to255);
        else if (nums.length === 1) fill = [to255(nums[0]), to255(nums[0]), to255(nums[0])];
        else if (nums.length === 4) fill = cmykToRgb(...last(4));
        break;
      case 'BT': tm = [1, 0, 0, 1, 0, 0]; tlm = tm; advanced = false; break;
      case 'Tm': if (nums.length >= 6) { tm = last(6); tlm = tm; advanced = false; } break;
      case 'Td': if (nums.length >= 2) lineMove(...last(2)); break;
      case 'TD': if (nums.length >= 2) { leading = -last(2)[1]; lineMove(...last(2)); } break;
      case 'TL': if (nums.length >= 1) leading = last(1)[0]; break;
      case 'T*': lineMove(0, -leading); break;
      case "'": case '"': lineMove(0, -leading); show(); break;
      case 'Tj': case 'TJ': show(); break;
      default:
    }
    nums = [];
  }
  return events;
}
