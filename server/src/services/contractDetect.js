// Finds the parts of an uploaded contract that change from tenant to tenant.
//
// No AI: we know the real values of one lease (its tenant, rent, dates...), so
// we simply search each paragraph for those exact values (and for the same
// amount written in words, dates in common formats, and so on).

import { FIELDS, MONTHS, makeToken, moneyWordsPlain, numberToWords } from './contractFields.js';

const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const NOT_WORD_BEFORE = String.raw`(?<![\p{L}\p{N}])`;
const NOT_WORD_AFTER = String.raw`(?![\p{L}\p{N}])`;

// Matches a phrase regardless of spacing, commas or full stops in between.
function looseRegex(value) {
  const tokens = String(value).split(/[\s,.;:]+/).filter(Boolean);
  if (!tokens.length) return null;
  const body = tokens.map(escapeRe).join(String.raw`[\s,.;:]*`);
  return new RegExp(`${NOT_WORD_BEFORE}${body}${NOT_WORD_AFTER}`, 'giu');
}

function caseMods(matched, value) {
  const letters = matched.replace(/[^\p{L}]/gu, '');
  if (!letters) return [];
  if (matched === matched.toUpperCase() && value !== value.toUpperCase()) return ['upper'];
  if (matched === matched.toLowerCase() && value !== value.toLowerCase()) return ['lower'];
  return [];
}

function amountPattern(amount) {
  const whole = Math.floor(Math.abs(amount));
  const cents = Math.round((Math.abs(amount) - whole) * 100);
  const digits = String(whole);
  const groups = [];
  for (let i = digits.length; i > 0; i -= 3) groups.unshift(digits.slice(Math.max(0, i - 3), i));
  const body = groups.join(',?');
  const decimals = cents ? String.raw`\.${String(cents).padStart(2, '0')}` : String.raw`(?:\.00)?`;
  return new RegExp(String.raw`(?<![\d,.])${body}${decimals}(?![\d]|,\d)`, 'g');
}

const MONEY_KEYWORDS = [
  ['deposit_amount', /deposit/gi],
  ['advance_amount', /advance/gi],
  ['total_move_in', /total/gi],
  ['monthly_rent', /(?<!advance\s)\brent/gi],
];

function pickMoneyKey(candidates, text, index) {
  if (candidates.length === 1) return candidates[0];
  const before = text.slice(Math.max(0, index - 160), index);
  let best = null;
  let bestPos = -1;
  for (const [key, re] of MONEY_KEYWORDS) {
    if (!candidates.includes(key)) continue;
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(before))) if (m.index > bestPos) { bestPos = m.index; best = key; }
  }
  return best || candidates[0];
}

const monthPattern = (mo) => {
  const full = MONTHS[mo - 1];
  const alts = [full, ...(full === 'September' ? ['Sept', 'Sep'] : [full.slice(0, 3)])];
  return String.raw`(?:${alts.join('|')})\.?`;
};
const MONTH_ANY = String.raw`(?:${MONTHS.map((_, i) => monthPattern(i + 1)).join('|')})`;
const DAY_ORD = (d) => String.raw`0?${d}(?:st|nd|rd|th)?`;

function dateMatchers(key, parts) {
  if (!parts) return [];
  const { year: y, month: mo, day: d } = parts;
  const month = monthPattern(mo);
  const mk = (src, mods) => ({ key, mods, re: new RegExp(`${NOT_WORD_BEFORE}${src}${NOT_WORD_AFTER}`, 'giu') });
  return [
    mk(String.raw`${DAY_ORD(d)}\s+day\s+of\s+${month},?\s+${y}`, ['dmy_day']),
    mk(String.raw`${DAY_ORD(d)}\s+of\s+${month}\s+${y}`, ['dmy_of']),
    mk(String.raw`${month}\s+${DAY_ORD(d)},?\s+${y}`, ['long']),
    mk(String.raw`0?${d}\s+${month},?\s+${y}`, ['dmy']),
    mk(String.raw`0?${mo}/0?${d}/${y}`, ['slash']),
    ...(mo !== d ? [mk(String.raw`0?${d}/0?${mo}/${y}`, ['slash_dmy'])] : []),
  ];
}

