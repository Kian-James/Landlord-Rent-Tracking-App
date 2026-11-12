import React, { useEffect, useState } from 'react';
import client from '../api/client.js';
import { Section, btnPrimary, btnSecondary } from './SettingsParts.jsx';
import Modal from './Modal.jsx';
import ContractTemplateEditor from './ContractTemplateEditor.jsx';
import { Skeleton } from './Skeleton.jsx';
import { apiErrorMessage, downloadPdf } from '../lib/contractFiles.js';
import { fmtLeaseDate } from '../lib/leaseStatus.js';

const MAX_BYTES = 4 * 1024 * 1024;

// Settings > Contract template. Landlords upload their own contract (a PDF).
// It keeps its exact look; they just mark which words change per tenant, once.
// Every "Contract PDF" download after that uses it. Until then there's a starter.
export default function ContractTemplateCard() {
  const [state, setState] = useState({ loading: true, error: '', template: null, insertOptions: [] });
  const [contracts, setContracts] = useState([]);
  const [showUpload, setShowUpload] = useState(false);
  const [editor, setEditor] = useState(null);
  const [contractId, setContractId] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let ignore = false;
    Promise.all([client.get('/contract-template'), client.get('/contracts')])
      .then(([tpl, list]) => {
        if (ignore) return;
        setState({ loading: false, error: '', template: tpl.data.template, insertOptions: tpl.data.insertOptions });
        setContracts(list.data.contracts);
        const first = list.data.contracts.find((c) => c.status === 'active') || list.data.contracts[0];
        if (first) setContractId(first._id);
      })
      .catch(async (err) => {
        const msg = await apiErrorMessage(err, 'Could not load the contract template.');
        if (!ignore) setState((s) => ({ ...s, loading: false, error: msg }));
      });
    return () => {
      ignore = true;
    };
  }, []);

  const { template } = state;

  const pickFile = (e) => {
    const f = e.target.files?.[0] || null;
    setError('');
    if (f && f.size > MAX_BYTES) {
      setError('That file is over 4 MB. Try exporting a smaller PDF.');
      setFile(null);
      return;
    }
    setFile(f);
  };

  const convert = async () => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      if (contractId) form.append('contractId', contractId);
      const { data } = await client.post('/contract-template/extract', form);
      setShowUpload(false);
      setEditor({
        review: { pages: data.pages, suggestions: data.suggestions, slots: data.slots },
        file,
        sourceFilename: data.sourceFilename,
        found: data.found,
        matchedAgainst: data.matchedAgainst,
        // preview with the tenant it was matched to, so the preview shows that tenant's real details
        initialContractId: data.matchedContractId || contractId,
        isNewUpload: true,
      });
      setFile(null);
    } catch (err) {
      setError(await apiErrorMessage(err, 'Could not read that PDF.'));
    } finally {
      setBusy(false);
    }
  };

  const edit = async () => {
    setBusy(true);
    setError('');
    try {
      const { data } = await client.get('/contract-template/review');
      setEditor({
        review: { pages: data.pages, suggestions: data.suggestions, slots: data.slots },
        file: null,
        sourceFilename: data.sourceFilename,
        found: [],
        matchedAgainst: null,
        initialContractId: contractId,
        isNewUpload: false,
      });
    } catch (err) {
      setError(await apiErrorMessage(err, 'Could not open the template.'));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!window.confirm('Go back to the starter contract? Your uploaded contract will be removed.')) return;
    setError('');
    try {
      const { data } = await client.delete('/contract-template');
      setState((s) => ({ ...s, template: data.template }));
      setMessage('Back to the starter contract.');
    } catch (err) {
      setError(await apiErrorMessage(err, 'Could not reset the template.'));
    }
  };

  const sample = async () => {
    setBusy(true);
    setError('');
    try {
      await downloadPdf({
        url: '/contract-template/preview-pdf',
        method: 'post',
        data: { contractId: contractId || undefined },
        fallbackName: 'Contract-sample.pdf',
      });
    } catch (err) {
      setError(await apiErrorMessage(err, 'Could not create the sample PDF.'));
    } finally {
      setBusy(false);
    }
  };

  const btn = btnSecondary;

  return (
    <>
      <Section
        id="contract"
        title="Contract template"
        description="Used for every tenant’s “Contract PDF”. Upload your own contract and it keeps its exact look — only names, dates, amounts and addresses are filled in."
      >
        <div className="px-4 py-4 sm:px-6">

        {state.loading && <Skeleton className="mt-3 h-10 w-full rounded-lg" />}
        {state.error && <p className="mt-3 text-sm text-status-overdue">{state.error}</p>}

        {template && (
          <>
            <p className="rounded-xl bg-canvas px-4 py-3 text-sm">
              {template.isDefault ? (
                <>Using the <span className="font-medium">starter contract</span>.</>
              ) : (
                <>
                  Using <span className="font-medium">your contract</span>
                  {template.sourceFilename ? <> ({template.sourceFilename})</> : null}
                  {template.updatedAt ? <> &middot; saved {fmtLeaseDate(template.updatedAt)}</> : null}.
                </>
              )}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setShowUpload(true);
                }}
                className={btnPrimary}
              >
                Upload your contract (PDF)
              </button>
              <button type="button" onClick={edit} disabled={busy} className={btn}>
                Edit fields
              </button>
              <button type="button" onClick={sample} disabled={busy} className={btn}>
                Download sample PDF
              </button>
              {!template.isDefault && (
                <button type="button" onClick={reset} className={btn}>
                  Use starter contract
                </button>
              )}
            </div>
          </>
        )}
        {message && <p className="mt-2 text-xs text-brand">{message}</p>}
        {error && !showUpload && <p className="mt-2 text-sm text-status-overdue">{error}</p>}
              </div>
      </Section>

      <Modal open={showUpload} onClose={() => !busy && setShowUpload(false)} title="Upload your contract" size="lg">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-ink/70" htmlFor="tpl-lease">
              Which tenant was this contract written for? <span className="font-normal text-ink/40">(optional)</span>
            </label>
            <select
              id="tpl-lease"
              value={contractId}
              onChange={(e) => setContractId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            >
              <option value="">Not sure &mdash; find it automatically</option>
              {contracts.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.tenant?.fullName || 'Tenant'} &middot; {c.unit?.name || ''} &middot; {fmtLeaseDate(c.startDate)}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-ink/50">
              We read your contract and recognize the names, addresses, rent, dates and lease length by themselves. If it was written for one of your tenants we&rsquo;ll find them and double-check against their records; you can also pick them yourself. You review everything next.
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-ink/70" htmlFor="tpl-file">
              Contract PDF
            </label>
            <input
              id="tpl-file"
              type="file"
              accept="application/pdf,.pdf"
              onChange={pickFile}
              className="mt-1 block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-line file:bg-surface file:px-3 file:py-1.5 file:text-sm hover:file:bg-canvas"
            />
            <p className="mt-1 text-xs text-ink/50">
              PDF only, up to 4 MB. It must be a digital PDF (exported from Word or Google Docs), not a scan or photo.
            </p>
          </div>

          {error && <p className="text-sm text-status-overdue">{error}</p>}

          <div className="flex justify-end gap-2">
            <button type="button" disabled={busy} onClick={() => setShowUpload(false)} className={btn}>
              Cancel
            </button>
            <button
              type="button"
              disabled={!file || busy}
              onClick={convert}
              className="rounded-btn bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {busy ? 'Reading your contract\u2026' : 'Continue'}
            </button>
          </div>
        </div>
      </Modal>

      {editor && (
        <ContractTemplateEditor
          {...editor}
          insertOptions={state.insertOptions}
          contracts={contracts}
          onClose={() => setEditor(null)}
          onSaved={(saved) => {
            setState((s) => ({ ...s, template: saved }));
            setEditor(null);
            setMessage('Saved. Contract PDF downloads will now use this contract.');
          }}
        />
      )}
    </>
  );
}
