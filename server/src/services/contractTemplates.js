// Loading a landlord's contract template (their uploaded PDF, or the starter),
// checking tagged fields, and describing the template for the review screen.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { supabase } from '../config/supabase.js';
import ApiError from '../utils/ApiError.js';
import { assertUuid, unwrap } from '../db/helper.js';
import { buildValues, FIELDS, makeToken, parseToken, slotProblem } from './contractFields.js';

// The PDF reading/drawing engine is large, so it is loaded only when a contract is
// actually used, not every time the server starts.
const engine = {
  layout: () => import('./contractLayout.js'),
  detect: () => import('./contractDetect.js'),
  infer: () => import('./contractInfer.js'),
  stream: () => import('./contractPdfStream.js'),
};

const STARTER_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'starter');
const LEASE_SELECT = '*, tenant:tenants!tenant_id(*), unit:units!unit_id(*), property:properties!property_id(*)';
const MAX_SLOTS = 600;

// ---------------------------------------------------------------------------
// Starter contract (shipped with the app)
// ---------------------------------------------------------------------------

let starterCache = null;
export function starterTemplate() {
  if (!starterCache) {
    starterCache = {
      pdfBytes: fs.readFileSync(path.join(STARTER_DIR, 'contract.pdf')),
      model: JSON.parse(fs.readFileSync(path.join(STARTER_DIR, 'model.json'), 'utf8')),
      slots: JSON.parse(fs.readFileSync(path.join(STARTER_DIR, 'slots.json'), 'utf8')),
      sourceFilename: 'Starter contract',
      isDefault: true,
      updatedAt: null,
    };
  }
  return starterCache;
}

// ---------------------------------------------------------------------------
// Saved templates
// ---------------------------------------------------------------------------

function missingTable(error) {
  return error?.code === '42P01' || error?.code === '42703' || /contract_templates|pdf_base64/.test(error?.message || '');
}

async function getRow(landlordId) {
  const { data, error } = await supabase
    .from('contract_templates')
    .select('pdf_base64, model, slots, source_filename, updated_at')
    .eq('landlord_id', landlordId)
    .maybeSingle();
  if (error) {
    if (missingTable(error)) {
      throw new ApiError(503, 'Contract templates are not set up yet. Run db/migrations/002_contract_pdf_templates.sql in Supabase.');
    }
    throw new Error(error.message);
  }
  return data;
}

// The landlord's own template if they saved one, otherwise the starter.
export async function getActiveTemplate(landlordId) {
  const row = await getRow(landlordId);
  if (!row?.pdf_base64 || !row?.model) return starterTemplate();
  return {
    pdfBytes: Buffer.from(row.pdf_base64, 'base64'),
    model: row.model,
    slots: row.slots || [],
    sourceFilename: row.source_filename || '',
    isDefault: false,
    updatedAt: row.updated_at,
  };
}

export async function saveTemplate(landlordId, { pdfBytes, model, slots, sourceFilename }) {
  const row = unwrap(
    await supabase
      .from('contract_templates')
      .upsert(
        {
          landlord_id: landlordId,
          pdf_base64: Buffer.from(pdfBytes).toString('base64'),
          model,
          slots,
          source_filename: sourceFilename || '',
        },
        { onConflict: 'landlord_id' }
      )
      .select('updated_at')
      .single()
  );
  return row.updated_at;
}

export async function deleteTemplate(landlordId) {
  unwrap(await supabase.from('contract_templates').delete().eq('landlord_id', landlordId));
}

// ---------------------------------------------------------------------------
// Analysing an upload (cached briefly: the editor asks for a preview after every edit)
// ---------------------------------------------------------------------------

const analysisCache = new Map();
const CACHE_MS = 15 * 60 * 1000;

export async function analyzeUpload(buffer) {
  const key = crypto.createHash('sha256').update(buffer).digest('hex');
  const hit = analysisCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.model;

  const { analyzePdf } = await engine.layout();
  const { textFreeCopy } = await engine.stream();
  const model = await analyzePdf(buffer);

  // Make sure removing the text really removes all of it (nothing hidden in sub-objects).
  const stripped = await textFreeCopy(buffer);
  const leftover = await analyzePdf(Buffer.from(stripped), { requireText: false });
  if (leftover.itemCount > 0) {
    throw new ApiError(422, 'This PDF stores its text in a way that cannot be edited safely. Export it again from Word or Google Docs.');
  }

  analysisCache.set(key, { at: Date.now(), model });
  for (const [k, v] of analysisCache) if (Date.now() - v.at > CACHE_MS || analysisCache.size > 8) analysisCache.delete(k);
  return model;
}

