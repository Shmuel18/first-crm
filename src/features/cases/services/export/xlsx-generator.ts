import ExcelJS from 'exceljs';

import type { ExportRow } from './build-export-rows';

export type XlsxHeaders = {
  row: string;
  clientName: string;
  nationalId: string;
  stage: string;
  bank: string;
  advisor: string;
  shortNote: string;
};

const HEADER_BG = 'FF0A0A0A';
const HEADER_FG = 'FFFFFFFF';
const HEADER_BORDER = 'FFC9A961';

export async function generateCasesXlsx(
  rows: ReadonlyArray<ExportRow>,
  headers: XlsxHeaders,
  sheetName: string,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Kaufman Finance Group';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
    properties: { defaultRowHeight: 20 },
  });

  sheet.columns = [
    { header: headers.row, key: 'rowNumber', width: 6 },
    { header: headers.clientName, key: 'clientName', width: 28 },
    { header: headers.nationalId, key: 'nationalId', width: 14 },
    { header: headers.stage, key: 'stage', width: 22 },
    { header: headers.bank, key: 'bank', width: 22 },
    { header: headers.advisor, key: 'advisor', width: 20 },
    { header: headers.shortNote, key: 'shortNote', width: 40 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_FG }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
    cell.alignment = { horizontal: 'right', vertical: 'middle' };
    cell.border = { bottom: { style: 'medium', color: { argb: HEADER_BORDER } } };
  });
  headerRow.height = 28;

  rows.forEach((row) => {
    const added = sheet.addRow(row);
    added.eachCell((cell) => {
      cell.alignment = { horizontal: 'right', vertical: 'middle', wrapText: true };
      cell.font = { size: 10 };
    });
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
