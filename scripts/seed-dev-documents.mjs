import { config as loadDotenv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileTypeFromBuffer } from 'file-type';

loadDotenv({ path: '.env.local' });
loadDotenv();

const BATCH = 'dev_documents_v1';
const BUCKET = 'case-documents';
const root = path.join(process.cwd(), 'dev-fixtures', 'documents');

const requiredEnv = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`${key} is missing. Refusing to seed documents.`);
    process.exit(1);
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const fixturePlan = [
  { category: 'id_card', file: '01-זיהוי-וקשר/תעודת-זהות-דמה.pdf', status: 'verified' },
  { category: 'driver_license', file: '01-זיהוי-וקשר/רשיון-נהיגה-דמה.jpg', status: 'verified' },
  { category: 'passport', file: '01-זיהוי-וקשר/דרכון-דמה.png', status: 'new' },
  { category: 'payslip', file: '02-תעסוקה-והכנסות/תלוש-שכר-ינואר-דמה.pdf', status: 'verified' },
  { category: 'form_106', file: '02-תעסוקה-והכנסות/טופס-106-דמה.pdf', status: 'new' },
  { category: 'employer_letter', file: '02-תעסוקה-והכנסות/אישור-מעסיק-דמה.pdf', status: 'rejected' },
  { category: 'tax_assessment', file: '02-תעסוקה-והכנסות/שומת-מס-דמה.png', status: 'new' },
  { category: 'foreign_payslip', file: '03-הכנסות-מחול/תלוש-זר-דמה.pdf', status: 'verified' },
  { category: 'foreign_bank_statement', file: '03-הכנסות-מחול/תדפיס-בנק-זר-דמה.pdf', status: 'new' },
  { category: 'property_deed', file: '04-אישורים-וביטחונות/נסח-טאבו-דמה.pdf', status: 'verified' },
  { category: 'appraisal', file: '04-אישורים-וביטחונות/שמאות-דמה.pdf', status: 'new' },
  { category: 'purchase_contract', file: '04-אישורים-וביטחונות/חוזה-רכישה-דמה.pdf', status: 'verified' },
  { category: 'life_insurance_quote', file: '04-אישורים-וביטחונות/אישור-ביטוח-חיים-דמה.jpg', status: 'new' },
  { category: 'property_insurance', file: '04-אישורים-וביטחונות/ביטוח-נכס-דמה.png', status: 'verified' },
];

async function main() {
  const existing = await countExistingSeed();
  if (existing > 0) {
    console.log(`Seed batch ${BATCH} already exists (${existing} documents). Nothing to do.`);
    console.log(`Cleanup SQL: update documents set deleted_at = now() where metadata->>'seed_batch' = '${BATCH}';`);
    return;
  }

  const [cases, categories, uploadUser] = await Promise.all([
    loadCases(),
    loadCategories(),
    loadUploadUser(),
  ]);

  if (cases.length === 0) {
    console.error('No active cases found. Seed demo cases first, then re-run this command.');
    process.exit(1);
  }
  if (!uploadUser) {
    console.error('No profile found for uploaded_by. Log in once or create a profile first.');
    process.exit(1);
  }

  const rows = [];
  let uploaded = 0;

  for (let caseIndex = 0; caseIndex < cases.length; caseIndex += 1) {
    const caseRow = cases[caseIndex];
    const borrowerId = caseRow.case_borrowers?.find((link) => link.is_primary)?.borrower_id ?? null;
    const docsForCase = docsForCaseIndex(caseIndex);

    for (const item of docsForCase) {
      const category = categories.get(item.category);
      if (!category) {
        console.warn(`Skipping ${item.category}: category not found`);
        continue;
      }

      const bytes = await readFile(path.join(root, item.file));
      const sniffed = await fileTypeFromBuffer(bytes);
      if (!sniffed) throw new Error(`Fixture type could not be detected: ${item.file}`);

      const id = randomUUID();
      const ext = path.extname(item.file).toLowerCase();
      const storagePath = `${caseRow.id}/${id}${ext}`;
      const storageRes = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, bytes, {
          contentType: sniffed.mime,
          upsert: false,
        });

      if (storageRes.error) {
        throw new Error(`Storage upload failed for ${storagePath}: ${storageRes.error.message}`);
      }

      const size = (await stat(path.join(root, item.file))).size;
      const now = new Date();
      const uploadDate = new Date(now.getTime() - (caseIndex + uploaded + 1) * 86_400_000).toISOString();
      const verifiedAt = item.status === 'verified' ? new Date(now.getTime() - uploaded * 3_600_000).toISOString() : null;

      rows.push({
        id,
        case_id: caseRow.id,
        borrower_id: borrowerId,
        category_id: category.id,
        file_name: path.basename(item.file),
        file_size: size,
        mime_type: sniffed.mime,
        upload_date: uploadDate,
        uploaded_by: uploadUser.id,
        status: item.status,
        verified_by: item.status === 'verified' ? uploadUser.id : null,
        verified_at: verifiedAt,
        notes: 'מסמך דמה לפיתוח ובדיקות',
        metadata: {
          seed_batch: BATCH,
          storage_path: storagePath,
          fixture: item.file,
        },
      });
      uploaded += 1;
    }
  }

  const { error } = await supabase.from('documents').insert(rows);
  if (error) {
    console.error('DB insert failed after storage upload. Seed blobs may be orphaned.', error);
    process.exit(1);
  }

  console.log(`Seeded ${rows.length} documents into ${cases.length} cases.`);
  console.log(`Batch marker: metadata->>'seed_batch' = '${BATCH}'`);
}

async function countExistingSeed() {
  const { count, error } = await supabase
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('metadata->>seed_batch', BATCH)
    .is('deleted_at', null);
  if (error) throw error;
  return count ?? 0;
}

async function loadCases() {
  const { data, error } = await supabase
    .from('cases')
    .select('id, case_number, case_borrowers(borrower_id, is_primary)')
    .is('deleted_at', null)
    .order('case_number', { ascending: false })
    .limit(10);
  if (error) throw error;
  return data ?? [];
}

async function loadCategories() {
  const { data, error } = await supabase
    .from('document_categories')
    .select('id, key')
    .eq('is_active', true);
  if (error) throw error;
  return new Map((data ?? []).map((row) => [row.key, row]));
}

async function loadUploadUser() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function docsForCaseIndex(index) {
  const size = 3 + (index % 5);
  const start = (index * 2) % fixturePlan.length;
  return Array.from({ length: size }, (_, offset) => fixturePlan[(start + offset) % fixturePlan.length]);
}

await main();
