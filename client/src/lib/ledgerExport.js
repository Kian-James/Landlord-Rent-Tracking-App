// Excel export for the Rent & Bill Calendar. Kept free of React and of the
// axios client (the client is passed in) so the workbook builder can be
// exercised on its own.

export const MAX_EXPORT_MONTHS = 24;

export const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

export function monthsBetween(from, to) {
  const months = [];
  let cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  while (cursor <= end) {
    months.push(cursor);
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return months;
}

// Pulls rent + utility records for every month in the range. Bills are
// generated for each month first, exactly as the calendar does when you
// browse to a month, so an exported month matches what the calendar shows.
export async function fetchLedgerRange(client, from, to) {
  const months = monthsBetween(from, to);
  const rentRecords = [];
  const utilityRecords = [];

  for (const month of months) {
    const period = monthKey(month);
    const referenceDate = month.toISOString();
    await Promise.all([
      client.post('/rent-records/generate', { referenceDate }),
      client.post('/utility-bills/generate', { referenceDate }),
    ]);
    const [rentRes, utilityRes] = await Promise.all([
      client.get('/rent-records', { params: { period } }),
      client.get('/utility-bills', { params: { period } }),
    ]);
    rentRecords.push(...rentRes.data.records.map((r) => ({ ...r, period })));
    utilityRecords.push(...utilityRes.data.records.map((b) => ({ ...b, period })));
  }

  return { months, rentRecords, utilityRecords };
}

const STATUS_LABEL = {
  paid: 'Paid',
  pending: 'Pending',
  overdue: 'Overdue',
  upcoming: 'Upcoming',
  verification: 'Awaiting verification',
};
const STATUS_COLOR = {
  paid: 'FF16A34A',
  pending: 'FFD97706',
  overdue: 'FFDC2626',
  upcoming: 'FF2563EB',
  verification: 'FF7C3AED',
};
const TYPE_LABEL = { electricity: 'Electricity', water: 'Water', wifi: 'Wifi' };

const PESO_FORMAT = '"₱"#,##0.00';
const DATE_FORMAT = 'dd mmm yyyy';

// Excel stores dates as UTC serials. Building the date from the local
// year/month/day (as UTC) keeps the day the app shows - a plain local-midnight
// Date would slip back a day for anyone ahead of UTC (e.g. the Philippines).
function excelDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

const money = (n) => (n === null || n === undefined ? null : Number(n));

function styleHeader(sheet) {
  const header = sheet.getRow(1);
  header.height = 22;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
    cell.alignment = { vertical: 'middle' };
  });
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

function colorStatusColumn(sheet, columnKey) {
  const col = sheet.getColumn(columnKey);
  col.eachCell((cell, rowNumber) => {
    if (rowNumber === 1) return;
    const key = Object.keys(STATUS_LABEL).find((k) => STATUS_LABEL[k] === cell.value);
    if (key) cell.font = { bold: true, color: { argb: STATUS_COLOR[key] } };
  });
}

