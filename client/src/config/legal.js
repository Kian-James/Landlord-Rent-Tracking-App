// Everything the legal pages need to know about YOU lives here - fill these in
// once and the Terms, Privacy Policy and Tenant Notice all update.
//
// Anything still wrapped in [square brackets] is shown with a yellow highlight
// on the pages, so an unfilled placeholder can't slip through unnoticed.
export const LEGAL = {
  appName: 'Rentora',

  // Who runs Rentora: your name if you operate as an individual, or your
  // registered business name (e.g. "Juan Dela Cruz" or "Rentora Tech Solutions OPC").
  operator: '[Your full name or registered business name]',
  operatorAddress: '[Street, Barangay, City, Province, Philippines]',

  contactEmail: '[support@yourdomain.com]',

  // Data Protection Officer (or the person accountable for privacy if you are
  // not required to appoint one). Receives privacy requests and complaints.
  dpoName: '[Name of Data Protection Officer]',
  privacyEmail: '[privacy@yourdomain.com]',

  // City whose courts handle disputes, e.g. "San Fernando, Pampanga".
  venue: '[City, Province]',

  effectiveDate: 'November 12, 2026',
  version: '1.0',

  // How long data is kept (shown in the Privacy Policy). Adjust to what you
  // actually do - the policy must match your real practice.
  retention: {
    accountDeletionDays: 30,
    backupDays: 35,
    auditLogMonths: 12,
  },
};
