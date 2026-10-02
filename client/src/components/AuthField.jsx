import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';

// Labelled input with a leading icon. type="password" automatically gets a
// show/hide toggle. Everything else (value, onChange, required, autoComplete,
// minLength...) is passed straight through to the <input>.
export default function AuthField({ id, label, icon, hint, type = 'text', ...inputProps }) {
  const [shown, setShown] = useState(false);
  const isPassword = type === 'password';

  return (
    <div>
      <label htmlFor={id} className="ml-1 text-sm font-medium text-ink">
        {label}
      </label>
      <div className="relative mt-1.5">
        <FontAwesomeIcon
          icon={icon}
          className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/35"
        />
        <input
          id={id}
          type={isPassword && shown ? 'text' : type}
          {...inputProps}
          className={`h-11 w-full rounded-full bg-canvas pl-10 ${
            isPassword ? 'pr-11' : 'pr-4'
          } text-sm outline-none placeholder:text-ink/35 focus:ring-2 focus:ring-primary/20`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            aria-label={shown ? 'Hide password' : 'Show password'}
            className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-ink/40 hover:bg-line hover:text-ink"
          >
            <FontAwesomeIcon icon={shown ? faEyeSlash : faEye} className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {hint && <div className="ml-1 mt-1.5 text-xs text-ink/45">{hint}</div>}
    </div>
  );
}