export function buildLedgerWorkbook(ExcelJS, { months, rentRecords, utilityRecords }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Rentora';
  wb.created = new Date();

  // ---- Summary (one row per month + totals) ----
  const summary = wb.addWorksheet('Summary');
  summary.columns = [
    { header: 'Month', key: 'month', width: 18 },
    { header: 'Rent Expected', key: 'expected', width: 18, style: { numFmt: PESO_FORMAT } },
    { header: 'Rent Collected', key: 'collected', width: 18, style: { numFmt: PESO_FORMAT } },
    { header: 'Rent Outstanding', key: 'outstanding', width: 18, style: { numFmt: PESO_FORMAT } },
    { header: 'Collected %', key: 'pct', width: 13, style: { numFmt: '0%' } },
    { header: 'Overdue Units', key: 'overdue', width: 15 },
    { header: 'Utilities Billed', key: 'utilBilled', width: 18, style: { numFmt: PESO_FORMAT } },
    { header: 'Utilities Paid', key: 'utilPaid', width: 18, style: { numFmt: PESO_FORMAT } },
  ];

  const totals = { expected: 0, collected: 0, outstanding: 0, overdue: 0, utilBilled: 0, utilPaid: 0 };
  months.forEach((month, i) => {
    const key = monthKey(month);
    const rent = rentRecords.filter((r) => r.period === key);
    const utils = utilityRecords.filter((b) => b.period === key);

    const expected = rent.reduce((s, r) => s + (r.amountDue || 0), 0);
    const collected = rent.filter((r) => r.status === 'paid').reduce((s, r) => s + (r.amountDue || 0), 0);
    const overdue = rent.filter((r) => r.status === 'overdue').length;
    const utilBilled = utils.reduce((s, b) => s + (b.amountDue || 0), 0);
    const utilPaid = utils
      .filter((b) => b.status === 'paid')
      .reduce((s, b) => s + (b.paidAmount != null ? b.paidAmount : b.amountDue || 0), 0);

    totals.expected += expected;
    totals.collected += collected;
    totals.outstanding += expected - collected;
    totals.overdue += overdue;
    totals.utilBilled += utilBilled;
    totals.utilPaid += utilPaid;

    const r = i + 2;
    summary.addRow({
      month: month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      expected,
      collected,
      outstanding: { formula: `B${r}-C${r}`, result: expected - collected },
      pct: { formula: `IF(B${r}=0,0,C${r}/B${r})`, result: expected > 0 ? collected / expected : 0 },
      overdue,
      utilBilled,
      utilPaid,
    });
  });

  const last = months.length + 1;
  const totalRow = summary.addRow({
    month: 'Total',
    expected: { formula: `SUM(B2:B${last})`, result: totals.expected },
    collected: { formula: `SUM(C2:C${last})`, result: totals.collected },
    outstanding: { formula: `SUM(D2:D${last})`, result: totals.outstanding },
    pct: {
      formula: `IF(B${last + 1}=0,0,C${last + 1}/B${last + 1})`,
      result: totals.expected > 0 ? totals.collected / totals.expected : 0,
    },
    overdue: { formula: `SUM(F2:F${last})`, result: totals.overdue },
    utilBilled: { formula: `SUM(G2:G${last})`, result: totals.utilBilled },
    utilPaid: { formula: `SUM(H2:H${last})`, result: totals.utilPaid },
  });
  totalRow.font = { bold: true };
  totalRow.eachCell((cell) => {
    cell.border = { top: { style: 'thin', color: { argb: 'FF9CA3AF' } } };
  });
  styleHeader(summary);

  // ---- Rent Ledger ----
  const rent = wb.addWorksheet('Rent Ledger');
  rent.columns = [
    { header: 'Month', key: 'month', width: 12 },
    { header: 'Tenant', key: 'tenant', width: 26 },
    { header: 'Property', key: 'property', width: 24 },
    { header: 'Unit', key: 'unit', width: 16 },
    { header: 'Due Date', key: 'due', width: 14, style: { numFmt: DATE_FORMAT } },
    { header: 'Amount Due', key: 'amount', width: 16, style: { numFmt: PESO_FORMAT } },
    { header: 'Paid Amount', key: 'paid', width: 16, style: { numFmt: PESO_FORMAT } },
    { header: 'Status', key: 'status', width: 22 },
  ];
  [...rentRecords]
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .forEach((r) =>
      rent.addRow({
        month: r.period,
        tenant: r.tenant?.fullName || '',
        property: r.property?.name || '',
        unit: r.unit?.name || '',
        due: excelDate(r.dueDate),
        amount: money(r.amountDue),
        paid: money(r.paidAmount),
        status: STATUS_LABEL[r.status] || r.status,
      })
    );
  styleHeader(rent);
  rent.autoFilter = { from: 'A1', to: { row: 1, column: 8 } };
  colorStatusColumn(rent, 'status');

  // ---- Utility Bills ----
  const utilities = wb.addWorksheet('Utility Bills');
  utilities.columns = [
    { header: 'Month', key: 'month', width: 12 },
    { header: 'Type', key: 'type', width: 14 },
    { header: 'Tenant', key: 'tenant', width: 26 },
    { header: 'Property', key: 'property', width: 24 },
    { header: 'Unit', key: 'unit', width: 16 },
    { header: 'Due Date', key: 'due', width: 14, style: { numFmt: DATE_FORMAT } },
    { header: 'Amount Due', key: 'amount', width: 16, style: { numFmt: PESO_FORMAT } },
    { header: 'Paid Amount', key: 'paid', width: 16, style: { numFmt: PESO_FORMAT } },
    { header: 'Status', key: 'status', width: 22 },
  ];
  [...utilityRecords]
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .forEach((b) =>
      utilities.addRow({
        month: b.period,
        type: TYPE_LABEL[b.type] || b.type || '',
        tenant: b.tenant?.fullName || '',
        property: b.property?.name || '',
        unit: b.unit?.name || '',
        due: excelDate(b.dueDate),
        amount: money(b.amountDue),
        paid: money(b.paidAmount),
        status: STATUS_LABEL[b.status] || b.status,
      })
    );
  styleHeader(utilities);
  utilities.autoFilter = { from: 'A1', to: { row: 1, column: 9 } };
  colorStatusColumn(utilities, 'status');

  return wb;
}

export function ledgerFileName(from, to) {
  const a = monthKey(from);
  const b = monthKey(to);
  return a === b ? `Rentora-ledger-${a}.xlsx` : `Rentora-ledger-${a}_to_${b}.xlsx`;
}

// exceljs is large, so it's only pulled in (as its own chunk) the first time
// someone actually exports.
export async function downloadLedgerWorkbook(data, from, to) {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = buildLedgerWorkbook(ExcelJS, data);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = ledgerFileName(from, to);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
