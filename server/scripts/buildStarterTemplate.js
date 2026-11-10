// Rebuilds assets/starter/{model,slots}.json from assets/starter/contract.pdf.
//
// The starter contract is the look every landlord gets until they upload their
// own. Run this after replacing contract.pdf:   node scripts/buildStarterTemplate.js
//
// It tags the tenant-specific parts automatically (names, dates, rent, address)
// by matching a made-up lease against the PDF, then applies a few hand edits.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzePdf, paragraphText } from '../src/services/contractLayout.js';
import { buildValues } from '../src/services/contractFields.js';
import { autoSlots, paragraphsById } from '../src/services/contractTemplates.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'starter');
const pdf = fs.readFileSync(path.join(dir, 'contract.pdf'));
const model = await analyzePdf(pdf);

// The lease the sample PDF was written for.
const values = buildValues({
  landlord: {
    name: 'Khyle Christian James',
    address: '# 221 Mabini St., Davsan Subd., Sindalan, City of San. Fernando, Pampanga',
  },
  tenant: { full_name: 'Nathania M. Montañez', rent_due_day: 5 },
  unit: { name: '101' },
  property: {
    name: 'Bridgepointe',
    address: 'Block 83, Lot 20, Bridgepointe, Del Rosario, City of San. Fernando, Pampanga',
  },
  contract: {
    monthly_rent: 6500,
    advance: { months: 1 },
    deposit: { months: 1 },
    start_date: '2026-09-10T00:00:00Z',
    end_date: '2027-09-10T00:00:00Z',
    duration_months: 12,
  },
});

const { slots } = await autoSlots(model, values);
const paras = paragraphsById(model);

// Tag a snippet of text wherever it appears, unless it is already tagged.
function tag(snippet, token, { all = true } = {}) {
  let count = 0;
  let seen = 0;
  for (const [id, p] of paras) {
    const text = paragraphText(p);
    let from = 0;
    for (;;) {
      const s = text.indexOf(snippet, from);
      if (s < 0) break;
      const e = s + snippet.length;
      from = e;
      seen += 1;
      if (slots.some((x) => x.p === id && x.s < e && s < x.e)) continue; // already recognised automatically
      slots.push({ p: id, s, e, token });
      count += 1;
      if (!all) return count;
    }
  }
  if (!seen) console.warn(`  (not found: ${snippet})`);
  return count;
}

// Hand edits ---------------------------------------------------------------
tag('KHYLE CHRSTIAN G. JAMES', '{{lessor_name|upper}}'); // typo in the sample's signature line
tag('P7792836A', '{{blank|short}}'); // the sample's own ID details become write-in blanks
tag('JULY 4, 2018', '{{blank|short}}');
tag('DFA PAMPANGA', '{{blank|short}}');
tag('7th day of April, 2026', '{{blank|short}}'); // notarisation date
tag('seven (7)', '{{blank|short}}'); // page count
tag('P 15,000', 'P {{total_move_in|int}}'); // total paid on signing
tag('Filipino, hereinafter', 'Filipino, with address at {{lessee_address}}, hereinafter', { all: false }); // adds the tenant's address after "of legal age, Filipino,"

fs.writeFileSync(path.join(dir, 'model.json'), JSON.stringify(model));
fs.writeFileSync(path.join(dir, 'slots.json'), JSON.stringify(slots));
console.log(`Starter built: ${model.pages.length} pages, ${slots.length} tagged fields.`);
