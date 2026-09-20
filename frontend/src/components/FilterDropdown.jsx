import React, { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons';

export default function FilterDropdown({ value, options, renderOption, renderTrigger, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    function handleKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink hover:bg-canvas"
      >
        {renderTrigger(value)}
        <FontAwesomeIcon icon={faChevronDown} className={`text-[10px] text-ink/40 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div role="listbox" className="absolute left-0 z-30 mt-2 w-48 overflow-hidden rounded-lg border border-line bg-surface shadow-bento">
          {options.map((opt) => (
            <button
              key={opt}
              role="option"
              aria-selected={opt === value}
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              className={`flex w-full items-center px-3 py-2 text-left text-sm ${
                opt === value ? 'bg-canvas font-medium text-ink' : 'text-ink/70 hover:bg-canvas'
              }`}
            >
              {renderOption(opt)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}