import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

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
    <div ref={rootRef} className="relative mt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={landlord?.name}
        className={`flex h-11 w-11 items-center justify-center rounded-2xl text-xs font-semibold transition-colors ${
          open ? 'bg-primary text-white' : 'bg-primary-light text-primary-dark hover:bg-line'
        }`}
      >
        {initials || '?'}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute bottom-0 left-full z-30 ml-3 w-48 overflow-hidden rounded-lg border border-line bg-surface shadow-bento"
        >
          <div className="border-b border-line px-3 py-2">
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
