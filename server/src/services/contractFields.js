// Contract fields.
//
// A landlord's uploaded contract keeps its look; the parts that change per
// tenant are "tagged" with a field, written as a token:
//
//   {{lessee_name|upper}}            -> NATHANIA M. MONTAÑEZ
//   {{monthly_rent}}                 -> 6,500.00
//   {{monthly_rent|words}}           -> Six Thousand Five Hundred & 00/100 Only
//   {{start_date|dmy_of}}            -> 10th of September 2026
//
// This file knows what the fields are, how to turn a lease into values, and how
// to format them. No AI: it's all plain formatting.

const TIME_ZONE = process.env.CONTRACT_TIMEZONE || 'Asia/Manila';

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ---------------------------------------------------------------------------
// Number / date formatting helpers
// ---------------------------------------------------------------------------

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven',
  'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const SCALES = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];

function belowThousand(n) {
  const parts = [];
  if (n >= 100) {
    parts.push(ONES[Math.floor(n / 100)], 'Hundred');
    n %= 100;
  }
  if (n >= 20) {
    parts.push(n % 10 ? `${TENS[Math.floor(n / 10)]}-${ONES[n % 10]}` : TENS[Math.floor(n / 10)]);
  } else if (n > 0) {
    parts.push(ONES[n]);
  }
  return parts.join(' ');
}

export function numberToWords(value) {
  let n = Math.floor(Math.abs(Number(value) || 0));
  if (n === 0) return 'Zero';
  const chunks = [];
  let scale = 0;
  while (n > 0 && scale < SCALES.length) {
    const part = n % 1000;
    if (part) chunks.unshift(`${belowThousand(part)}${SCALES[scale] ? ` ${SCALES[scale]}` : ''}`);
    n = Math.floor(n / 1000);
    scale += 1;
  }
  return chunks.join(' ');
}

const centavosOf = (amount) => Math.round((Math.abs(Number(amount) || 0) % 1) * 100);

export const moneyWordsPlain = (amount) => numberToWords(amount);
export const moneyWordsCents = (amount) =>
  `${numberToWords(amount)} & ${String(centavosOf(amount)).padStart(2, '0')}/100`;
export const moneyWordsFull = (amount) => `${moneyWordsCents(amount)} Only`;

