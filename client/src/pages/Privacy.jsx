import React from 'react';
import { Link } from 'react-router-dom';
import LegalLayout, { B, Fill, P, UL } from '../components/LegalLayout.jsx';
import { LEGAL } from '../config/legal.js';

// Privacy Policy written for the Philippine Data Privacy Act of 2012 (RA 10173)
// and its IRR. It describes what Rentora actually stores (see db/schema.sql).
// KEEP IT TRUE: if you add a new provider, data field or feature (e.g. Gmail
// integration, SMS), update the matching section below.
//
// Template only - not legal advice. Have a Philippine lawyer / your DPO review it.
const sections = [
  {
    id: 'who',
    title: 'Who we are and what this covers',
    body: (
      <>
        <P>
          {LEGAL.appName} is operated by <Fill>{LEGAL.operator}</Fill> (“we”, “us”). This policy explains how we collect, use, share and protect personal data under the Data Privacy Act of 2012
          (Republic Act No. 10173), its Implementing Rules and Regulations and National Privacy Commission (NPC) issuances.
        </P>
        <P>There are two groups of people whose data we handle, and our role is different for each:</P>
        <UL>
          <li><B>Landlords (our users).</B> For the data of your account, we are the “personal information controller”.</li>
          <li><B>Tenants and other people a landlord records.</B> The landlord is the controller; we are only the
            “personal information processor” that stores and processes this data on the landlord’s behalf. If you are a
            tenant, please see our{' '}
            <Link to="/tenant-notice" className="font-medium text-primary hover:underline">Tenant Privacy Notice</Link>.</li>
        </UL>
      </>
    ),
  },
  {
    id: 'collect',
    title: 'What we collect',
    body: (
      <>
        <P><B>Landlord account data</B></P>
        <UL>
          <li>Name, email address and (optional) address; your password, which is stored only in hashed form by our authentication provider.</li>
          <li>If you sign in with Google: the name and email address Google shares with us. We do not receive your Google password.</li>
          <li>Your notification preferences and any contract template (PDF) you upload.</li>
          <li>Security and activity records such as sign-in events and the IP address used, kept in an audit log.</li>
        </UL>
        <P><B>Data you enter about your rentals</B></P>
        <UL>
          <li>Properties and units: names, addresses, descriptions, rent and utility amounts.</li>
          <li>Tenants: full name, email, phone number, address, lease dates, rent amount and due day, advance and deposit details, status and your notes.</li>
          <li>Payments and bills: amounts, dates, payment method (such as cash, GCash, Maya or bank transfer), reference numbers, receipts you attach, and verification status.</li>
          <li>Generated contracts (PDFs) and in-app notifications.</li>
        </UL>
        <P><B>Technical data</B></P>
        <UL>
          <li>Basic request information (IP address, browser type, time of request) in server logs, used for security and troubleshooting.</li>
          <li>A sign-in session stored in your browser (see “Cookies and local storage”).</li>
        </UL>
        <P>
          We do not knowingly need <B>sensitive personal information</B> (such as government ID numbers, health or
          financial-account credentials). Please do not enter it. We do not collect payment card numbers.
        </P>
      </>
    ),
  },
  {
    id: 'use',
    title: 'How and why we use data',
    body: (
      <>
        <P>We use personal data only for purposes that are specific, declared and legitimate:</P>
        <UL>
          <li><B>To provide the service</B>: create your account, show your dashboard, track rent and bills, send the reminders you set, and generate contract PDFs (necessary to perform our agreement with you).</li>
          <li><B>To keep things secure</B>: detect misuse, enforce our Terms, prevent fraud and investigate incidents (our legitimate interests and, where applicable, legal obligations).</li>
          <li><B>To communicate with you</B>: service messages such as email confirmation, password resets, security notices and changes to our terms.</li>
          <li><B>To improve Rentora</B>: fix bugs and understand which features are used, using aggregated or de-identified information where we can.</li>
          <li><B>To meet legal obligations</B> and respond to lawful requests from authorities.</li>
        </UL>
        <P>
          We do <B>not sell</B> personal data, do not use it for advertising, and do not use landlords’ or tenants’ data for
          unrelated marketing. Where we rely on your consent, you may withdraw it at any time (this does not affect what we did before).
        </P>
      </>
    ),
  },
  {
    id: 'share',
    title: 'Who we share data with',
    body: (
      <>
        <P>
          Only with people who need it to run the service, under confidentiality and data-protection terms. Our service
          providers (“sub-processors”) currently include:
        </P>
        <UL>
          <li><B>Supabase</B>: database and authentication hosting.</li>
          <li><B>Vercel</B>: application hosting and delivery.</li>
          <li><B>Google</B>: sign-in with Google, if you choose it.</li>
          <li><B>Google (Gmail)</B>: sending reminder and account emails.</li>
        </UL>
        <P>
          We may also disclose data when required by law, court order or a lawful request from a government body, to
          protect rights and safety, or as part of a merger or sale of our business (with notice to you and the same
          protections).
        </P>
        <P>
          <B>Landlords and tenants.</B> A tenant’s record is visible only to the landlord who created it (and to us as
          their processor), not to other landlords.
        </P>
      </>
    ),
  },
  {
    id: 'transfers',
    title: 'Where data is stored',
    body: (
      <P>
        Our providers may store and process data on servers outside the Philippines. When data leaves the country we remain
        accountable for it and use contractual and technical safeguards so it receives a level of protection comparable
        to Philippine law.
      </P>
    ),
  },
  {
    id: 'retention',
    title: 'How long we keep data',
    body: (
      <UL>
        <li><B>Active accounts</B>: data is kept while your account is open so the service works.</li>
        <li><B>After you delete your account</B>: you can do this yourself in Settings, and your account data and the tenant and rental data you entered are removed from the live service right away. If you ask us to delete it, we do so within {LEGAL.retention.accountDeletionDays} days.</li>
        <li><B>Backups</B>: deleted data may remain in encrypted backups for up to about {LEGAL.retention.backupDays} days, then is overwritten.</li>
        <li><B>Audit and security logs</B>: kept for about {LEGAL.retention.auditLogMonths} months.</li>
        <li>We may keep limited records longer where the law requires or to establish, exercise or defend legal claims.</li>
      </UL>
    ),
  },
  {
    id: 'security',
    title: 'How we protect data',
    body: (
      <>
        <P>
          We use organisational, physical and technical measures appropriate to the risk, including encrypted connections
          (HTTPS), hashed passwords, per-landlord access controls so one landlord cannot see another’s data, row-level
          security in the database, request rate limiting, and limited staff access. No system is perfectly secure.
        </P>
        <P>
          If a personal data breach occurs that requires notification, we will notify the National Privacy Commission and
          the affected people within 72 hours of knowledge or reasonable belief of the breach, and tell affected
          landlords so they can meet their own duties.
        </P>
      </>
    ),
  },
  {
    id: 'rights',
    title: 'Your rights',
    body: (
      <>
        <P>Under the Data Privacy Act you have the right to:</P>
        <UL>
          <li><B>be informed</B> about how your data is processed;</li>
          <li><B>access</B> the personal data we hold about you;</li>
          <li><B>object</B> to processing, or withdraw consent, where processing is based on consent;</li>
          <li><B>correct</B> inaccurate or incomplete data;</li>
          <li><B>erase or block</B> data that is unlawfully processed, no longer needed, or whose processing you object to;</li>
          <li><B>data portability</B>: get your data in a commonly used electronic format where applicable;</li>
          <li><B>be indemnified</B> for damages caused by inaccurate, unlawful or unauthorised use of your data;</li>
          <li><B>file a complaint</B> with the National Privacy Commission (<a href="https://privacy.gov.ph" target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">privacy.gov.ph</a>).</li>
        </UL>
        <P>
          You can <B>delete your account and all its data yourself</B> at any time in Settings. For any other request, email
          our Data Protection Officer, <Fill>{LEGAL.dpoName}</Fill>, at{' '}
          <Fill>{LEGAL.privacyEmail}</Fill>. We may ask you to verify your identity first and will reply within a reasonable
          time, generally within 30 days. <B>If you are a tenant</B>, your landlord decides how your data is used, so you
          can ask your landlord directly or write to us and we will help route and resolve your request. Some rights may
          be limited where the law allows or requires us to keep information.
        </P>
      </>
    ),
  },
  {
    id: 'cookies',
    title: 'Cookies and local storage',
    body: (
      <P>
        {LEGAL.appName} uses only what is necessary to work: your browser stores a sign-in session so you stay logged in
        and a few interface preferences. We do not use advertising or cross-site tracking cookies. Clearing your browser
        data or logging out removes the session.
      </P>
    ),
  },
  {
    id: 'children',
    title: 'Children',
    body: (
      <P>
        {LEGAL.appName} is for adults. We do not knowingly create accounts for anyone under 18. If you believe a minor’s
        data has been entered without proper authority, contact us and we will act on it.
      </P>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    body: (
      <P>
        We may update this policy as the service or the law changes. We will post the new version here with a new
        effective date and notify you of material changes in the app or by email.
      </P>
    ),
  },
  {
    id: 'contact',
    title: 'Contact us',
    body: (
      <P>
        <B>Data Protection Officer:</B> <Fill>{LEGAL.dpoName}</Fill><br />
        <B>Email:</B> <Fill>{LEGAL.privacyEmail}</Fill><br />
        You may also contact the National Privacy Commission at privacy.gov.ph.
      </P>
    ),
  },
];

export default function Privacy() {
  return (
    <LegalLayout
      title="Privacy Policy"
      current="/privacy"
      sections={sections}
      intro={<>We keep this simple: we collect what {LEGAL.appName} needs to work, we protect it, and we never sell it.</>}
    />
  );
}