// ---------------------------------------------------------------------------
// Slots (the tagged parts): [{ p, s, e, token }]
// ---------------------------------------------------------------------------

export function paragraphsById(model) {
  const map = new Map();
  for (const page of model.pages) for (const p of page.paragraphs) map.set(p.id, p);
  return map;
}

// Check slots sent by the browser against the real paragraphs. Throws a friendly error.
export async function cleanSlots(model, raw) {
  const { paragraphText } = await engine.layout();
  if (!Array.isArray(raw)) throw new ApiError(400, 'The tagged fields are missing.');
  if (raw.length > MAX_SLOTS) throw new ApiError(400, 'Too many tagged fields.');
  const paras = paragraphsById(model);
  const lengths = new Map();
  const out = [];
  for (const item of raw) {
    const p = paras.get(String(item?.p));
    const s = Number(item?.s);
    const e = Number(item?.e);
    if (!p) throw new ApiError(400, 'A tagged field points to text that is no longer in the contract.');
    if (!lengths.has(p.id)) lengths.set(p.id, paragraphText(p).length);
    if (!Number.isInteger(s) || !Number.isInteger(e) || s < 0 || e <= s || e > lengths.get(p.id)) {
      throw new ApiError(400, 'A tagged field is outside its paragraph.');
    }
    const problem = slotProblem(item?.token);
    if (problem) throw new ApiError(400, problem);
    out.push({ p: p.id, s, e, token: String(item.token).trim() });
  }
  out.sort((a, b) => (a.p === b.p ? a.s - b.s : a.p.localeCompare(b.p, undefined, { numeric: true })));
  for (let i = 1; i < out.length; i += 1) {
    if (out[i].p === out[i - 1].p && out[i].s < out[i - 1].e) throw new ApiError(400, 'Two tagged fields overlap.');
  }
  return out;
}

// Recognise the changing parts of a contract and tag them.
//   1. If a lease is given, search for that tenant's exact name, rent, dates... (most reliable).
//   2. Always read the contract's own wording too ("..., of legal age... the LESSOR", "commencing on
//      X to Y", "monthly rent of..."), so a contract written for someone who isn't in the app still works.
//   3. Names in a signature block (above "LESSOR" / "LESSEE") belong to that person.
export async function autoSlots(model, knownValues = null) {
  const { paragraphText } = await engine.layout();
  const { detectMatches } = await engine.detect();
  const { inferValues, signatureRoles } = await engine.infer();

  const paras = [];
  model.pages.forEach((page, pageIndex) =>
    page.paragraphs.forEach((p) => paras.push({ id: p.id, page: pageIndex, p, text: paragraphText(p) }))
  );

  const slots = [];
  const counts = new Map();
  const examples = new Map();
  const overlaps = (id, s, e) => slots.some((x) => x.p === id && s < x.e && x.s < e);
  const add = (para, s, e, token, key) => {
    if (overlaps(para.id, s, e)) return;
    slots.push({ p: para.id, s, e, token });
    counts.set(key, (counts.get(key) || 0) + 1);
    if (!examples.has(key)) examples.set(key, para.text.slice(s, e));
  };

  // Gather what both sources found, then keep the longest matches first. That way a whole property
  // address beats a short property name that happens to sit inside it ("BRIDGEPOINTE"). On a tie
  // the tenant's own records win.
  const inferred = inferValues(paras.map((x) => x.text));
  const candidates = [];
  [knownValues, inferred].forEach((values, source) => {
    if (!values) return;
    for (const para of paras) {
      for (const m of detectMatches(para.text, values)) candidates.push({ para, ...m, source });
    }
  });
  candidates.sort((a, b) => (b.end - b.start) - (a.end - a.start) || a.source - b.source || a.start - b.start);
  for (const c of candidates) add(c.para, c.start, c.end, c.token, c.key);

  const signatureItems = paras.map((x) => ({
    id: x.id,
    page: x.page,
    text: x.text,
    cx: (x.p.minX0 + x.p.maxX1) / 2,
    top: x.p.lines[0].y,
    size: x.p.size,
  }));
  for (const { id, role, text } of signatureRoles(signatureItems)) {
    const para = paras.find((x) => x.id === id);
    const s = para.text.search(/\S/);
    const e = para.text.trimEnd().length;
    if (s < 0 || overlaps(id, s, e) || slots.some((x) => x.p === id)) continue;
    const key = role === 'lessor' ? 'lessor_name' : 'lessee_name';
    add(para, s, e, makeToken(key, text === text.toUpperCase() ? ['upper'] : []), key);
  }

  const found = [...counts].map(([key, count]) => ({ key, label: FIELDS[key].label, count, example: examples.get(key) || '' }));
  return { slots, found };
}

