// Works out what the *uploaded contract itself* says, with no known tenant needed.
//
// Contracts are written in a handful of predictable ways, so we look for the
// wording around each detail:
//   "KHYLE JAMES, of legal age, Filipino ... hereinafter the "LESSOR""  -> landlord name
//   "... with address at 12 Rizal St., ..., hereinafter ..."            -> that person's address
//   "... located at Block 5, Lot 7, ..., with a total floor area"       -> property address
//   "a period of 1 year commencing on Sept 10, 2026 to Sept 10, 2027"  -> lease length + dates
//   "monthly rent of ... (P 6,500.00) ... due on the 5th day"           -> rent + due day
//
// The result is a "values" object shaped like a real lease, which contractDetect.js
// then searches for everywhere in the document (names repeated in signature blocks,
// the same amount written in words, dates in other formats, ...). No AI.

import { MONTHS } from './contractFields.js';

const WORD_NUMBERS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, eighteen: 18, twenty: 20, 'twenty-four': 24, 'thirty-six': 36,
};

const LESSOR_WORDS = /^(lessor|landlord|landlady|owner)$/i;
const LESSEE_WORDS = /^(lessee|tenant|renter|occupant)$/i;

// ---------------------------------------------------------------------------
// Parties: names and addresses
// ---------------------------------------------------------------------------