export function ordinal(n) {
  const v = Number(n);
  const mod100 = v % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${v}th`;
  return `${v}${{ 1: 'st', 2: 'nd', 3: 'rd' }[v % 10] || 'th'}`;
}

export function formatMoney(amount, { decimals = 2 } = {}) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number(amount) || 0);
}

// Calendar parts of a stored timestamp, read in the contract time zone so a
// lease that starts on Sept 10 never prints as Sept 9.
export function dateParts(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE, year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(d);
  const pick = (type) => Number(parts.find((p) => p.type === type).value);
  return { year: pick('year'), month: pick('month'), day: pick('day') };
}

const DATE_FORMATS = {
  long: (p) => `${MONTHS[p.month - 1]} ${p.day}, ${p.year}`,
  short: (p) => `${MONTHS[p.month - 1].slice(0, 3)} ${p.day}, ${p.year}`,
  dmy_of: (p) => `${ordinal(p.day)} of ${MONTHS[p.month - 1]} ${p.year}`,
  dmy_day: (p) => `${ordinal(p.day)} day of ${MONTHS[p.month - 1]}, ${p.year}`,
  dmy: (p) => `${p.day} ${MONTHS[p.month - 1]} ${p.year}`,
  slash: (p) => `${String(p.month).padStart(2, '0')}/${String(p.day).padStart(2, '0')}/${p.year}`,
  slash_dmy: (p) => `${String(p.day).padStart(2, '0')}/${String(p.month).padStart(2, '0')}/${p.year}`,
  dayonly: (p) => ordinal(p.day),
  monthyear: (p) => `${MONTHS[p.month - 1]} ${p.year}`,
};
export const DATE_FORMAT_MODS = Object.keys(DATE_FORMATS);

export function durationText(months) {
  const m = Number(months) || 0;
  if (m > 0 && m % 12 === 0) {
    const years = m / 12;
    return `${years} ${years === 1 ? 'year' : 'years'}`;
  }
  return `${m} ${m === 1 ? 'month' : 'months'}`;
}

// ---------------------------------------------------------------------------
// Field catalog
// ---------------------------------------------------------------------------

// kind: text | money | date | number | duration
export const FIELDS = {
  lessor_name: { label: 'Landlord name', group: 'People', kind: 'text' },
  lessor_address: { label: 'Landlord address', group: 'People', kind: 'text' },
  lessee_name: { label: 'Tenant name', group: 'People', kind: 'text' },
  lessee_address: { label: 'Tenant address', group: 'People', kind: 'text' },
  lessee_phone: { label: 'Tenant phone', group: 'People', kind: 'text' },
  lessee_email: { label: 'Tenant email', group: 'People', kind: 'text' },
  property_name: { label: 'Property name', group: 'Property', kind: 'text' },
  property_address: { label: 'Property address', group: 'Property', kind: 'text' },
  property_description: { label: 'Property description', group: 'Property', kind: 'text' },
  unit_name: { label: 'Unit name / number', group: 'Property', kind: 'text' },
  monthly_rent: { label: 'Monthly rent', group: 'Money', kind: 'money' },
  advance_amount: { label: 'Advance rent', group: 'Money', kind: 'money' },
  deposit_amount: { label: 'Security deposit', group: 'Money', kind: 'money' },
  total_move_in: { label: 'Advance + deposit total', group: 'Money', kind: 'money' },
  start_date: { label: 'Lease start date', group: 'Dates', kind: 'date' },
  end_date: { label: 'Lease end date', group: 'Dates', kind: 'date' },
  duration: { label: 'Lease length (e.g. "1 year")', group: 'Dates', kind: 'duration' },
  duration_months: { label: 'Lease length in months (number)', group: 'Dates', kind: 'number' },
  rent_due_day: { label: 'Rent due day of month', group: 'Dates', kind: 'number' },
  blank: { label: 'Blank line (to write in by hand)', group: 'Other', kind: 'blank' },
};

const MONEY_MODS = ['int', 'words', 'wordscents', 'wordsplain'];
const NUMBER_MODS = ['ordinal', 'numwords'];
const CASE_MODS = ['upper', 'lower'];
const ALL_MODS = new Set([...MONEY_MODS, ...NUMBER_MODS, ...CASE_MODS, ...DATE_FORMAT_MODS, 'short']);

export const SAMPLE_VALUES = {
  lessor_name: 'Juan Dela Cruz',
  lessor_address: '12 Rizal St., San Fernando, Pampanga',
  lessee_name: 'Maria Santos',
  lessee_address: '45 Mabini St., Angeles City, Pampanga',
  lessee_phone: '0917 123 4567',
  lessee_email: 'maria@example.com',
  property_name: 'Sunrise Residences',
  property_address: 'Block 1, Lot 2, Sunrise Subd., San Fernando, Pampanga',
  property_description: 'A two-bedroom house with 1 toilet and bath',
  unit_name: 'Unit 101',
  monthly_rent: 6500,
  advance_amount: 6500,
  deposit_amount: 6500,
  total_move_in: 13000,
  start_date: { year: 2026, month: 9, day: 10 },
  end_date: { year: 2027, month: 9, day: 10 },
  duration_months: 12,
  rent_due_day: 5,
};

// ---------------------------------------------------------------------------
// Building the values for one lease
// ---------------------------------------------------------------------------

export function fundAmount(fund, monthlyRent) {
  if (!fund) return 0;
  if (fund.amountOverride !== null && fund.amountOverride !== undefined) return Number(fund.amountOverride);
  return (Number(fund.months) || 0) * (Number(monthlyRent) || 0);
}

// `rows` are raw database rows (snake_case) for one lease.
export function buildValues({ landlord, tenant, unit, property, contract }) {
  const advance = fundAmount(contract.advance, contract.monthly_rent);
  const deposit = fundAmount(contract.deposit, contract.monthly_rent);
  return {
    lessor_name: landlord?.name || '',
    lessor_address: landlord?.address || '',
    lessee_name: tenant?.full_name || '',
    lessee_address: tenant?.address || '',
    lessee_phone: tenant?.phone || '',
    lessee_email: tenant?.email || '',
    property_name: property?.name || '',
    property_address: property?.address || '',
    property_description: property?.description || '',
    unit_name: unit?.name || '',
    monthly_rent: Number(contract.monthly_rent) || 0,
    advance_amount: advance,
    deposit_amount: deposit,
    total_move_in: advance + deposit,
    start_date: dateParts(contract.start_date),
    end_date: dateParts(contract.end_date),
    duration_months: Number(contract.duration_months) || 0,
    rent_due_day: Number(tenant?.rent_due_day) || null,
  };
}

export function formatValue(key, values, mods) {
  const spec = FIELDS[key];
  const raw = key === 'duration' ? values.duration_months : values[key];
  if (raw === undefined || raw === null || raw === '') return null;

  let out;
  switch (spec.kind) {
    case 'money': {
      if (mods.includes('words')) out = moneyWordsFull(raw);
      else if (mods.includes('wordscents')) out = moneyWordsCents(raw);
      else if (mods.includes('wordsplain')) out = moneyWordsPlain(raw);
      else out = formatMoney(raw, { decimals: mods.includes('int') ? 0 : 2 });
      break;
    }
    case 'date': {
      const fmt = mods.find((m) => DATE_FORMAT_MODS.includes(m)) || 'long';
      out = DATE_FORMATS[fmt](raw);
      break;
    }
    case 'duration':
      out = durationText(raw);
      break;
    case 'number':
      if (mods.includes('ordinal')) out = ordinal(raw);
      else if (mods.includes('numwords')) out = numberToWords(raw);
      else out = String(raw);
      break;
    default:
      out = String(raw);
  }
  if (mods.includes('upper')) out = out.toUpperCase();
  else if (mods.includes('lower')) out = out.toLowerCase();
  return out;
}

// ---------------------------------------------------------------------------
// Tokens: a tagged piece of the contract is stored as a token string such as
// "{{lessee_name|upper}}". These helpers turn a token into the text to print.
// ---------------------------------------------------------------------------

const TOKEN_RE = /^\{\{\s*([a-z_]+)\s*((?:\|\s*[a-z_]+\s*)*)\}\}$/i;

export const BLANK = '____________________';

export function parseToken(token) {
  const m = TOKEN_RE.exec(String(token).trim());
  if (!m) return null;
  return {
    key: m[1].toLowerCase(),
    mods: (m[2] || '').split('|').map((x) => x.trim().toLowerCase()).filter(Boolean),
  };
}

export const makeToken = (key, mods = []) => `{{${[key, ...mods].join('|')}}}`;

// Why a token can't be used, or null when it's fine.
export function tokenProblem(token) {
  const parsed = parseToken(token);
  if (!parsed) return 'That is not a valid field.';
  if (!FIELDS[parsed.key]) return `Unknown field "${parsed.key}".`;
  const bad = parsed.mods.find((m) => !ALL_MODS.has(m));
  return bad ? `Unknown format "${bad}".` : null;
}

// -> { text, missing, label }. Missing values print as a blank line to write on.
export function formatToken(token, values) {
  const parsed = parseToken(token);
  if (!parsed || !FIELDS[parsed.key]) return { text: BLANK, missing: true, label: 'Unknown field' };
  const spec = FIELDS[parsed.key];
  if (spec.kind === 'blank') return { text: parsed.mods.includes('short') ? BLANK.slice(0, 10) : BLANK, missing: false, label: spec.label };
  const text = formatValue(parsed.key, values, parsed.mods);
  return text === null || text === '' ? { text: BLANK, missing: true, label: spec.label } : { text, missing: false, label: spec.label };
}

// A tagged piece of the contract is stored as text that may mix plain words and
// {{fields}}, e.g. "{{start_date|dmy_of}}" or "Filipino, with address at {{lessee_address}},".
const INLINE_RE = /\{\{\s*([a-z_]+)\s*((?:\|\s*[a-z_]+\s*)*)\}\}/gi;

export function formatSlotText(text, values) {
  const missing = [];
  const out = String(text).replace(INLINE_RE, (m) => {
    const r = formatToken(m, values);
    if (r.missing) missing.push(r.label);
    return r.text;
  });
  return { text: out, missing };
}

// Why this slot text can't be used, or null when it's fine.
export function slotProblem(text) {
  if (typeof text !== 'string' || !text.trim()) return 'A field is empty.';
  if (text.length > 400) return 'A field is too long.';
  const tokens = text.match(INLINE_RE) || [];
  if (!tokens.length) return 'A field must contain at least one {{field}}.';
  for (const t of tokens) {
    const problem = tokenProblem(t);
    if (problem) return problem;
  }
  if (/\{\{|\}\}/.test(text.replace(INLINE_RE, ''))) return 'There is a stray "{{" or "}}".';
  return null;
}

// ---------------------------------------------------------------------------
// What the editor offers in its "Insert field" menu
// ---------------------------------------------------------------------------

const VARIANTS = {
  text: [[[], null]],
  money: [
    [[], 'with cents'],
    [['int'], 'no cents'],
    [['words'], 'in words'],
  ],
  date: [
    [['long'], null],
    [['dmy_of'], null],
    [['dmy_day'], null],
    [['slash'], null],
  ],
  duration: [[[], null]],
  number: [[[], null]],
};

export function insertOptions() {
  const options = [];
  for (const [key, spec] of Object.entries(FIELDS)) {
    if (spec.kind === 'blank') {
      options.push({ token: makeToken(key), group: spec.group, label: spec.label, example: BLANK.slice(0, 10) });
      continue;
    }
    let variants = VARIANTS[spec.kind] || [[[], null]];
    if (key === 'rent_due_day') variants = [[[], null], [['ordinal'], 'as 5th']];
    for (const [mods, hint] of variants) {
      const token = makeToken(key, mods);
      const example = formatToken(token, SAMPLE_VALUES).text;
      options.push({
        token,
        group: spec.group,
        label: `${spec.label}${hint ? ` (${hint})` : ''}`,
        example,
      });
    }
    if (spec.kind === 'text' && key.endsWith('_name')) {
      const token = makeToken(key, ['upper']);
      options.push({ token, group: spec.group, label: `${spec.label} (CAPITALS)`, example: formatToken(token, SAMPLE_VALUES).text });
    }
  }
  return options;
}
