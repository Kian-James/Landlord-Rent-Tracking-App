import React from 'react';
import { Link } from 'react-router-dom';
import LegalLayout, { B, Fill, P, UL } from '../components/LegalLayout.jsx';
import { LEGAL } from '../config/legal.js';

// Terms of Service / User Agreement. Wording is a solid starting template for a
// Philippine landlord-tool, NOT legal advice - have a Philippine lawyer review
// it before you launch publicly.
const sections = [
  {
    id: 'acceptance',
    title: 'Agreeing to these Terms',
    body: (
      <>
        <P>
          These Terms of Service (the “Terms”) are an agreement between you and <Fill>{LEGAL.operator}</Fill> (“we”,
          “us”), the operator of {LEGAL.appName}. By creating an account, signing in (including with Google), or using
          {' '}{LEGAL.appName}, you confirm that you have read and agree to these Terms and to our{' '}
          <Link to="/privacy" className="font-medium text-primary hover:underline">Privacy Policy</Link>. If you do not
          agree, please do not use the service.
        </P>
        <P>
          You must be at least 18 years old and legally able to enter into contracts. If you use {LEGAL.appName} for a
          business or on behalf of an owner, you confirm that you are authorised to do so.
        </P>
        <P>
          Under the Philippine Electronic Commerce Act (Republic Act No. 8792), your click or tap to accept these Terms
          is a valid electronic signature and has the same effect as signing on paper.
        </P>
      </>
    ),
  },
  {
    id: 'service',
    title: 'What Rentora does (and does not do)',
    body: (
      <>
        <P>
          {LEGAL.appName} helps landlords and property managers keep track of properties, units, tenants, leases, monthly
          rent, utility bills and payment records, send reminders, and generate contract PDFs from a template.
        </P>
        <P><B>What we are not:</B></P>
        <UL>
          <li>We are <B>not a payment processor or bank</B>. We never hold, move or guarantee rent money. Payment records
            are entries you (or your tenants) make; we do not verify that money was actually received.</li>
          <li>We are <B>not a law firm, accountant or tax adviser</B>. Nothing in {LEGAL.appName}, including generated
            contracts, reminders or totals, is legal, tax or accounting advice.</li>
          <li>We are <B>not a party to your lease</B>. Your relationship with your tenants is yours alone.</li>
        </UL>
      </>
    ),
  },
  {
    id: 'account',
    title: 'Your account',
    body: (
      <>
        <UL>
          <li>Give accurate information and keep it up to date.</li>
          <li>Keep your password confidential and use a strong one. You are responsible for activity under your account.</li>
          <li>Tell us promptly at <Fill>{LEGAL.contactEmail}</Fill> if you think your account has been accessed without permission.</li>
          <li>One account is for one landlord or business. Do not share your login with people who are not authorised to see your tenants’ information.</li>
        </UL>
      </>
    ),
  },
  {
    id: 'your-data',
    title: 'Your data and your responsibilities as a landlord',
    body: (
      <>
        <P>
          You keep ownership of everything you put into {LEGAL.appName} (“Your Data”), including information about your
          properties, tenants, leases and payments. You give us a limited licence to host, process, back up and display
          Your Data only so we can run and improve the service for you.
        </P>
        <P>
          <B>You are the “personal information controller” for your tenants’ personal data.</B> Under the Data Privacy
          Act of 2012 (Republic Act No. 10173), you decide why and how your tenants’ data is used; we process it on your
          behalf. That means you promise that:
        </P>
        <UL>
          <li>you have a lawful reason to collect and enter each tenant’s data (for example, to perform the lease), and you have told your tenants about it. You can share our{' '}
            <Link to="/tenant-notice" className="font-medium text-primary hover:underline">Tenant Privacy Notice</Link> for this;</li>
          <li>you enter only what you need. Do <B>not</B> upload government ID numbers, TINs, health information or other sensitive personal information unless you truly need it and have the right to;</li>
          <li>you will keep the information accurate and respond to your tenants’ privacy requests (see our Privacy Policy);</li>
          <li>you have the right to upload any contract template or document you provide and it does not infringe anyone else’s rights.</li>
        </UL>
      </>
    ),
  },
  {
    id: 'data-processing',
    title: 'Data processing terms',
    body: (
      <>
        <P>
          This section is the data processing agreement between you (the controller) and us (the processor) for tenant
          data, as contemplated by the Data Privacy Act and its Implementing Rules and Regulations.
        </P>
        <UL>
          <li><B>Instructions.</B> We process tenants’ personal data only on your documented instructions (that is, by you using the service), and as the law requires.</li>
          <li><B>Confidentiality.</B> Anyone on our side with access to the data is bound by confidentiality.</li>
          <li><B>Security.</B> We apply reasonable organisational, physical and technical safeguards (see our Privacy Policy).</li>
          <li><B>Sub-processors.</B> You agree we may use trusted service providers (such as database, hosting and sign-in providers listed in the Privacy Policy) and we are responsible for them. We will update the list if it changes materially.</li>
          <li><B>Help with requests.</B> We will reasonably help you respond to tenants who exercise their data protection rights.</li>
          <li><B>Breaches.</B> If we become aware of a personal data breach affecting Your Data, we will tell you without undue delay so you can meet your own notification duties, which generally include notifying the National Privacy Commission and affected people within 72 hours when the breach requires notification.</li>
          <li><B>End of service.</B> When your account ends, we will delete or return Your Data as described in section 12, unless the law requires us to keep it.</li>
        </UL>
      </>
    ),
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable use',
    body: (
      <>
        <P>You agree not to:</P>
        <UL>
          <li>break any law (including privacy, rent-control, anti-harassment and consumer laws) or infringe anyone’s rights;</li>
          <li>use reminders, emails or tenant information to harass, threaten, shame or discriminate against any person, or to contact people who have not given you their details for that purpose;</li>
          <li>upload malware, or try to probe, scan, overload, bypass or break the security or rate limits of the service;</li>
          <li>access another landlord’s data, or use automated tools (scraping, bots) to extract data from the service;</li>
          <li>copy, resell, reverse engineer or build a competing product from the service, except where the law allows;</li>
          <li>use the service to store content unrelated to managing your rentals.</li>
        </UL>
      </>
    ),
  },
  {
    id: 'reminders-contracts',
    title: 'Reminders, emails and contract PDFs',
    body: (
      <>
        <P>
          Reminders and notifications are sent based on settings and data you provide. Delivery is not guaranteed (emails
          can be delayed, filtered or bounced), so do not rely on {LEGAL.appName} as your only way to track a deadline.
        </P>
        <P>
          Contract PDFs are produced from either our built-in starter contract or a template you upload, with names,
          dates, amounts and addresses filled in. The starter contract is a <B>general template only</B>. Whether any
          lease is valid, complete or enforceable is your responsibility; we strongly recommend having a lawyer review
          the contract you use. Always check the generated PDF before you or your tenant signs it.
        </P>
      </>
    ),
  },
  {
    id: 'third-parties',
    title: 'Third-party services',
    body: (
      <P>
        {LEGAL.appName} relies on third-party providers (for example for hosting, database, authentication and Google
        sign-in). Their own terms and privacy policies apply to the parts they provide, and we are not responsible for
        outages or actions of services we do not control.
      </P>
    ),
  },
  {
    id: 'fees',
    title: 'Fees',
    body: (
      <P>
        {LEGAL.appName} is currently provided free of charge. If we introduce paid plans, we will tell you in advance and
        you can choose whether to continue. We will not charge you without your agreement.
      </P>
    ),
  },
  {
    id: 'ip',
    title: 'Our intellectual property',
    body: (
      <P>
        The {LEGAL.appName} name, logo, software, design and everything we create are owned by us or our licensors and
        protected by law. These Terms give you a personal, limited, non-exclusive, non-transferable right to use the
        service. If you send us feedback or ideas, we may use them without owing you anything.
      </P>
    ),
  },
  {
    id: 'availability',
    title: 'Availability and changes',
    body: (
      <P>
        We work to keep {LEGAL.appName} available and your data safe, but we do not promise it will be uninterrupted or
        error-free. We may update, change or discontinue features. We recommend you keep your own copies of important
        documents such as signed leases and contract PDFs.
      </P>
    ),
  },
  {
    id: 'termination',
    title: 'Ending your account',
    body: (
      <>
        <P>
          You can stop using {LEGAL.appName} at any time. You can delete your account yourself in{' '}
          <B>Settings &rarr; Danger zone &rarr; Delete account</B>, or ask us to at <Fill>{LEGAL.privacyEmail}</Fill>.
          Deleting your account is permanent. We may suspend or close an account that breaks these Terms, puts the service
          or other people at risk, or where the law requires.
        </P>
        <P>
          When you delete your account, Your Data is removed from the live service straight away. If you ask us to
          delete it instead, we do so within {LEGAL.retention.accountDeletionDays} days. Copies in backups (which expire within about {LEGAL.retention.backupDays} days) and records we must keep to
          meet legal obligations or resolve disputes.
        </P>
      </>
    ),
  },
  {
    id: 'warranty',
    title: 'No warranties',
    body: (
      <P>
        To the fullest extent the law allows, {LEGAL.appName} is provided “as is” and “as available”, without warranties
        of any kind, whether express or implied, including fitness for a particular purpose, accuracy of calculations
        or reminders, and non-infringement. Nothing here limits rights you have under Philippine law that cannot be waived.
      </P>
    ),
  },
  {
    id: 'liability',
    title: 'Limit of liability',
    body: (
      <>
        <P>
          To the fullest extent the law allows, we are not liable for indirect, incidental, special or consequential
          losses, or for lost rent, profits, tenants, data or goodwill, arising from your use of {LEGAL.appName}.
        </P>
        <P>
          Our total liability for any claim relating to the service is limited to the amount you paid us for the service
          in the 12 months before the claim, or <B>PHP 1,000</B> if you paid nothing. This does not limit liability that
          cannot be limited under Philippine law, such as for fraud, bad faith or gross negligence.
        </P>
      </>
    ),
  },
  {
    id: 'indemnity',
    title: 'Your responsibility for claims',
    body: (
      <P>
        You agree to defend and compensate us for claims, losses and reasonable costs brought by a tenant, other third
        party or authority that arise from Your Data, your leases and tenant dealings, or your breach of these Terms or
        the law, except to the extent we caused the problem.
      </P>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to these Terms',
    body: (
      <P>
        We may update these Terms. For material changes we will notify you in the app or by email before they take
        effect. If you keep using {LEGAL.appName} after the effective date, you accept the updated Terms; if you do not
        agree, you can close your account.
      </P>
    ),
  },
  {
    id: 'law',
    title: 'Governing law and disputes',
    body: (
      <>
        <P>
          These Terms are governed by the laws of the Republic of the Philippines. Please contact us first at{' '}
          <Fill>{LEGAL.contactEmail}</Fill> so we can try to resolve any concern in good faith. If we cannot, the proper
          courts of the Republic of the Philippines have jurisdiction, subject to any right you have under law to bring
          a claim elsewhere.
        </P>
      </>
    ),
  },
  {
    id: 'general',
    title: 'General and contact',
    body: (
      <>
        <P>
          If any part of these Terms is found unenforceable, the rest stays in effect. Our not enforcing a right is not a
          waiver of it. These Terms and the Privacy Policy are the entire agreement between us about the service. You may
          not transfer your account to someone else without our consent.
        </P>
        <P>
          <B><Fill>{LEGAL.operator}</Fill></B><br />
          General: <Fill>{LEGAL.contactEmail}</Fill> &middot; Privacy: <Fill>{LEGAL.privacyEmail}</Fill>
        </P>
      </>
    ),
  },
];

export default function Terms() {
  return (
    <LegalLayout
      title="Terms of Service"
      current="/terms"
      sections={sections}
      intro={<>These are the rules for using {LEGAL.appName}. Please read them; they are written to be as plain as we can make them.</>}
    />
  );
}