const firstTokenKey = (token) => {
  const m = String(token).match(/\{\{[^}]*\}\}/);
  return (m && parseToken(m[0])?.key) || '';
};

// What the review screen needs: the text of each paragraph and which parts are tagged.
export async function describeTemplate(model, slots) {
  const { paragraphText } = await engine.layout();
  const { findSuggestions } = await engine.detect();
  const byPara = new Map();
  for (const s of slots) {
    if (!byPara.has(s.p)) byPara.set(s.p, []);
    byPara.get(s.p).push(s);
  }
  const untagged = [];
  const pages = model.pages.map((page, i) => ({
    number: i + 1,
    paragraphs: page.paragraphs
      .map((p) => {
        const text = paragraphText(p);
        const mine = (byPara.get(p.id) || [])
          .map((s) => ({ s: s.s, e: s.e, token: s.token, key: firstTokenKey(s.token) }))
          .sort((a, b) => a.s - b.s);
        let cursor = 0;
        for (const s of mine) {
          untagged.push(text.slice(cursor, s.s));
          cursor = s.e;
        }
        untagged.push(text.slice(cursor));
        return { id: p.id, text, slots: mine };
      })
      .filter((p) => p.text.trim().length > 0),
  }));
  return { pages, suggestions: findSuggestions(untagged.join('\n')) };
}

// ---------------------------------------------------------------------------
// Leases
// ---------------------------------------------------------------------------

export async function loadLease(landlordId, contractId) {
  assertUuid(contractId, 'contract id');
  const row = unwrap(
    await supabase.from('contracts').select(LEASE_SELECT).eq('id', contractId).eq('landlord_id', landlordId).maybeSingle()
  );
  if (!row) throw new ApiError(404, 'Not found.');
  const { tenant, unit, property, ...contract } = row;
  return { contract, tenant, unit, property };
}

export const valuesForLease = (landlord, lease) => buildValues({ landlord, ...lease });

// The landlord's most recent leases (used to work out which tenant an uploaded contract was written for).
export async function recentLeases(landlordId, limit = 80) {
  const rows = unwrap(
    await supabase.from('contracts').select(LEASE_SELECT).eq('landlord_id', landlordId).order('start_date', { ascending: false }).limit(limit)
  );
  return rows.map(({ tenant, unit, property, ...contract }) => ({ contract, tenant, unit, property }));
}

const squash = (s) => String(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

// "Not sure which tenant it was written for": check every lease and use the one whose details
// appear in the contract. The tenant's name has to be in it, so a stray matching amount alone
// never picks the wrong person. Returns { lease, values } or null.
export async function bestMatchingLease(model, landlord, leases) {
  if (!leases.length) return null;
  const { paragraphText } = await engine.layout();
  const { detectMatches } = await engine.detect();
  const texts = model.pages.flatMap((pg) => pg.paragraphs.map((p) => paragraphText(p)));
  const whole = ` ${squash(texts.join(' '))} `;

  let best = null;
  for (const lease of leases) {
    const values = buildValues({ landlord, ...lease });
    const name = squash(values.lessee_name || '');
    if (name.split(' ').length < 2 || !whole.includes(` ${name} `)) continue;
    const keys = new Set();
    for (const text of texts) for (const m of detectMatches(text, values)) keys.add(m.key);
    const score = keys.size + (keys.has('lessee_name') ? 5 : 0);
    const recency = Date.parse(lease.contract.start_date) || 0;
    if (!best || score > best.score || (score === best.score && recency > best.recency)) best = { lease, values, score, recency };
  }
  return best && best.score >= 6 ? best : null;
}

export async function latestLeaseFor(landlordId) {
  const row = unwrap(
    await supabase
      .from('contracts')
      .select('id')
      .eq('landlord_id', landlordId)
      .order('status', { ascending: true })
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle()
  );
  return row ? loadLease(landlordId, row.id) : null;
}
