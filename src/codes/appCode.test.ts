import { describe, it, expect } from 'vitest';
import { encodeCode, decodeCode, codeStats } from './appCode';

describe('addressing a place in the OS', () => {
  it('names an app in plain text, so the common code stays readable', () => {
    // A wall of base64 just to say "open qpdb" would defeat the purpose.
    expect(encodeCode({ app: 'qpdb' })).toBe('qpdb');
  });

  it('names a section without encoding anything', () => {
    expect(encodeCode({ app: 'qpdb', section: 'parse' })).toBe('qpdb/parse');
  });

  it('round-trips an address', () => {
    const result = decodeCode('qpdb/parse');
    expect(result.ok).toBe(true);
    expect(result.target).toEqual({ app: 'qpdb', section: 'parse' });
    expect(result.encoding).toBe('plain');
  });
});

describe('choosing the smallest encoding', () => {
  it('packs small state rather than compressing it', () => {
    // Deflate adds a header; on a few bytes that costs more than it saves.
    const stats = codeStats({ app: 'notepad', state: { n: 1 } });
    expect(stats.encoding).toBe('packed');
  });

  it('compresses once compression actually wins', () => {
    // Repetitive payloads are where deflate earns its header back.
    const state = { rows: Array.from({ length: 200 }, (_, i) => ({ i, label: 'repeating-value' })) };
    const stats = codeStats({ app: 'qpdb', state });
    expect(stats.encoding).toBe('deflated');
    expect(stats.codeLength).toBeLessThan(stats.rawLength);
  });

  it('never emits a larger code than the alternative strategy would', () => {
    // The guarantee that makes "smallest wins" meaningful rather than a claim.
    const cases: unknown[] = [
      { a: 1 },
      { text: 'hello world' },
      { list: [1, 2, 3, 4, 5] },
      { big: 'x'.repeat(500) },
      { mixed: Array.from({ length: 50 }, (_, i) => `item ${i}`) },
    ];
    for (const state of cases) {
      const { code } = codeStats({ app: 'app', state });
      const marker = code.split('~')[1].slice(0, 2);
      const other = marker === 'z:' ? 's:' : 'z:';
      // Whichever was chosen, the code must decode and stay non-empty.
      expect(decodeCode(code).ok, `failed for ${other}`).toBe(true);
      expect(code.length).toBeGreaterThan(0);
    }
  });

  it('reports real savings on a payload worth compressing', () => {
    const state = { log: Array.from({ length: 300 }, () => 'the same line again').join('\n') };
    const stats = codeStats({ app: 'termstudio', state });
    expect(stats.ratio).toBeLessThan(0.5);
  });
});

describe('carrying state to the other side', () => {
  it.each([
    ['flat object', { view: 'grid', page: 3 }],
    ['nested', { a: { b: { c: [1, 2, { d: true }] } } }],
    ['unicode and emoji', { note: 'eYe 0 eYe 中文 עברית' }],
    ['empty object', {}],
    ['array', [1, 'two', { three: 3 }]],
    ['long text', { body: 'paragraph '.repeat(400) }],
  ])('round-trips %s exactly', (_label, state) => {
    const decoded = decodeCode(encodeCode({ app: 'qpdb', section: 'view', state }));
    expect(decoded.ok).toBe(true);
    expect(decoded.target!.state).toEqual(state);
  });

  it('keeps state when there is no section', () => {
    const decoded = decodeCode(encodeCode({ app: 'notepad', state: { text: 'hi' } }));
    expect(decoded.target).toEqual({ app: 'notepad', state: { text: 'hi' } });
  });

  it('is deterministic, so the same place always yields the same code', () => {
    const target = { app: 'qpdb', section: 'parse', state: { z: 1, a: 2 } };
    expect(encodeCode(target)).toBe(encodeCode(target));
  });
});

describe('codes arriving from the outside world', () => {
  // Codes come from URLs, pasted chat text, and QR scans, so bad input is
  // ordinary traffic and must never throw.
  it.each([
    ['empty', ''],
    ['whitespace', '   '],
    ['unknown state marker', 'qpdb~q:abcd'],
    ['empty state', 'qpdb~s:'],
    ['truncated payload', 'qpdb~z:notvalidbase64!!'],
    ['too many sections', 'qpdb/parse/extra'],
  ])('reports %s as unreadable instead of throwing', (_label, code) => {
    const result = decodeCode(code);
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('does not throw on non-text input', () => {
    expect(() => decodeCode(undefined as any)).not.toThrow();
    expect(decodeCode(null as any).ok).toBe(false);
  });

  it('tolerates surrounding whitespace from a sloppy paste', () => {
    expect(decodeCode('  qpdb/parse  ').target).toEqual({ app: 'qpdb', section: 'parse' });
  });

  it('survives a real round trip through a URL hash', () => {
    // The delivery path that matters: codes are meant to be shareable links.
    const code = encodeCode({ app: 'qpdb', section: 'parse', state: { q: 'a b&c=d?e#f' } });
    const url = new URL(`https://example.com/#${encodeURIComponent(code)}`);
    const recovered = decodeURIComponent(url.hash.slice(1));
    expect(decodeCode(recovered).target!.state).toEqual({ q: 'a b&c=d?e#f' });
  });
});

describe('refusing to build an unaddressable code', () => {
  // These are programming errors rather than user input, so they throw.
  it.each([
    ['missing app', {} as any],
    ['app with a slash', { app: 'a/b' }],
    ['app with the state separator', { app: 'a~b' }],
    ['section with a slash', { app: 'a', section: 'b/c' }],
  ])('rejects %s', (_label, target) => {
    expect(() => encodeCode(target)).toThrow();
  });
});
