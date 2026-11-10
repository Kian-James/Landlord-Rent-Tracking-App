# Contract PDF feature

One click on **Contract PDF** (next to *View Lease*, in lease history and in the All leases list) downloads
that lease's contract as a PDF. Nothing to fill in, no popup.

The contract **looks exactly like the PDF the landlord uploaded** (same fonts, bold/italic, bullets, tables,
lines, spacing, colours). Only the parts that change per tenant (names, dates, rent, addresses) are replaced.
No AI is used; everything runs on your server.

## Install

1. **Database** - Supabase > SQL Editor > run `db/migrations/002_contract_pdf_templates.sql`
   (adds `tenants.address`, `landlords.address` and the `contract_templates` table; safe to re-run).
2. **Server** - `npm install` (adds pdf-lib, @pdf-lib/fontkit, pdfjs-dist; removes pdfkit/pdf-parse). Needs Node 22.13+.
3. **Deploy** both. `vercel.json` bundles `assets/` (fonts + starter contract) with the function.

## How landlords use it

* **Addresses are required, so they're always in the contract:** *Tenant's address* is a required field on the
  Add and Edit tenant forms (at least 5 characters). The landlord's own address is required in
  *Settings > Profile*, and any landlord who doesn't have one yet is asked for it in a prompt that can't be skipped
  (it only appears once the database update has been run). The property address comes from the property, and the
  property description from the property's existing description field.
  Existing tenants without an address are asked for one the next time they're edited.
* **Download:** click *Contract PDF*. If a detail isn't on record yet, that spot prints as a blank line and a
  short note says which one, so it can be added for next time.
* **Their own contract:** *Settings > Contract template > Upload your contract (PDF)*. The app reads the contract
  and recognizes the changing parts by itself, from the contract's own wording, so it works even for a contract
  written for someone who isn't in the app:
  landlord and tenant (the name before "..., of legal age ... hereinafter the LESSOR / LESSEE", plus names under
  LESSOR / LESSEE in a signature block), their addresses ("with address at ..." / "residing at ..."), the property
  ("located at ..."), unit numbers, the lease length ("a period of 1 year", "twelve (12) months"), start and end
  dates ("commencing on X to Y"; day/month order is worked out from the document), monthly rent (digits and the
  same amount in words), advance, deposit and totals, and the rent due day. Every other place the same name,
  amount or date appears is tagged too. Optionally the landlord can pick the tenant it was written for, and that
  tenant's records are also checked. The review screen lists everything it recognized (with the text it found) next
  to the real PDF; select any words to tag something it missed, or click x to remove a wrong tag. Save it as the default.

## Fields

Landlord name/address, tenant name/address/phone/email, property name/address/description, unit, monthly rent,
advance, deposit, advance + deposit total, lease start/end date (several formats), lease length, rent due day,
and "blank line" (to write in by hand). Amounts can print in digits or words; names can print in CAPITALS.

## Limits worth knowing

* Uploads: PDF only, up to 4 MB (Vercel rejects larger request bodies), digital PDFs only (scans have no text),
  no passwords, horizontal text only (no diagonal watermarks), up to 30 pages.
* The text is redrawn in Liberation Sans / Serif / Mono, which have the same character widths as
  Arial / Times New Roman / Courier. Other fonts (Calibri, Cambria, ...) are matched to the closest of those, so
  line breaks can differ slightly from the original.
* If a value is much longer than the original (a very long address), the paragraph re-wraps and the text below
  moves down (up if shorter). On pages that have tables or rules, text below can't move, so the text is squeezed
  into the available space instead. Text that would run off the bottom of a page is squeezed rather than moved
  to a new page.
* Recognition needs a contract that has the details filled in (a sample for a real or made-up tenant). A blank form
  with only underscores for the names isn't recognized automatically; tag those spots by hand.
* Fields only work where the uploaded contract already has text for them. To add a new spot (for example the
  tenant's address in a contract that doesn't mention it), add it to the Word/Google Doc and upload it again.
* Conversions are rate limited (20 uploads per hour, 200 previews per hour per IP).

## The starter contract

Landlords who haven't uploaded their own get `assets/starter/contract.pdf`, a copy of the sample contract you
shared with the lessor/lessee names, dates, amounts and addresses turned into fields and the sample's personal ID
details turned into write-in blanks. It also adds "with address at (tenant's address)" after the tenant's name.
Things to check before offering it to other landlords:

* "P 15,000" (total paid on signing) is now `advance + deposit`, so it changes with each lease.
* The city (San Fernando) in the venue clause and the notary block is still your text.
* Terms such as the 3% penalty, 25% attorney's fees and 30-day notice are yours.

To change the starter: replace `assets/starter/contract.pdf`, adjust the hand edits in
`scripts/buildStarterTemplate.js` if needed, and run `node scripts/buildStarterTemplate.js`.
