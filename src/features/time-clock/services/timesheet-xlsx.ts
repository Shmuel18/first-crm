import ExcelJS from 'exceljs';

import { earnings, entryMinutes } from '../domain/hours';
import type { TimeEntry, TrackedEmployee } from '../types';

const HEADER_BG = 'FF0A0A0A';
const HEADER_FG = 'FFFFFFFF';
const HEADER_BORDER = 'FFC9A961';

// Formula-injection guard (OWASP): a cell starting with = + - @ or a control
// char can execute on open. Prefix with a quote so Excel treats it as text.
const FORMULA_LEAD = /^[=+\-@\t\r]/;
const neutralize = (v: string): string => (FORMULA_LEAD.test(v) ? `'${v}` : v);

export type TimesheetLabels = {
  summarySheet: string;
  nameCol: string;
  totalCol: string;
  rateCol: string;
  payCol: string;
  dateCol: string;
  inCol: string;
  outCol: string;
  hoursCol: string;
  noteCol: string;
  total: string;
  stillOpen: string;
  unnamed: string;
};

type EmployeeSheet = { employee: TrackedEmployee; entries: TimeEntry[] };

/** Excel sheet names: ≤31 chars, no \ / ? * [ ] : */
function sheetSafe(name: string): string {
  return (name.replace(/[\\/?*[\]:]/g, ' ').trim() || 'sheet').slice(0, 31);
}

function styleHeader(sheet: ExcelJS.Worksheet): void {
  const header = sheet.getRow(1);
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_FG }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = { bottom: { style: 'medium', color: { argb: HEADER_BORDER } } };
  });
  header.height = 26;
}

/** A payroll-ready workbook: one summary sheet + one detail sheet per employee. */
export async function generateTimesheetXlsx(
  data: readonly EmployeeSheet[],
  labels: TimesheetLabels,
  nowMs: number,
  locale: 'he' | 'en',
): Promise<Buffer> {
  const rtl = locale === 'he';
  const dloc = rtl ? 'he-IL' : 'en-GB';
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Kaufman Finance Group';
  workbook.created = new Date(nowMs);

  const fullName = (e: TrackedEmployee): string =>
    [e.firstName, e.lastName].filter(Boolean).join(' ').trim() || labels.unnamed;
  const fmtDate = (iso: string): string =>
    new Date(iso).toLocaleDateString(dloc, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Asia/Jerusalem',
    });
  const fmtTime = (iso: string): string =>
    new Date(iso).toLocaleTimeString(dloc, { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' });
  // Decimal hours so Excel can sum them for payroll (e.g. 8.53).
  const hours = (minutes: number): number => Number((minutes / 60).toFixed(2));
  // Pay (₪) for `minutes` at the employee's rate — blank when no rate set.
  const pay = (minutes: number, rate: number | null): number | string =>
    rate && rate > 0 ? Number(earnings(minutes, rate).toFixed(2)) : '';

  // Summary sheet: one row per employee with their period total + pay.
  const summary = workbook.addWorksheet(labels.summarySheet, {
    views: [{ rightToLeft: rtl, state: 'frozen', ySplit: 1 }],
  });
  summary.columns = [
    { header: labels.nameCol, key: 'name', width: 28 },
    { header: labels.totalCol, key: 'total', width: 14 },
    { header: labels.rateCol, key: 'rate', width: 12 },
    { header: labels.payCol, key: 'pay', width: 14 },
  ];
  styleHeader(summary);
  for (const { employee, entries } of data) {
    const mins = entries.reduce((acc, e) => acc + entryMinutes(e, nowMs), 0);
    summary.addRow({
      name: neutralize(fullName(employee)),
      total: hours(mins),
      rate: employee.hourlyRate ?? '',
      pay: pay(mins, employee.hourlyRate),
    });
  }

  // Per-employee detail sheets.
  const usedNames = new Set<string>();
  for (const { employee, entries } of data) {
    let name = sheetSafe(fullName(employee));
    while (usedNames.has(name)) name = sheetSafe(`${name.slice(0, 28)} ${usedNames.size}`);
    usedNames.add(name);

    const sheet = workbook.addWorksheet(name, {
      views: [{ rightToLeft: rtl, state: 'frozen', ySplit: 1 }],
    });
    sheet.columns = [
      { header: labels.dateCol, key: 'date', width: 14 },
      { header: labels.inCol, key: 'in', width: 10 },
      { header: labels.outCol, key: 'out', width: 10 },
      { header: labels.hoursCol, key: 'hours', width: 10 },
      { header: labels.payCol, key: 'pay', width: 12 },
      { header: labels.noteCol, key: 'note', width: 32 },
    ];
    styleHeader(sheet);

    const chrono = [...entries].sort((a, b) => Date.parse(a.clockIn) - Date.parse(b.clockIn));
    for (const e of chrono) {
      const m = entryMinutes(e, nowMs);
      sheet.addRow({
        date: fmtDate(e.clockIn),
        in: fmtTime(e.clockIn),
        out: e.clockOut ? fmtTime(e.clockOut) : labels.stillOpen,
        hours: hours(m),
        pay: pay(m, employee.hourlyRate),
        note: e.note ? neutralize(e.note) : '',
      });
    }
    const totalMins = chrono.reduce((acc, e) => acc + entryMinutes(e, nowMs), 0);
    const totalRow = sheet.addRow({
      date: labels.total,
      hours: hours(totalMins),
      pay: pay(totalMins, employee.hourlyRate),
    });
    totalRow.font = { bold: true };
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
