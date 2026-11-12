import React from 'react';
import { Link } from 'react-router-dom';
import LegalLayout, { B, Fill, P, UL } from '../components/LegalLayout.jsx';
import { LEGAL } from '../config/legal.js';

// A short, plain-language privacy notice for TENANTS. Tenants never create an
// account, but their landlord stores their data in Rentora - the Data Privacy
// Act expects them to be told. Landlords can send this link to their tenants.
const sections = [
  {
    id: 'why',
    title: 'Why you are seeing this',
    body: (
      <P>
        Your landlord or property manager uses {LEGAL.appName}, a rent-tracking tool, to manage the property you rent.
        That means some of your personal data is stored in it. <B>Your landlord</B> decides what is recorded and why;
        {' '}{LEGAL.appName} (<Fill>{LEGAL.operator}</Fill>) stores and processes it for them. You do not need an account
        and you do not have to do anything.
      </P>
    ),
  },
  {
    id: 'what',
    title: 'What is recorded about you',
    body: (
      <UL>
        <li>Your name, and the contact details you gave your landlord (email, phone, address).</li>
        <li>Your lease details: unit, start and end dates, monthly rent, due date, advance and deposit.</li>
        <li>Your rent and utility bills and payment records, such as amounts, dates, method (cash, GCash, Maya, bank transfer) and reference numbers.</li>
        <li>Your signed or generated contract, and any receipts or notes your landlord attaches.</li>
      </UL>
    ),
  },
  {
    id: 'purpose',
    title: 'Why it is used',
    body: (
      <UL>
        <li>To keep accurate records of your lease and what you have paid.</li>
        <li>To prepare your contract and send reminders about due dates or lease renewal, if your landlord uses them.</li>
        <li>To keep the records secure and meet legal and accounting obligations.</li>
      </UL>
    ),
  },
  {
    id: 'who-sees',
    title: 'Who can see it',
    body: (
      <P>
        Your landlord (and anyone they authorise) can see it. It is not visible to other landlords, is not sold, and is not
        used for advertising. {LEGAL.appName} and its service providers (such as database and hosting providers) handle it only
        to run the service, under confidentiality and security obligations. It may be disclosed if the law requires.
      </P>
    ),
  },
  {
    id: 'keep',
    title: 'How long it is kept',
    body: (
      <P>
        For as long as your landlord keeps the record, which is normally for the lease and a reasonable period after for
        legal and accounting purposes. When a landlord deletes their account, the data is removed right away (backups
        clear within about {LEGAL.retention.backupDays} days).
      </P>
    ),
  },
  {
    id: 'rights',
    title: 'Your rights',
    body: (
      <>
        <P>
          Under the Data Privacy Act of 2012 (Republic Act No. 10173) you may ask to see your data, correct mistakes,
          object to its use, ask for it to be erased or blocked where it is no longer needed or unlawfully held, receive a
          copy, and be compensated for damage from misuse. You can also complain to the National Privacy Commission
          (privacy.gov.ph).
        </P>
        <P>
          <B>How to ask:</B> start with your landlord, who is responsible for your data. You can also email{' '}
          <Fill>{LEGAL.privacyEmail}</Fill> and we will help get your request to the right place and resolved.
        </P>
      </>
    ),
  },
  {
    id: 'more',
    title: 'More information',
    body: (
      <P>
        For the full details, read our{' '}
        <Link to="/privacy" className="font-medium text-primary hover:underline">Privacy Policy</Link>. Data Protection
        Officer: <Fill>{LEGAL.dpoName}</Fill>, <Fill>{LEGAL.privacyEmail}</Fill>.
      </P>
    ),
  },
];

export default function TenantNotice() {
  return (
    <LegalLayout
      title="Tenant Privacy Notice"
      current="/tenant-notice"
      sections={sections}
      intro={<>A short, plain explanation of how your landlord’s use of {LEGAL.appName} affects your personal data.</>}
    />
  );
}
