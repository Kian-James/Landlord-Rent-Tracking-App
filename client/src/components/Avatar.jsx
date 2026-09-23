import React from 'react';

const STYLE_FOR = {
  'avatar-a': { bg: 'bg-avatar-a', text: 'text-status-paid' },
  'avatar-b': { bg: 'bg-avatar-b', text: 'text-status-upcoming' },
  'avatar-c': { bg: 'bg-avatar-c', text: 'text-status-pending' },
  'avatar-d': { bg: 'bg-avatar-d', text: 'text-status-verify' },
  'avatar-e': { bg: 'bg-avatar-e', text: 'text-status-upcoming' },
};

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function initialsOf(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Avatar({ name, size = 'md' }) {
  const keys = Object.keys(STYLE_FOR);
  const key = keys[hashString(name || '') % keys.length];
  const { bg, text } = STYLE_FOR[key];
  const sizeClass = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm';
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${bg} ${text} ${sizeClass} font-semibold`}
      aria-hidden="true"
    >
      {initialsOf(name)}
    </span>
  );
}
