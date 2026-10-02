import React from 'react';
import { Link } from 'react-router-dom';
import Modal from './Modal.jsx';

// Standard shell for a summary card's breakdown: title, a scrolling body and a
// footer with Close plus an optional primary action (a router link or a click
// handler). Each page supplies only the body content.
export default function StatModal({ open, title, onClose, children, action }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="lg">
      {open && (
        <>
          <div className="max-h-[68vh] overflow-y-auto pr-1">{children}</div>
          <div className="mt-5 flex justify-end gap-2 border-t border-line pt-4">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-full border border-line px-4 text-sm font-medium text-ink/60 hover:bg-canvas"
            >
              Close
            </button>
            {action &&
              (action.to ? (
                <Link
                  to={action.to}
                  className="inline-flex h-10 items-center rounded-full bg-primary px-5 text-sm font-medium text-white hover:bg-primary-dark"
                >
                  {action.label}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={action.onClick}
                  className="h-10 rounded-full bg-primary px-5 text-sm font-medium text-white hover:bg-primary-dark"
                >
                  {action.label}
                </button>
              ))}
          </div>
        </>
      )}
    </Modal>
  );
}
