import React from 'react';
import { Link } from 'react-router-dom';
import RentoraLogo from './RentoraLogo.jsx';
import BentoCard from './BentoCard.jsx';
import { LEGAL } from '../config/legal.js';

// Shared frame for the public legal pages (Terms, Privacy, Tenant Notice).
// They sit outside the logged-in app so anyone - including a tenant who has
// never made an account - can read them.

// Highlights any value from config/legal.js that is still a [placeholder].
export function Fill({ children }) {
  const text = typeof children === 'string' ? children : String(children ?? '');
  if (text.startsWith('[') && text.endsWith(']')) {
    return <mark className="rounded bg-yellow-200 px-1 text-ink">{text}</mark>;
  }
  return <>{text}</>;
}

export const P = ({ children }) => <p className="mt-2 text-sm leading-relaxed text-ink/75">{children}</p>;
export const UL = ({ children }) => (
  <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink/75">{children}</ul>
);
export const B = ({ children }) => <strong className="font-semibold text-ink">{children}</strong>;

const LINKS = [
  { to: '/terms', label: 'Terms of Service' },
  { to: '/privacy', label: 'Privacy Policy' },
  { to: '/tenant-notice', label: 'Tenant Privacy Notice' },
];

export default function LegalLayout({ title, intro, sections, current }) {
  return (
    <div className="min-h-screen bg-canvas px-3 py-4 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-3xl space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between px-1">
          <Link to="/" aria-label="Back to Rentora">
            <RentoraLogo />
          </Link>
          <Link to="/" className="rounded-full bg-surface px-4 py-2 text-sm font-medium text-ink/70 shadow-sm hover:bg-line">
            &larr; Back
          </Link>
        </div>

        <BentoCard>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Legal</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          <p className="mt-1 text-xs text-ink/50">
            Version {LEGAL.version} &middot; Effective <Fill>{LEGAL.effectiveDate}</Fill>
          </p>
          {intro && <div className="mt-3 text-sm leading-relaxed text-ink/75">{intro}</div>}

          <details className="mt-4 rounded-xl bg-canvas px-4 py-3 text-sm" open>
            <summary className="cursor-pointer font-medium">Contents</summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-ink/70">
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="hover:text-primary hover:underline">
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </details>
        </BentoCard>

        <BentoCard>
          <div className="space-y-6">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-4">
                <h2 className="text-base font-semibold">
                  {i + 1}. {s.title}
                </h2>
                {s.body}
              </section>
            ))}
          </div>
        </BentoCard>

        <p className="px-1 pb-2 text-center text-xs text-ink/45">
          {LINKS.filter((l) => l.to !== current).map((l, i) => (
            <React.Fragment key={l.to}>
              {i > 0 && ' · '}
              <Link to={l.to} className="hover:text-ink hover:underline">
                {l.label}
              </Link>
            </React.Fragment>
          ))}
        </p>
      </div>
    </div>
  );
}
