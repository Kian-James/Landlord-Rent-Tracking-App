import React, { useEffect } from 'react';

// A small, reusable centered dialog - backdrop click and Escape both close
// it, matching standard modal conventions. Used for actions that need a
// short bit of input before completing (e.g. entering what was actually
// paid), where expanding a table row in place fights the table's own
// column widths and reads as visually inconsistent rather than a
// deliberate step.
export default function Modal({ open, onClose, title, children, size = 'sm' }) {
  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`w-full ${{ sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl' }[size] || 'max-w-sm'} rounded-modal border border-line bg-surface p-6 shadow-lg`}>
        {title && <h2 className="text-base font-semibold">{title}</h2>}
        <div className={title ? 'mt-3' : ''}>{children}</div>
      </div>
    </div>
  );
}
