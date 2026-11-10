import multer from 'multer';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { recordAudit } from '../services/audit.js';
import { FIELDS, SAMPLE_VALUES, insertOptions } from '../services/contractFields.js';
import {
  analyzeUpload, autoSlots, bestMatchingLease, cleanSlots, deleteTemplate, describeTemplate, getActiveTemplate,
  latestLeaseFor, loadLease, recentLeases, saveTemplate, valuesForLease,
} from '../services/contractTemplates.js';
import { pdfFilename, sendPdf } from './contractPdfController.js';

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // Vercel functions reject bodies over ~4.5 MB

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });

// Accepts an optional PDF in the "file" field plus ordinary form fields.
export const uploadPdf = (req, res, next) =>
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return next(new ApiError(413, 'That PDF is too large. The limit is 4 MB.'));
    return next(new ApiError(400, 'The upload failed. Please try again.'));
  });

const status = (template) => ({
  isDefault: template.isDefault,
  sourceFilename: template.isDefault ? '' : template.sourceFilename,
  updatedAt: template.updatedAt,
  pageCount: template.model.pages.length,
});

function parseSlots(body) {
  try {
    return JSON.parse(String(body?.slots ?? '[]'));
  } catch {
    throw new ApiError(400, 'The tagged fields could not be read.');
  }
}

// The PDF to work on: a freshly uploaded one, or the landlord's current template.
async function workingTemplate(req) {
  if (req.file) {
    const model = await analyzeUpload(req.file.buffer);
    return { pdfBytes: req.file.buffer, model, sourceFilename: String(req.file.originalname || '').slice(0, 200) };
  }
  const current = await getActiveTemplate(req.landlordId);
  return {
    pdfBytes: current.pdfBytes,
    model: current.model,
    slots: current.slots,
    sourceFilename: current.isDefault ? 'Starter contract' : current.sourceFilename,
  };
}

const get = asyncHandler(async (req, res) => {
  const template = await getActiveTemplate(req.landlordId);
  res.json({
    template: status(template),
    insertOptions: insertOptions(),
    fieldLabels: Object.fromEntries(Object.entries(FIELDS).map(([k, v]) => [k, v.label])),
  });
});

// The current template as paragraphs with their tagged parts (for "Edit template").
const review = asyncHandler(async (req, res) => {
  const template = await getActiveTemplate(req.landlordId);
  res.json({ ...(await describeTemplate(template.model, template.slots)), slots: template.slots, ...status(template) });
});

// Upload a PDF -> paragraphs + automatically tagged fields. Nothing is saved yet.
const extract = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'Choose a PDF to upload.');
  const model = await analyzeUpload(req.file.buffer);
  // Fields are recognised from the contract's own wording; if the landlord also says which
  // tenant it was written for, that tenant's exact details are searched for too.
  let known = null;
  let matchedAgainst = null;
  let matchedContractId = null;
  if (req.body?.contractId) {
    const lease = await loadLease(req.landlordId, String(req.body.contractId));
    known = valuesForLease(req.landlord, lease);
    matchedAgainst = known.lessee_name;
    matchedContractId = lease.contract.id;
  } else {
    // "Not sure": find the tenant it was written for by looking for each tenant's details in it
    const best = await bestMatchingLease(model, req.landlord, await recentLeases(req.landlordId));
    if (best) {
      known = best.values;
      matchedAgainst = best.values.lessee_name;
      matchedContractId = best.lease.contract.id;
    }
  }
  const { slots, found } = await autoSlots(model, known);
  await recordAudit('contract_template_converted', { landlord: req.landlordId, metadata: { pages: model.pages.length }, ip: req.ip });
  res.json({
    ...(await describeTemplate(model, slots)),
    slots,
    found,
    matchedAgainst,
    matchedContractId,
    pageCount: model.pages.length,
    sourceFilename: String(req.file.originalname || '').slice(0, 200),
  });
});

// Fill a (possibly unsaved) template with a real lease so the landlord can see the result.
// Tagged fields: the ones sent by the editor, or (for a plain "sample PDF") the saved ones.
const slotsFor = async (base, req) => (req.body?.slots !== undefined ? cleanSlots(base.model, parseSlots(req.body)) : base.slots || []);

const previewPdf = asyncHandler(async (req, res) => {
  const base = await workingTemplate(req);
  const slots = await slotsFor(base, req);
  const lease = req.body?.contractId ? await loadLease(req.landlordId, String(req.body.contractId)) : await latestLeaseFor(req.landlordId);
  const values = lease ? valuesForLease(req.landlord, lease) : SAMPLE_VALUES;
  const { stampContract } = await import('../services/contractStamp.js'); // loaded on first use
  const { bytes, missing, warnings } = await stampContract({
    pdfBytes: base.pdfBytes, model: base.model, slots, values, title: 'Contract preview', author: req.landlord?.name || '',
  });
  sendPdf(res, bytes, lease ? pdfFilename(lease.tenant?.full_name, lease.contract) : 'Contract-preview.pdf', { missing, warnings });
});

const save = asyncHandler(async (req, res) => {
  const base = await workingTemplate(req);
  const slots = await slotsFor(base, req);
  const updatedAt = await saveTemplate(req.landlordId, { ...base, slots });
  await recordAudit('contract_template_saved', { landlord: req.landlordId, metadata: { fields: slots.length }, ip: req.ip });
  res.json({
    template: { isDefault: false, sourceFilename: base.sourceFilename, updatedAt, pageCount: base.model.pages.length },
  });
});

const reset = asyncHandler(async (req, res) => {
  await deleteTemplate(req.landlordId);
  const template = await getActiveTemplate(req.landlordId);
  res.json({ template: status(template) });
});

export { get, review, extract, previewPdf, save, reset };