const NAME_WORD = String.raw`\p{Lu}[\p{L}.'’\-]*`;
const PARTICLE = String.raw`(?:\s+(?:de|del|dela|la|las|los|delos|van|von|y))`;
const NAME = String.raw`${NAME_WORD}(?:${PARTICLE}{0,2}\s+${NAME_WORD}){1,5}`;
// (no "i" flag on purpose: with it, \\p{Lu} would also match lowercase letters)
const AFTER_NAME = String.raw`(?=[Oo]f (?:legal )?age|[Ff]ilipino|FILIPINO|[Ss]ingle|[Mm]arried|[Ww]idow|[Aa] resident|[Rr]esiding|[Ww]ith (?:[Pp]ostal |[Pp]rincipal |[Pp]resent )?[Aa]ddress|[Aa]n? (?:[Ii]ndividual|[Cc]orporation))`;
const PARTY_RE = new RegExp(`(${NAME})\\s*,\\s*${AFTER_NAME}`, 'gu');
const ROLE_RE = /(?:hereinafter|herein|hereafter)\b[^"“”'\n]{0,80}?["“'‘]?\s*(?:the\s+)?(lessor|landlord|landlady|owner|lessee|tenant|renter|occupant)\b/i;
const ADDRESS_RE = /(?:with\s+(?:postal\s+|principal\s+|present\s+|permanent\s+)?address(?:es)?(?:\s+(?:at|in|of))?|residing\s+(?:at|in)|resident\s+of|whose\s+address\s+is)\s+(.+?)(?=\s*,?\s*(?:hereinafter|herein\b|hereafter|\(|["“]))/is;
const HONORIFIC = /^(?:mr|mrs|ms|mx|dr|engr|atty|sir|madam)\.?\s+/i;

// A name or address that is written in CAPITALS in the contract is stored in normal case, so the
// field is tagged "print in CAPITALS" and a real record ("Khyle James") prints the same way.
function normalizeCase(text) {
  const letters = text.replace(/[^\p{L}]/gu, '');
  if (!letters || letters !== letters.toUpperCase() || letters === letters.toLowerCase()) return text;
  return text.toLowerCase().replace(/(^|[\s\-.,'’(/])(\p{L})/gu, (m, before, ch) => before + ch.toUpperCase());
}

function cleanText(s) {
  return String(s).replace(/\s+/g, ' ').replace(/^[\s,.;:]+|[\s,;:]+$/g, '').trim();
}

function findParties(text) {
  const parties = [];
  const hits = [...text.matchAll(PARTY_RE)];
  hits.forEach((m, i) => {
    const end = m.index + m[0].length;
    const next = hits[i + 1]?.index ?? Math.min(text.length, end + 900);
    const window = text.slice(end, next);
    const role = ROLE_RE.exec(window);
    if (!role) return;
    const isLessor = LESSOR_WORDS.test(role[1]);
    const name = cleanText(m[1].replace(HONORIFIC, ''));
    if (name.split(/\s+/).length < 2) return;
    const addr = ADDRESS_RE.exec(window.slice(0, role.index + role[0].length));
    const address = addr ? cleanText(addr[1]) : '';
    parties.push({
      role: isLessor ? 'lessor' : 'lessee',
      name: normalizeCase(name),
      address: address.length >= 6 && address.length <= 220 ? normalizeCase(address) : '',
    });
  });
  return parties;
}

// ---------------------------------------------------------------------------
// Property address
// ---------------------------------------------------------------------------

// Where an address ends: before ", with ..." / "hereinafter" / "for residential purposes", at the end of a
// sentence, or at the end of the paragraph. A full stop after "St.", "Brgy.", "Sto." etc. is part of the address.
const ABBREV = 'st|ave|blvd|rd|brgy|brg|bgy|blk|bldg|subd|sto|sta|mt|ft|no|dr|jr|sr|cor|ext|apt|hwy|pob|nat|bo';
const STOP = String.raw`(?=,\s*(?:with|having|consisting|hereinafter|herein|which|that|to be|for the|and\s+(?:more|particularly|described))\b|\s+hereinafter\b|\s+(?:for|to be)\s+(?:residential|commercial|the\s+(?:use|purpose)|use|his|her|their)\b|(?<!\b(?:${ABBREV}))\.\s|;\s|\n|$)`;
const PROPERTY_PATTERNS = [
  // "A residential house located at Block 5, Lot 7, ...", "the apartment situated at ..."
  new RegExp(String.raw`(?:located|situated|found)\s+(?:at|in|on)\s+(.+?)${STOP}`, 'gis'),
  // "the premises at ...", "the house at ...", "the unit at ..."
  new RegExp(String.raw`\b(?:premises|property|house|apartment|building|condominium|condo|dwelling)\s+(?:at|known as)\s+(.+?)${STOP}`, 'gis'),
  // "Property address: ...", "Address of the leased premises: ...", "Leased premises: ..."
  new RegExp(String.raw`(?:property\s+address|address\s+of\s+the\s+(?:leased\s+)?(?:premises|property)|leased\s+premises|subject\s+property|premises)\s*(?:is|are)?\s*[:\-\u2013]\s*(.+?)${STOP}`, 'gis'),
  // "...described as follows: 12 Rizal Avenue, ..."
  new RegExp(String.raw`described\s+as\s+follows\s*[:\-\u2013]\s*(.+?)${STOP}`, 'gis'),
];

function findPropertyAddress(text) {
  for (const re of PROPERTY_PATTERNS) {
    for (const m of text.matchAll(re)) {
      const value = cleanText(m[1]);
      if (/^(the following|the address|described|said|its|this|the lessee|the lessor)\b/i.test(value)) continue;
      if (value.length < 8 || value.length > 220) continue;
      if (!/\d/.test(value) && !value.includes(',')) continue;
      return value;
    }
  }
  return '';
}

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

const AMOUNT_RE = /(?:₱|PHP|Php|php|P)\s?(\d[\d,]*(?:\.\d{1,2})?)(?![\d\w])/g;
const MONEY_CONTEXT = [
  ['deposit_amount', /deposit/gi],
  ['advance_amount', /advance/gi],
  ['total_move_in', /total/gi],
  ['monthly_rent', /(?<!advance\s)\b(?:rent|rental|monthly|per month|every month)/gi],
];

function classifyAmount(text, index) {
  const before = text.slice(Math.max(0, index - 160), index);
  let best = null;
  let bestPos = -1;
  for (const [key, re] of MONEY_CONTEXT) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(before))) if (m.index > bestPos) { bestPos = m.index; best = key; }
  }
  return best;
}

function findMoney(text) {
  const found = {};
  for (const m of text.matchAll(AMOUNT_RE)) {
    const amount = Number(m[1].replace(/,/g, ''));
    if (!amount) continue;
    const key = classifyAmount(text, m.index);
    if (key && found[key] === undefined) found[key] = amount;
  }
  return found;
}

// ---------------------------------------------------------------------------
// Dates and lease length
// ---------------------------------------------------------------------------

const MONTH_NAMES = MONTHS.map((m, i) => ({ name: m.toLowerCase(), n: i + 1 }));
const monthNumber = (word) => {
  const w = word.toLowerCase().replace(/\.$/, '');
  const hit = MONTH_NAMES.find((m) => m.name === w || (w.length >= 3 && m.name.startsWith(w)));
  return hit ? hit.n : 0;
};
const MONTH_RE = String.raw`(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?`;
const DATE_PATTERNS = [
  { re: new RegExp(String.raw`\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:day\s+)?of\s+(${MONTH_RE}),?\s+(\d{4})\b`, 'gi'), order: 'dMy' },
  { re: new RegExp(String.raw`\b(${MONTH_RE})\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b`, 'gi'), order: 'Mdy' },
  { re: new RegExp(String.raw`\b(\d{1,2})\s+(${MONTH_RE}),?\s+(\d{4})\b`, 'gi'), order: 'dMy' },
  { re: /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, order: 'mdy' },
];

function findDates(text) {
  // 01/11/2026 could be 1 Nov or Jan 11. If any date in the document has a number above 12
  // in one position, that position is the day (31/10/2027 -> day first).
  const slash = [...text.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g)];
  const dayFirst = slash.some((m) => Number(m[1]) > 12) && !slash.some((m) => Number(m[2]) > 12);

  const dates = [];
  for (const { re, order } of DATE_PATTERNS) {
    for (const m of text.matchAll(re)) {
      let day; let month; let year;
      if (order === 'dMy') { day = Number(m[1]); month = monthNumber(m[2]); year = Number(m[3]); }
      else if (order === 'Mdy') { month = monthNumber(m[1]); day = Number(m[2]); year = Number(m[3]); }
      else if (dayFirst) { day = Number(m[1]); month = Number(m[2]); year = Number(m[3]); }
      else { month = Number(m[1]); day = Number(m[2]); year = Number(m[3]); }
      if (!month || month > 12 || !day || day > 31 || year < 1990 || year > 2200) continue;
      const start = m.index;
      const end = m.index + m[0].length;
      if (dates.some((d) => start < d.end && d.start < end)) continue;
      dates.push({ start, end, parts: { year, month, day } });
    }
  }
  return dates.sort((a, b) => a.start - b.start);
}

function findLeaseDates(text) {
  const dates = findDates(text);
  let startDate = null;
  let endDate = null;
  for (const d of dates) {
    const before = text.slice(Math.max(0, d.start - 50), d.start).toLowerCase();
    if (!startDate && /(commenc|effective|start|begin|from)\w*[^.;]{0,30}$/.test(before)) {
      startDate = d;
      continue;
    }
    if (startDate && !endDate && d.start > startDate.end && /(\bto\b|until|till|through|ending|expir\w*|terminat\w*|up to)[^.;]{0,20}$/.test(before)) {
      endDate = d;
    }
  }
  return { start: startDate?.parts || null, end: endDate?.parts || null };
}

const numberFrom = (piece) => {
  const digits = /\d+/.exec(piece);
  if (digits) return Number(digits[0]);
  const word = piece.toLowerCase().match(/[a-z]+(?:-[a-z]+)?/g)?.find((w) => WORD_NUMBERS[w]);
  return word ? WORD_NUMBERS[word] : 0;
};

function findDuration(text) {
  const m = /(?:period|term|duration)\s+of\s+(?:a\s+|an\s+)?([^.;]{1,40}?)\b(years?|months?)\b/i.exec(text)
    || /\bfor\s+(?:a\s+(?:period|term)\s+of\s+)?(\d{1,2}|one|two|three|four|five|six|twelve|eighteen|twenty-four)\s*(?:\(\d+\)\s*)?(years?|months?)\b/i.exec(text);
  if (!m) return 0;
  const n = numberFrom(m[1]);
  if (!n) return 0;
  return /year/i.test(m[2]) ? n * 12 : n;
}

function findDueDay(text) {
  const m = /\b(\d{1,2})(?:st|nd|rd|th)\s+(?:day\s+)?of\s+(?:each|every|the)\s+month/i.exec(text)
    || /(?:on or before|not later than|every|by)\s+the\s+(\d{1,2})(?:st|nd|rd|th)\b/i.exec(text);
  const day = m ? Number(m[1]) : 0;
  return day >= 1 && day <= 31 ? day : 0;
}

function findUnit(text) {
  const m = /\b(?:unit|apt\.?|apartment|room|door)\s*(?:no\.?|number|#)?\s*([A-Za-z]?\d+[A-Za-z]?(?:-[A-Za-z0-9]+)?)\b/i.exec(text);
  return m ? m[1] : '';
}

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

// texts: the document's paragraphs in reading order. Returns { values, notes }.
export function inferValues(texts) {
  const text = texts.join('\n');
  const values = {};

  const parties = findParties(text);
  const lessor = parties.find((p) => p.role === 'lessor');
  const lessee = parties.find((p) => p.role === 'lessee');
  if (lessor) {
    values.lessor_name = lessor.name;
    if (lessor.address) values.lessor_address = lessor.address;
  }
  if (lessee) {
    values.lessee_name = lessee.name;
    if (lessee.address) values.lessee_address = lessee.address;
  }

  const property = findPropertyAddress(text);
  if (property) values.property_address = normalizeCase(property);

  Object.assign(values, findMoney(text));

  const { start, end } = findLeaseDates(text);
  if (start) values.start_date = start;
  if (end) values.end_date = end;

  const months = findDuration(text);
  if (months) values.duration_months = months;
  const due = findDueDay(text);
  if (due) values.rent_due_day = due;
  const unit = findUnit(text);
  if (unit) values.unit_name = unit;

  return values;
}

// "LESSOR" / "LESSEE" under a name in a signature block: the name above is that person's,
// even if it is spelled differently from the first mention (a typo, a middle initial...).
export function signatureRoles(items) {
  // items: [{ id, text, cx, top, size, page }] ; returns [{ id, role }]
  const out = [];
  for (const label of items) {
    const word = label.text.trim();
    const role = LESSOR_WORDS.test(word) ? 'lessor' : LESSEE_WORDS.test(word) ? 'lessee' : null;
    if (!role) continue;
    const above = items
      .filter((o) => o.page === label.page && o.id !== label.id && o.top > label.top && o.top - label.top <= 3.2 * label.size && Math.abs(o.cx - label.cx) <= 8)
      .sort((a, b) => a.top - b.top)[0];
    if (!above) continue;
    const t = above.text.trim();
    if (t.length < 4 || t.length > 70 || /\d/.test(t) || LESSOR_WORDS.test(t) || LESSEE_WORDS.test(t)) continue;
    out.push({ id: above.id, role, text: t });
  }
  return out;
}
