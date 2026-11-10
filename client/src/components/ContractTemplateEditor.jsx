import React, { useEffect, useMemo, useRef, useState } from 'react';
import client from '../api/client.js';
import { apiErrorMessage } from '../lib/contractFiles.js';
import { fmtLeaseDate } from '../lib/leaseStatus.js';

// Split a paragraph's text into plain / tagged / currently-selected pieces.
function pieces(text, slots, sel) {
  const marks = [...slots.map((s) => ({ ...s, kind: 'slot' }))];
  if (sel) marks.push({ s: sel.s, e: sel.e, kind: 'sel' });
  marks.sort((a, b) => a.s - b.s);
  const out = [];
  let cursor = 0;
  for (const m of marks) {
    if (m.s > cursor) out.push({ s: cursor, e: m.s, kind: 'text' });
    out.push(m);
    cursor = Math.max(cursor, m.e);
  }
  if (cursor < text.length) out.push({ s: cursor, e: text.length, kind: 'text' });
  return out;
}

// Turn a DOM selection point into { paragraph id, character index }.
function locate(node, offset) {
  if (!node) return null;
  const el = node.nodeType === 3 ? node.parentElement : node;
  const seg = el?.closest?.('[data-s]');
  if (seg) {
    const base = Number(seg.dataset.s);
    if (node.nodeType === 3) return { pid: seg.dataset.pid, idx: base + offset };
    let idx = base;
    for (let i = 0; i < offset && i < node.childNodes.length; i += 1) idx += node.childNodes[i].textContent.length;
    return { pid: seg.dataset.pid, idx };
  }
  const para = el?.closest?.('[data-para]');
  if (para) {
    let idx = 0;
    for (let i = 0; i < offset && i < para.children.length; i += 1) {
      const child = para.children[i];
      if (child.dataset.s !== undefined) idx += child.textContent.length;
    }
    return { pid: para.dataset.para, idx };
  }
  return null;
}

