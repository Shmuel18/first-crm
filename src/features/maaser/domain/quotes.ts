/**
 * Chazal / Torah lines on ma'aser & tzedaka, shown one-per-day on the maaser
 * page. Hebrew DATA (not i18n) — these are source texts, displayed as-is.
 */
export type MaaserQuote = { text: string; source: string };

export const MAASER_QUOTES: ReadonlyArray<MaaserQuote> = [
  { text: 'עַשֵּׂר תְּעַשֵּׂר', source: 'דברים יד, כב' },
  { text: 'עֲשֵׂר בִּשְׁבִיל שֶׁתִּתְעַשֵּׁר', source: 'תענית ט ע״א' },
  { text: 'וּצְדָקָה תַּצִּיל מִמָּוֶת', source: 'משלי י, ב' },
  { text: 'גְּדוֹלָה צְדָקָה שֶׁמְּקָרֶבֶת אֶת הַגְּאֻלָּה', source: 'בבא בתרא י ע״א' },
  { text: 'כָּל הַמְרַחֵם עַל הַבְּרִיּוֹת — מְרַחֲמִין עָלָיו מִן הַשָּׁמַיִם', source: 'שבת קנא ע״ב' },
];

/**
 * Quote of the day — stable within a calendar day, rotates daily. Derives a
 * deterministic index from YYYY-MM-DD (so refreshing the page never flickers).
 */
export function pickDailyQuote(isoDate: string): MaaserQuote {
  const n = Number(isoDate.replace(/-/g, ''));
  const idx = Number.isFinite(n) ? n % MAASER_QUOTES.length : 0;
  return MAASER_QUOTES[idx] ?? MAASER_QUOTES[0]!;
}
