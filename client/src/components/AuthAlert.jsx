import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleCheck, faCircleExclamation } from '@fortawesome/free-solid-svg-icons';

// Inline message box for the auth forms: tone "error" (default) or "success".
export default function AuthAlert({ tone = 'error', children }) {
  const success = tone === 'success';
  return (
    <div
      role={success ? 'status' : 'alert'}
      className={`flex items-start gap-2.5 rounded-xl px-3.5 py-2.5 text-sm ${
        success ? 'bg-status-paidSoft text-status-paid' : 'bg-status-overdueSoft text-status-overdue'
      }`}
    >
      <FontAwesomeIcon icon={success ? faCircleCheck : faCircleExclamation} className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