// Finds this lease's values inside one paragraph's text.
// Returns [{ start, end, token, key }] with no overlaps.
export function detectMatches(text, values) {
  const matches = [];
  const add = (start, end, key, mods) => matches.push({ start, end, token: makeToken(key, mods), key });

  // Names, address, unit, phone, email
  for (const key of ['lessee_name', 'lessor_name', 'lessee_address', 'lessor_address', 'property_address', 'property_description', 'property_name', 'lessee_phone', 'lessee_email', 'unit_name']) {
    const value = String(values[key] || '').trim();
    if (!value) continue;
    let re = looseRegex(value);
    if (key === 'unit_name' && /^\d{1,3}$/.test(value)) {
      re = new RegExp(String.raw`(?<=\b(?:unit|apt\.?|apartment|room|door|no\.?|#)\s*)${escapeRe(value)}${NOT_WORD_AFTER}`, 'giu');
    }
    if (!re || (key === 'unit_name' && value.length < 2)) continue;
    let m;
    while ((m = re.exec(text))) {
      add(m.index, m.index + m[0].length, key, caseMods(m[0], value));
      if (m[0].length === 0) re.lastIndex += 1;
    }
  }

  // Money: digits and the same amount written in words
  const moneyKeys = ['monthly_rent', 'advance_amount', 'deposit_amount', 'total_move_in'];
  const byAmount = new Map();
  for (const key of moneyKeys) {
    const v = Number(values[key]);
    if (!v) continue;
    byAmount.set(v, [...(byAmount.get(v) || []), key]);
  }
  for (const [amount, candidates] of byAmount) {
    const digitsRe = amountPattern(amount);
    let m;
    while ((m = digitsRe.exec(text))) {
      const key = pickMoneyKey(candidates, text, m.index);
      add(m.index, m.index + m[0].length, key, m[0].includes('.') ? [] : ['int']);
    }
    const words = moneyWordsPlain(amount).split(/[\s-]+/).map(escapeRe).join(String.raw`[\s-]+`);
    const wordsRe = new RegExp(
      String.raw`${NOT_WORD_BEFORE}${words}(\s*(?:&|and)\s*(?:\d{2}|no)\s*/\s*100)?(\s*(?:pesos\s*)?only)?${NOT_WORD_AFTER}`,
      'giu'
    );
    while ((m = wordsRe.exec(text))) {
      const key = pickMoneyKey(candidates, text, m.index);
      const hasCents = Boolean(m[1]);
      const hasOnly = Boolean(m[2]) && !/pesos/i.test(m[2]);
      const mode = hasCents ? (hasOnly ? 'words' : 'wordscents') : 'wordsplain';
      const end = m.index + m[0].length - (m[2] && !hasOnly ? m[2].length : 0);
      add(m.index, end, key, [mode, ...caseMods(m[0], moneyWordsPlain(amount))]);
    }
  }

  // Dates
  for (const key of ['start_date', 'end_date']) {
    for (const { re, mods } of dateMatchers(key, values[key])) {
      let m;
      while ((m = re.exec(text))) {
        const fullMonth = MONTHS[values[key].month - 1];
        const abbreviated = mods[0] === 'long' && !m[0].toLowerCase().startsWith(fullMonth.toLowerCase());
        add(m.index, m.index + m[0].length, key, abbreviated ? ['short'] : mods);
      }
    }
  }

  // Lease length
  const months = Number(values.duration_months);
  if (months > 0) {
    if (months % 12 === 0) {
      const re = new RegExp(String.raw`${NOT_WORD_BEFORE}${months / 12}\s*-?\s*years?${NOT_WORD_AFTER}`, 'giu');
      let m;
      while ((m = re.exec(text))) add(m.index, m.index + m[0].length, 'duration', []);
    }
    const monthsRe = new RegExp(String.raw`(?<![\d.,])${months}(?=\s*\)?\s*-?\s*months?\b)`, 'gi');
    let m;
    while ((m = monthsRe.exec(text))) add(m.index, m.index + m[0].length, 'duration_months', []);
    const wordForm = numberToWords(months);
    const wordsRe = new RegExp(String.raw`${NOT_WORD_BEFORE}${wordForm.split(/[\s-]+/).join(String.raw`[\s-]+`)}(?=\s*\(?\s*\d*\s*\)?\s*-?\s*months?\b)`, 'giu');
    while ((m = wordsRe.exec(text))) {
      add(m.index, m.index + m[0].length, 'duration_months', ['numwords', ...caseMods(m[0], wordForm)]);
    }
  }

  // Rent due day: "5th day of each month", "on or before the 5th"
  const due = Number(values.rent_due_day);
  if (due) {
    const patterns = [
      new RegExp(String.raw`(?<![\d])0?${due}(?:st|nd|rd|th)(?=\s+(?:day\s+)?of\s+(?:each|every|the)\s+month)`, 'gi'),
      new RegExp(String.raw`(?<=\b(?:before|by|on|every)\s+the\s+)0?${due}(?:st|nd|rd|th)\b`, 'gi'),
    ];
    for (const re of patterns) {
      let m;
      while ((m = re.exec(text))) add(m.index, m.index + m[0].length, 'rent_due_day', ['ordinal']);
    }
  }

  // Resolve overlaps: longest match wins, then earliest.
  matches.sort((a, b) => (b.end - b.start) - (a.end - a.start) || a.start - b.start);
  const accepted = [];
  for (const m of matches) {
    if (accepted.every((a) => m.end <= a.start || m.start >= a.end)) accepted.push(m);
  }
  accepted.sort((a, b) => a.start - b.start);

  return accepted;
}

// ---------------------------------------------------------------------------
// Things that probably change per tenant but we couldn't match
// ---------------------------------------------------------------------------

export function findSuggestions(plain) {
  const patterns = [
    ['address', /(?:with\s+address(?:es)?\s+at|residing\s+at|residing\s+in|address(?:ed)?\s*:)\s*([^\n]{8,140}?)(?=,?\s+hereinafter|\n|$)/gi],
    ['amount', /(?:₱|PHP|Php|P)\s?\d[\d,]*(?:\.\d{1,2})?(?![\dA-Za-z])/g],
    ['date', new RegExp(String.raw`\b(?:\d{1,2}(?:st|nd|rd|th)?\s+(?:day\s+)?of\s+)?${MONTH_ANY}\s*\d{0,2}(?:st|nd|rd|th)?,?\s*\d{4}\b`, 'g')],
    ['date', /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g],
    ['blank', /_{4,}/g],
    ['id', /\b[A-Z]{1,3}\d{6,10}[A-Z]?\b/g],
  ];
  const seen = new Set();
  const out = [];
  for (const [kind, re] of patterns) {
    let m;
    while ((m = re.exec(plain))) {
      const text = (m[1] || m[0]).trim();
      if (!text || text.includes('\u0000') || seen.has(text)) continue;
      seen.add(text);
      out.push({ kind, text });
      if (out.length >= 25) return out;
    }
  }
  return out;
}