const sameSlots = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Review screen: the contract's text on the left (select any part to turn it
// into a field), the real PDF on the right, updating as fields are tagged.
export default function ContractTemplateEditor({
  review,
  file = null,
  sourceFilename = '',
  found = [],
  matchedAgainst = null,
  insertOptions,
  contracts,
  initialContractId = '',
  isNewUpload = false,
  onClose,
  onSaved,
}) {
  const initialSlots = useRef(review.slots);
  const [slots, setSlots] = useState(review.slots);
  const [sel, setSel] = useState(null);
  const [contractId, setContractId] = useState(initialContractId);
  const [preview, setPreview] = useState({ url: '', key: '', error: '' });
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [onlyTagged, setOnlyTagged] = useState(false);
  const urlRef = useRef('');

  const paras = useMemo(() => {
    const map = new Map();
    review.pages.forEach((pg) => pg.paragraphs.forEach((p) => map.set(p.id, p.text)));
    return map;
  }, [review]);

  const slotsByPara = useMemo(() => {
    const map = new Map();
    slots.forEach((s, i) => map.set(s.p, [...(map.get(s.p) || []), { ...s, i }]));
    return map;
  }, [slots]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const opt of insertOptions) map.set(opt.group, [...(map.get(opt.group) || []), opt]);
    return [...map];
  }, [insertOptions]);

  const dirty = isNewUpload || !sameSlots(slots, initialSlots.current);
  const labelOf = useMemo(() => Object.fromEntries(insertOptions.map((o) => [o.token, o.label])), [insertOptions]);

  // ---- live PDF preview -------------------------------------------------
  // `previewKey` changes whenever the preview is out of date; busy = not caught up yet.
  const previewKey = useMemo(
    () => JSON.stringify([slots.map(({ p, s, e, token }) => [p, s, e, token]), contractId]),
    [slots, contractId]
  );
  const busy = preview.key !== previewKey;

  useEffect(() => {
    let ignore = false;
    const timer = setTimeout(async () => {
      try {
        const form = new FormData();
        if (file) form.append('file', file);
        form.append('slots', JSON.stringify(slots.map(({ p, s, e, token }) => ({ p, s, e, token }))));
        if (contractId) form.append('contractId', contractId);
        const res = await client.post('/contract-template/preview-pdf', form, { responseType: 'blob' });
        if (ignore) return;
        const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = url;
        setPreview({ url, key: previewKey, error: '' });
      } catch (err) {
        const message = await apiErrorMessage(err, 'Could not create the preview.');
        if (!ignore) setPreview((p) => ({ ...p, key: previewKey, error: message }));
      }
    }, 600);
    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [previewKey, slots, contractId, file]);

  useEffect(() => () => urlRef.current && URL.revokeObjectURL(urlRef.current), []);

  useEffect(() => {
    const handler = (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // ---- selecting + tagging ----------------------------------------------
  const overlaps = (pid, s, e) => (slotsByPara.get(pid) || []).some((x) => s < x.e && x.s < e);

  const captureSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const a = locate(range.startContainer, range.startOffset);
    const b = locate(range.endContainer, range.endOffset);
    if (!a || !b) return;
    if (a.pid !== b.pid) {
      setNote('Select text inside one paragraph.');
      return;
    }
    const text = paras.get(a.pid) || '';
    let s = Math.min(a.idx, b.idx);
    let e = Math.max(a.idx, b.idx);
    while (s < e && /\s/.test(text[s])) s += 1;
    while (e > s && /\s/.test(text[e - 1])) e -= 1;
    if (e <= s) return;
    if (overlaps(a.pid, s, e)) {
      setNote('Part of that is already a field. Remove the field first (the \u00d7), then select again.');
      return;
    }
    setNote('');
    setSel({ pid: a.pid, s, e });
  };

  const tagSelection = (token) => {
    if (!sel || !token) return;
    setSlots((list) => [...list, { p: sel.pid, s: sel.s, e: sel.e, token }]);
    setSel(null);
    setNote('');
    window.getSelection()?.removeAllRanges();
  };

  const removeSlot = (index) => setSlots((list) => list.filter((_, i) => i !== index));

  const pickSuggestion = (text) => {
    for (const [pid, paraText] of paras) {
      let from = 0;
      for (;;) {
        const s = paraText.indexOf(text, from);
        if (s < 0) break;
        from = s + text.length;
        if (overlaps(pid, s, s + text.length)) continue;
        setSel({ pid, s, e: s + text.length });
        setNote('');
        document.getElementById(`para-${pid}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return;
      }
    }
    setNote('That text is already tagged or no longer in the contract.');
  };

  const selectedText = sel ? (paras.get(sel.pid) || '').slice(sel.s, sel.e) : '';

  // ---- save -------------------------------------------------------------
  const save = async () => {
    setError('');
    setSaving(true);
    try {
      const form = new FormData();
      if (file) form.append('file', file);
      form.append('slots', JSON.stringify(slots.map(({ p, s, e, token }) => ({ p, s, e, token }))));
      form.append('sourceFilename', sourceFilename);
      const { data } = await client.put('/contract-template', form);
      onSaved(data.template);
    } catch (err) {
      setError(await apiErrorMessage(err, 'Could not save the template.'));
    } finally {
      setSaving(false);
    }
  };

  const close = () => {
    if (dirty && !window.confirm('Close without saving? Your changes to the template will be lost.')) return;
    onClose();
  };

  const suggestions = useMemo(() => review.suggestions || [], [review]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-canvas">
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Review your contract</h1>
            <p className="mt-1 text-sm text-ink/60">
              Your PDF keeps its exact look. Only the parts that change for each tenant (highlighted) are filled in automatically.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={close} className="rounded-btn border border-line bg-surface px-4 py-2 text-sm font-medium hover:bg-canvas">
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-btn bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {saving ? 'Saving\u2026' : 'Save as my default contract'}
            </button>
          </div>
        </div>

        {error && <p className="mt-3 rounded-lg bg-status-overdueSoft px-3 py-2 text-sm text-status-overdue">{error}</p>}

        {isNewUpload && found.length === 0 && (
          <p className="mt-4 rounded-lg bg-warning-light px-3 py-2 text-sm text-ink">
            We couldn&rsquo;t recognize any fields in this contract. You can still tag them yourself: select the words that change for each tenant below.
          </p>
        )}

        {(found.length > 0 || suggestions.length > 0) && (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {found.length > 0 && (
              <div className="rounded-modal border border-line bg-surface p-4">
                <p className="text-sm font-semibold">Recognized automatically</p>
                <p className="mt-0.5 text-xs text-ink/50">
                  Read from your contract{matchedAgainst ? ` and matched to ${matchedAgainst}\u2019s lease` : ''}. Please check these are right.
                </p>
                <div className="mt-2 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                  {found.map((f) => (
                    <span
                      key={f.key}
                      className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-success-dark"
                      title={f.example ? `Found: ${f.example}` : undefined}
                    >
                      {f.label}
                      {f.example ? `: \u201c${f.example.length > 26 ? `${f.example.slice(0, 26)}\u2026` : f.example}\u201d` : ''}
                      {f.count > 1 ? ` \u00d7${f.count}` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {suggestions.length > 0 && (
              <div className="rounded-modal border border-line bg-surface p-4">
                <p className="text-sm font-semibold">Still plain text &mdash; does this change per tenant?</p>
                <p className="mt-0.5 text-xs text-ink/50">Click one to select it, then choose a field for it.</p>
                <div className="mt-2 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
                  {suggestions.map((s) => (
                    <button
                      key={`${s.kind}:${s.text}`}
                      type="button"
                      onClick={() => pickSuggestion(s.text)}
                      className="max-w-full truncate rounded-full bg-warning-light px-2.5 py-1 text-xs font-medium text-ink hover:brightness-95"
                      title={s.text}
                    >
                      {s.text.length > 48 ? `${s.text.slice(0, 48)}\u2026` : s.text}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {/* Text + tagging */}
          <section className="flex flex-col rounded-modal border border-line bg-surface p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Contract text</h2>
              <label className="flex items-center gap-1.5 text-xs text-ink/60">
                <input type="checkbox" checked={onlyTagged} onChange={(e) => setOnlyTagged(e.target.checked)} />
                Only paragraphs with fields
              </label>
            </div>

            <div className={`mt-2 rounded-lg border px-3 py-2 text-xs ${sel ? 'border-primary/40 bg-canvas' : 'border-dashed border-line text-ink/50'}`}>
              {sel ? (
                <div className="space-y-2">
                  <p>
                    Selected: <span className="font-medium">&ldquo;{selectedText.length > 70 ? `${selectedText.slice(0, 70)}\u2026` : selectedText}&rdquo;</span>
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value=""
                      onChange={(e) => tagSelection(e.target.value)}
                      className="rounded-lg border border-line bg-surface px-2 py-1.5 text-xs"
                      aria-label="Turn the selected text into a field"
                    >
                      <option value="">Turn into field&hellip;</option>
                      {groups.map(([group, opts]) => (
                        <optgroup key={group} label={group}>
                          {opts.map((o) => (
                            <option key={o.token} value={o.token}>
                              {o.label} &mdash; {o.example}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <button type="button" onClick={() => setSel(null)} className="text-ink/50 underline hover:text-ink">
                      Clear
                    </button>
                  </div>
                </div>
              ) : (
                <p>Select the words that change for each tenant (a name, an address, an amount, a date), then choose which detail they are.</p>
              )}
              {note && <p className="mt-1.5 text-status-overdue">{note}</p>}
            </div>

            <div
              className="mt-2 h-[62vh] overflow-y-auto rounded-lg border border-line bg-white p-3"
              onMouseUp={captureSelection}
              onKeyUp={captureSelection}
            >
              {review.pages.map((page) => {
                const list = page.paragraphs.filter((p) => !onlyTagged || slotsByPara.has(p.id));
                if (!list.length) return null;
                return (
                  <div key={page.number} className="mb-4">
                    <p className="sticky top-0 z-10 -mx-1 mb-1 bg-white/95 px-1 text-[10px] font-semibold uppercase tracking-wide text-ink/40">Page {page.number}</p>
                    {list.map((p) => (
                      <p key={p.id} id={`para-${p.id}`} data-para={p.id} className="mb-1.5 whitespace-pre-wrap text-[13px] leading-6">
                        {pieces(p.text, slotsByPara.get(p.id) || [], sel && sel.pid === p.id ? sel : null).map((m) =>
                          m.kind === 'text' ? (
                            <span key={`t${m.s}`} data-pid={p.id} data-s={m.s}>
                              {p.text.slice(m.s, m.e)}
                            </span>
                          ) : m.kind === 'sel' ? (
                            <span key={`x${m.s}`} data-pid={p.id} data-s={m.s} className="rounded bg-warning-light px-0.5">
                              {p.text.slice(m.s, m.e)}
                            </span>
                          ) : (
                            <React.Fragment key={`f${m.s}`}>
                              <span
                                data-pid={p.id}
                                data-s={m.s}
                                className="rounded bg-brand-soft px-0.5 text-success-dark"
                                title={labelOf[m.token] || m.token}
                              >
                                {p.text.slice(m.s, m.e)}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeSlot(m.i)}
                                className="mx-0.5 rounded-full px-1 text-[11px] leading-none text-ink/40 hover:bg-status-overdueSoft hover:text-status-overdue"
                                aria-label="Remove this field"
                                title={`Field: ${labelOf[m.token] || m.token}. Click to remove.`}
                              >
                                &times;
                              </button>
                            </React.Fragment>
                          )
                        )}
                      </p>
                    ))}
                  </div>
                );
              })}
            </div>
            <p className="mt-1.5 text-[11px] text-ink/40">
              <span className="rounded bg-brand-soft px-1">green</span> = filled in automatically &nbsp;
              <span className="rounded bg-warning-light px-1">yellow</span> = your selection. Hover a green field to see which detail it is.
            </p>
          </section>

          {/* Real PDF preview */}
          <section className="flex flex-col rounded-modal border border-line bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold">How it will look</h2>
              <select
                value={contractId}
                onChange={(e) => setContractId(e.target.value)}
                className="ml-auto max-w-[16rem] rounded-lg border border-line bg-surface px-2 py-1.5 text-xs"
                aria-label="Preview with this tenant"
              >
                <option value="">{contracts.length ? 'Preview with latest lease' : 'Preview with sample details'}</option>
                {contracts.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.tenant?.fullName || 'Tenant'} &middot; {c.unit?.name || ''} &middot; {fmtLeaseDate(c.startDate)}
                  </option>
                ))}
              </select>
            </div>
            <div className="relative mt-2 h-[62vh] overflow-hidden rounded-lg border border-line bg-canvas">
              {preview.url && <iframe key={preview.url} src={preview.url} title="Contract preview" className="h-full w-full bg-white" />}
              {busy && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/60 text-sm text-ink/60">Updating preview&hellip;</div>
              )}
              {preview.error && !busy && (
                <div className="absolute inset-x-3 top-3 rounded-lg bg-status-overdueSoft px-3 py-2 text-sm text-status-overdue">{preview.error}</div>
              )}
            </div>
            {preview.url && (
              <p className="mt-1.5 text-[11px] text-ink/40">
                Can&rsquo;t see the preview?{' '}
                <a href={preview.url} target="_blank" rel="noreferrer" className="underline hover:text-ink">
                  Open it in a new tab
                </a>
                .
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
