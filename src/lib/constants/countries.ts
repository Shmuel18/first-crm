/**
 * Curated list of countries shown in the borrower "additional citizenship" and
 * "foreign residence" pickers. ISO-3166-1 alpha-2 codes are the persisted
 * value (stable across name changes / Hebrew vs English UI); the localised
 * display name is resolved at render time via the `name_he` / `name_en` keys.
 *
 * Kept deliberately short (~40 entries — the diaspora countries Kaufman's
 * client base actually comes from + the obvious globals). Add to the list as
 * needed; the column is plain TEXT in the DB so legacy free-text values
 * still render even if the code isn't in this list.
 */
export type Country = {
  code: string;
  name_he: string;
  name_en: string;
};

export const COUNTRIES: ReadonlyArray<Country> = [
  { code: 'IL', name_he: 'ישראל', name_en: 'Israel' },
  { code: 'US', name_he: 'ארה״ב', name_en: 'United States' },
  { code: 'GB', name_he: 'בריטניה', name_en: 'United Kingdom' },
  { code: 'CA', name_he: 'קנדה', name_en: 'Canada' },
  { code: 'FR', name_he: 'צרפת', name_en: 'France' },
  { code: 'DE', name_he: 'גרמניה', name_en: 'Germany' },
  { code: 'RU', name_he: 'רוסיה', name_en: 'Russia' },
  { code: 'UA', name_he: 'אוקראינה', name_en: 'Ukraine' },
  { code: 'BY', name_he: 'בלרוס', name_en: 'Belarus' },
  { code: 'AR', name_he: 'ארגנטינה', name_en: 'Argentina' },
  { code: 'BR', name_he: 'ברזיל', name_en: 'Brazil' },
  { code: 'MX', name_he: 'מקסיקו', name_en: 'Mexico' },
  { code: 'AU', name_he: 'אוסטרליה', name_en: 'Australia' },
  { code: 'NZ', name_he: 'ניו זילנד', name_en: 'New Zealand' },
  { code: 'ZA', name_he: 'דרום אפריקה', name_en: 'South Africa' },
  { code: 'ES', name_he: 'ספרד', name_en: 'Spain' },
  { code: 'PT', name_he: 'פורטוגל', name_en: 'Portugal' },
  { code: 'IT', name_he: 'איטליה', name_en: 'Italy' },
  { code: 'GR', name_he: 'יוון', name_en: 'Greece' },
  { code: 'NL', name_he: 'הולנד', name_en: 'Netherlands' },
  { code: 'BE', name_he: 'בלגיה', name_en: 'Belgium' },
  { code: 'CH', name_he: 'שווייץ', name_en: 'Switzerland' },
  { code: 'AT', name_he: 'אוסטריה', name_en: 'Austria' },
  { code: 'PL', name_he: 'פולין', name_en: 'Poland' },
  { code: 'CZ', name_he: 'צ׳כיה', name_en: 'Czech Republic' },
  { code: 'HU', name_he: 'הונגריה', name_en: 'Hungary' },
  { code: 'RO', name_he: 'רומניה', name_en: 'Romania' },
  { code: 'BG', name_he: 'בולגריה', name_en: 'Bulgaria' },
  { code: 'TR', name_he: 'טורקיה', name_en: 'Turkey' },
  { code: 'NO', name_he: 'נורווגיה', name_en: 'Norway' },
  { code: 'SE', name_he: 'שוודיה', name_en: 'Sweden' },
  { code: 'FI', name_he: 'פינלנד', name_en: 'Finland' },
  { code: 'DK', name_he: 'דנמרק', name_en: 'Denmark' },
  { code: 'IE', name_he: 'אירלנד', name_en: 'Ireland' },
  { code: 'IN', name_he: 'הודו', name_en: 'India' },
  { code: 'CN', name_he: 'סין', name_en: 'China' },
  { code: 'JP', name_he: 'יפן', name_en: 'Japan' },
  { code: 'KR', name_he: 'דרום קוריאה', name_en: 'South Korea' },
  { code: 'SG', name_he: 'סינגפור', name_en: 'Singapore' },
  { code: 'AE', name_he: 'איחוד האמירויות', name_en: 'United Arab Emirates' },
  { code: 'ET', name_he: 'אתיופיה', name_en: 'Ethiopia' },
  { code: 'MA', name_he: 'מרוקו', name_en: 'Morocco' },
  { code: 'OTHER', name_he: 'אחר', name_en: 'Other' },
];

export function countryByCode(code: string | null | undefined): Country | null {
  if (!code) return null;
  return COUNTRIES.find((c) => c.code === code) ?? null;
}
