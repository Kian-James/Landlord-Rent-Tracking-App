import asyncHandler from '../utils/asyncHandler.js';
import { getActiveTemplate, loadLease, valuesForLease } from '../services/contractTemplates.js';

export const pdfFilename = (lesseeName, contract) => {
  const who = String(lesseeName || 'Tenant').normalize('NFD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') || 'Tenant';
  const day = String(contract.start_date || '').slice(0, 10);
  return `Lease-Contract-${who}${day ? `-${day}` : ''}.pdf`;
};

// Sends the PDF. `missing` lists details the lease doesn't have yet (they print as blank lines),
// so the app can tell the landlord what to fill in. Header values are URL-encoded.
export function sendPdf(res, buffer, filename, { missing = [], warnings = [] } = {}) {
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Length': buffer.length,
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-store',
    'X-Missing-Fields': encodeURIComponent(missing.join('|')),
    'X-Contract-Warnings': encodeURIComponent(warnings.join('|')),
  });
  res.end(buffer);
}

// One click: the contract is built from the saved template and the lease's own details.
const download = asyncHandler(async (req, res) => {
  const lease = await loadLease(req.landlordId, req.params.id);
  const template = await getActiveTemplate(req.landlordId);
  const values = valuesForLease(req.landlord, lease);
  const { stampContract } = await import('../services/contractStamp.js'); // loaded on first use
  const { bytes, missing, warnings } = await stampContract({
    pdfBytes: template.pdfBytes,
    model: template.model,
    slots: template.slots,
    values,
    title: `Contract of Lease - ${lease.tenant?.full_name || ''}`.trim(),
    author: req.landlord?.name || '',
  });
  sendPdf(res, bytes, pdfFilename(lease.tenant?.full_name, lease.contract), { missing, warnings });
});

export { download };
