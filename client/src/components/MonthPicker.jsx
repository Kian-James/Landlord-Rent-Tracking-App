import React, { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const YEARS_PER_PAGE = 12;

const monthIndex = (date) => date.getFullYear() * 12 + date.getMonth();

// A custom month + year picker. Click the trigger to open a popover: the
// header shows the year (use the arrows to step a year, or click the year
// itself to jump through a 12-year grid), and the body is a 12-month grid.
// `min` / `max` (any Date in the boundary month) grey out months and years
// outside the allowed range, which is how the export dialog keeps From <= To.
//
// `renderTrigger({ open, toggle, label })` lets each caller supply its own
// button styling (header pill vs. form field) while the popover stays shared.
export default function MonthPicker({ value, onChange, min, max, align = 'center', renderTrigger }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('months');
  const [viewYear, setViewYear] = useState(value.getFullYear());
  const [yearPageStart, setYearPageStart] = useState(0);
  const rootRef = useRef(null);

  const minIdx = min ? monthIndex(min) : -Infinity;
  const maxIdx = max ? monthIndex(max) : Infinity;
  const selectedIdx = monthIndex(value);
  const todayIdx = monthIndex(new Date());

  const label = value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const openPicker = () => {
    const year = value.getFullYear();
    setViewYear(year);
    setYearPageStart(year - (year % YEARS_PER_PAGE));
    setMode('months');
    setOpen(true);
  };
  const toggle = () => (open ? setOpen(false) : openPicker());

  useEffect(() => {
    if (!open) return undefined;
    const handleClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    // Capture phase + stopPropagation so Escape closes only this popover,
    // not a surrounding Modal that also listens for Escape.
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKey, true);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKey, true);
    };
  }, [open]);

  const monthDisabled = (year, month) => {
    const idx = year * 12 + month;
    return idx < minIdx || idx > maxIdx;
  };
  const yearDisabled = (year) => year * 12 + 11 < minIdx || year * 12 > maxIdx;

  const pick = (month) => {
    if (monthDisabled(viewYear, month)) return;
    onChange(new Date(viewYear, month, 1));
    setOpen(false);
  };

  const jumpToToday = () => {
    const now = new Date();
    if (monthDisabled(now.getFullYear(), now.getMonth())) return;
    onChange(new Date(now.getFullYear(), now.getMonth(), 1));
    setOpen(false);
  };

  const alignClass = { center: 'left-1/2 -translate-x-1/2', left: 'left-0', right: 'right-0' }[align];
  const navBtn =
    'flex h-8 w-8 items-center justify-center rounded-full text-ink/60 hover:bg-canvas disabled:opacity-30 disabled:hover:bg-transparent';

  return (
    <div ref={rootRef} className="relative">
      {renderTrigger({ open, toggle, label })}

      {open && (
        <div
          role="dialog"
          aria-label="Choose month and year"
          className={`absolute top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-surface p-3 shadow-xl ${alignClass}`}
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              className={navBtn}
              aria-label={mode === 'months' ? 'Previous year' : 'Previous years'}
              disabled={mode === 'months' ? yearDisabled(viewYear - 1) : yearDisabled(yearPageStart - 1)}
              onClick={() =>
                mode === 'months' ? setViewYear((y) => y - 1) : setYearPageStart((s) => s - YEARS_PER_PAGE)
              }
            >
              <FontAwesomeIcon icon={faChevronLeft} className="h-3 w-3" />
            </button>

            <button
              type="button"
              onClick={() => {
                if (mode === 'months') {
                  setYearPageStart(viewYear - (viewYear % YEARS_PER_PAGE));
                  setMode('years');
                } else {
                  setMode('months');
                }
              }}
              className={`rounded-full px-4 py-1 text-sm font-semibold hover:bg-canvas ${
                mode === 'years' ? 'bg-canvas' : ''
              }`}
              aria-label="Choose year"
              aria-expanded={mode === 'years'}
            >
              {mode === 'months' ? viewYear : `${yearPageStart} - ${yearPageStart + YEARS_PER_PAGE - 1}`}
            </button>

            <button
              type="button"
              className={navBtn}
              aria-label={mode === 'months' ? 'Next year' : 'Next years'}
              disabled={
                mode === 'months' ? yearDisabled(viewYear + 1) : yearDisabled(yearPageStart + YEARS_PER_PAGE)
              }
              onClick={() =>
                mode === 'months' ? setViewYear((y) => y + 1) : setYearPageStart((s) => s + YEARS_PER_PAGE)
              }
            >
              <FontAwesomeIcon icon={faChevronRight} className="h-3 w-3" />
            </button>
          </div>

          {mode === 'months' ? (
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {MONTH_LABELS.map((name, m) => {
                const idx = viewYear * 12 + m;
                const selected = idx === selectedIdx;
                const disabled = monthDisabled(viewYear, m);
                return (
                  <button
                    key={name}
                    type="button"
                    disabled={disabled}
                    aria-pressed={selected}
                    onClick={() => pick(m)}
                    className={`h-10 rounded-lg text-sm font-medium transition-colors ${
                      selected
                        ? 'bg-primary text-white'
                        : disabled
                          ? 'cursor-not-allowed text-ink/25'
                          : `hover:bg-canvas ${idx === todayIdx ? 'ring-1 ring-primary/40' : ''}`
                    }`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {Array.from({ length: YEARS_PER_PAGE }, (_, i) => yearPageStart + i).map((year) => {
                const selected = year === viewYear;
                const disabled = yearDisabled(year);
                return (
                  <button
                    key={year}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      setViewYear(year);
                      setMode('months');
                    }}
                    className={`h-10 rounded-lg text-sm font-medium transition-colors ${
                      selected
                        ? 'bg-primary text-white'
                        : disabled
                          ? 'cursor-not-allowed text-ink/25'
                          : `hover:bg-canvas ${year === new Date().getFullYear() ? 'ring-1 ring-primary/40' : ''}`
                    }`}
                  >
                    {year}
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-2 flex justify-end border-t border-line pt-2">
            <button
              type="button"
              onClick={jumpToToday}
              className="rounded-full px-3 py-1 text-xs font-medium text-ink/60 hover:bg-canvas"
            >
              This month
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
