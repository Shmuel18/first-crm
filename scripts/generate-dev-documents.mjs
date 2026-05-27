import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const outDir = path.join(process.cwd(), 'dev-fixtures', 'documents');

const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lT1s2QAAAABJRU5ErkJggg==',
  'base64',
);

const JPG_BYTES = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/Aaf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/Aaf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Aqf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IV//2gAMAwEAAgADAAAAEP/EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8QH//EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8QH//EABQQAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEAAT8QH//Z',
  'base64',
);

const fixtures = [
  {
    folder: '01-זיהוי-וקשר',
    files: [
      pdf('תעודת-זהות-דמה.pdf', 'Israeli ID Placeholder'),
      jpg('רשיון-נהיגה-דמה.jpg'),
      png('דרכון-דמה.png'),
    ],
  },
  {
    folder: '02-תעסוקה-והכנסות',
    files: [
      pdf('תלוש-שכר-ינואר-דמה.pdf', 'Payslip January Placeholder'),
      pdf('טופס-106-דמה.pdf', 'Form 106 Placeholder'),
      pdf('אישור-מעסיק-דמה.pdf', 'Employer Letter Placeholder'),
      png('שומת-מס-דמה.png'),
    ],
  },
  {
    folder: '03-הכנסות-מחול',
    files: [
      pdf('תלוש-זר-דמה.pdf', 'Foreign Income Placeholder'),
      pdf('תדפיס-בנק-זר-דמה.pdf', 'Foreign Bank Statement Placeholder'),
    ],
  },
  {
    folder: '04-אישורים-וביטחונות',
    files: [
      pdf('נסח-טאבו-דמה.pdf', 'Property Deed Placeholder'),
      pdf('שמאות-דמה.pdf', 'Appraisal Placeholder'),
      pdf('חוזה-רכישה-דמה.pdf', 'Purchase Contract Placeholder'),
      jpg('אישור-ביטוח-חיים-דמה.jpg'),
      png('ביטוח-נכס-דמה.png'),
    ],
  },
  {
    folder: '05-קבצים-בעייתיים-לבדיקה',
    files: [
      text('קובץ-לא-נתמך-אמור-להכשל.txt', 'This file should be rejected by upload validation.\n'),
      file('קובץ-ריק-אמור-להכשל.pdf', Buffer.alloc(0)),
    ],
  },
];

function pdf(name, title) {
  const body = [
    '%PDF-1.4',
    '1 0 obj',
    '<< /Type /Catalog /Pages 2 0 R >>',
    'endobj',
    '2 0 obj',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    'endobj',
    '3 0 obj',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    'endobj',
    '4 0 obj',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    'endobj',
  ];
  const stream = [
    'BT',
    '/F1 22 Tf',
    '72 720 Td',
    `(${escapePdf(title)}) Tj`,
    '0 -34 Td',
    '/F1 12 Tf',
    '(Development fixture only - not a real client document.) Tj',
    '0 -22 Td',
    `(${new Date().toISOString()}) Tj`,
    'ET',
  ].join('\n');
  body.push('5 0 obj');
  body.push(`<< /Length ${Buffer.byteLength(stream)} >>`);
  body.push('stream');
  body.push(stream);
  body.push('endstream');
  body.push('endobj');
  body.push('trailer << /Root 1 0 R >>');
  body.push('%%EOF');
  return file(name, Buffer.from(body.join('\n'), 'utf8'));
}

function jpg(name) {
  return file(name, JPG_BYTES);
}

function png(name) {
  return file(name, PNG_BYTES);
}

function text(name, content) {
  return file(name, Buffer.from(content, 'utf8'));
}

function file(name, bytes) {
  return { name, bytes };
}

function escapePdf(value) {
  return value.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
}

async function main() {
  let count = 0;
  for (const group of fixtures) {
    const dir = path.join(outDir, group.folder);
    await mkdir(dir, { recursive: true });
    for (const fixture of group.files) {
      await writeFile(path.join(dir, fixture.name), fixture.bytes);
      count += 1;
    }
  }

  console.log(`Created ${count} development document fixtures:`);
  console.log(outDir);
  console.log('');
  console.log('Use them from the upload modal by choosing files from the folders above.');
  console.log('The 05 folder intentionally contains files that should fail validation.');
}

await main();
