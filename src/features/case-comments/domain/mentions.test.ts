import { describe, expect, it } from 'vitest';

import { buildMentionBody, insertMentionPlain, parseMentionBody } from './mentions';

describe('insertMentionPlain', () => {
  it('inserts a clean @name (no uuid) at the @query span', () => {
    // "היי @שפ" — @ at 4, caret 7
    const { value, caret } = insertMentionPlain('היי @שפ', 4, 7, 'שפיצר יעקב');
    expect(value).toBe('היי @שפיצר יעקב ');
    expect(value).not.toContain('(');
    expect(caret).toBe('היי @שפיצר יעקב '.length);
  });
});

describe('buildMentionBody', () => {
  it('folds a single picked mention back into a token', () => {
    expect(buildMentionBody('היי @שפיצר יעקב תבדוק', [{ name: 'שפיצר יעקב', uuid: 'u1' }])).toBe(
      'היי @[שפיצר יעקב](u1) תבדוק',
    );
  });

  it('handles multiple distinct mentions in order', () => {
    expect(
      buildMentionBody('@דנה לוי ו@שמואל כהן', [
        { name: 'דנה לוי', uuid: 'u1' },
        { name: 'שמואל כהן', uuid: 'u2' },
      ]),
    ).toBe('@[דנה לוי](u1) ו@[שמואל כהן](u2)');
  });

  it('claims successive occurrences when the same person is picked twice', () => {
    expect(buildMentionBody('@דן @דן', [
      { name: 'דן', uuid: 'u1' },
      { name: 'דן', uuid: 'u1' },
    ])).toBe('@[דן](u1) @[דן](u1)');
  });

  it('drops a picked mention whose text was edited away', () => {
    expect(buildMentionBody('שלום עולם', [{ name: 'דן', uuid: 'u1' }])).toBe('שלום עולם');
  });

  it('does not match a name that is a prefix of a longer word (boundary)', () => {
    expect(buildMentionBody('@דני', [{ name: 'דן', uuid: 'u1' }])).toBe('@דני');
  });

  it('leaves plain text without mentions untouched', () => {
    expect(buildMentionBody('סתם טקסט בלי תיוג', [])).toBe('סתם טקסט בלי תיוג');
  });

  it('round-trips: insertMentionPlain output rebuilds to a token the bubble can parse', () => {
    const inserted = insertMentionPlain('היי ', 4, 4, 'שפיצר יעקב').value; // "היי @שפיצר יעקב "
    const body = buildMentionBody(inserted.trim(), [{ name: 'שפיצר יעקב', uuid: '9a20ccbf-9efe-4766-8505-e069f8435736' }]);
    expect(body).toBe('היי @[שפיצר יעקב](9a20ccbf-9efe-4766-8505-e069f8435736)');
    const segs = parseMentionBody(body);
    expect(segs.some((s) => s.type === 'mention' && s.uuid === '9a20ccbf-9efe-4766-8505-e069f8435736')).toBe(true);
  });
});
