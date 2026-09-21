import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons';

export default function UserMenu({ landlord, onLogout }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const navigate = useNavigate();

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

  const initials = (landlord?.name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  const handleLogoutClick = async () => {
    setOpen(false);
    await onLogout();
    navigate('/login');
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-transparent py-1 pl-1 pr-2 hover:border-line hover:bg-canvas"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">
          {initials || '?'}
        </span>
        <span className="hidden text-left leading-tight md:block">
          <span className="block text-xs font-medium">{landlord?.name}</span>
          <span className="block text-[10px] text-ink/45">Owner</span>
        </span>
        <span className={`text-[10px] text-ink/40 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true">
          <FontAwesomeIcon icon={faChevronDown} />
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-48 overflow-hidden rounded-lg border border-line bg-surface shadow-bento"
        >
          <div className="border-b border-line px-3 py-2 md:hidden">
            <p className="truncate text-xs font-medium">{landlord?.name}</p>
            <p className="truncate text-[10px] text-ink/45">{landlord?.email}</p>
          </div>
          <Link
            to="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-ink/80 hover:bg-canvas"
          >
            Settings
          </Link>
          <button
            role="menuitem"
            onClick={handleLogoutClick}
            className="block w-full px-3 py-2 text-left text-sm text-ink/80 hover:bg-canvas"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
