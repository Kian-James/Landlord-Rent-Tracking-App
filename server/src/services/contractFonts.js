// Fonts used to redraw contract text.
//
// An uploaded contract is usually set in Arial, Times New Roman or Courier.
// We redraw it in Liberation Sans / Serif / Mono, which are designed to have
// exactly the same character widths as those fonts, so lines break and align
// the same way. DejaVu Sans is a fallback for symbols Liberation lacks.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fontkit from '@pdf-lib/fontkit';

const FONT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'fonts');

const FILES = {
  'sans:r': 'LiberationSans-Regular.ttf',
  'sans:b': 'LiberationSans-Bold.ttf',
  'sans:i': 'LiberationSans-Italic.ttf',
  'sans:bi': 'LiberationSans-BoldItalic.ttf',
  'serif:r': 'LiberationSerif-Regular.ttf',
  'serif:b': 'LiberationSerif-Bold.ttf',
  'serif:i': 'LiberationSerif-Italic.ttf',
  'serif:bi': 'LiberationSerif-BoldItalic.ttf',
  'mono:r': 'LiberationMono-Regular.ttf',
  'mono:b': 'LiberationMono-Bold.ttf',
  'mono:i': 'LiberationMono-Italic.ttf',
  'mono:bi': 'LiberationMono-BoldItalic.ttf',
  'fallback:r': 'DejaVuSans.ttf',
  'fallback:b': 'DejaVuSans-Bold.ttf',
};

// Turn a PDF font name like "ABCDEF+Arial-BoldMT" into a style we can reproduce.
export function classifyFont(rawName = '', pdfJsFamily = '') {
  const name = String(rawName).replace(/^[A-Z]{6}\+/, '');
  const bold = /bold|black|heavy|semibold|demi/i.test(name);
  const italic = /italic|oblique|ital\b|-it\b/i.test(name);
  let family = 'sans';
  if (/mono|courier|consolas|menlo|typewriter/i.test(name) || /monospace/i.test(pdfJsFamily)) family = 'mono';
  else if (
    !/sans|arial|helvet|calibri|verdana|tahoma|roboto|segoe|gothic|open ?sans|lato/i.test(name) &&
    (/times|serif|georgia|garamond|cambria|palatino|book|minion|caladea|tinos|baskerville|didot/i.test(name) ||
      (/serif/i.test(pdfJsFamily) && !/sans/i.test(pdfJsFamily)))
  ) {
    family = 'serif';
  }
  return { family, bold, italic };
}

export const styleKey = (style) => `${style.family}:${style.bold ? 'b' : ''}${style.italic ? 'i' : ''}` .replace(/:$/, ':r');

const bytesCache = new Map();
const fontCache = new Map();

export function fontBytes(key) {
  if (!FILES[key]) throw new Error(`No font for ${key}`);
  if (!bytesCache.has(key)) bytesCache.set(key, fs.readFileSync(path.join(FONT_DIR, FILES[key])));
  return bytesCache.get(key);
}

function loadFont(key) {
  if (!fontCache.has(key)) fontCache.set(key, fontkit.create(fontBytes(key)));
  return fontCache.get(key);
}

const resolveKey = (style) => {
  const key = styleKey(style);
  return FILES[key] ? key : `${style.family}:r`;
};

// Does the main font for this style have a glyph for this character?
export function hasGlyph(style, ch) {
  return loadFont(resolveKey(style)).hasGlyphForCodePoint(ch.codePointAt(0));
}

// Which font file should draw this character (main font, or the symbol fallback)?
export function fontKeyFor(style, ch) {
  const key = resolveKey(style);
  if (ch === ' ' || ch === '\u00a0' || loadFont(key).hasGlyphForCodePoint(ch.codePointAt(0))) return key;
  const fb = style.bold && FILES['fallback:b'] ? 'fallback:b' : 'fallback:r';
  return loadFont(fb).hasGlyphForCodePoint(ch.codePointAt(0)) ? fb : key;
}

// Advance width of one character at a size, no kerning (PDF viewers don't kern either).
const widthCache = new Map();
export function charWidth(style, ch, size) {
  const key = fontKeyFor(style, ch);
  const id = `${key}|${ch}`;
  let units = widthCache.get(id);
  if (units === undefined) {
    const font = loadFont(key);
    const glyph = font.glyphForCodePoint(ch.codePointAt(0));
    units = glyph.advanceWidth / font.unitsPerEm;
    widthCache.set(id, units);
  }
  return units * size;
}

export function textWidth(style, text, size) {
  let total = 0;
  for (const ch of text) total += charWidth(style, ch, size);
  return total;
}
