import { describe, expect, it } from 'vitest';
import { actionCoverage, animationUses, fillPlaceholders, fontSizes, holdDurations, keyframes, pushCopies, renderStatic, tokenOverrides, typeTokens, type StaticScan } from '../src/static.js';

const CSS = `
@theme {
  --text-body: 12px;
  --text-body--line-height: 1.5;
  --text-micro: 9px;
  --animate-blip: blip 0.2s steps(2) infinite;
}
.tiny { font-size: 7px; }
.rem { font: 600 0.5rem/1 var(--font); }
@keyframes blip { 50% { opacity: 0.1; } }
@keyframes slide { from { transform: translateX(0); } to { transform: translateX(10px); } }
.a { animation: blip 0.25s linear infinite; }
.b { animation: slide 0.1s ease-out infinite; }
.c { animation: blip 1.5s ease-in-out infinite; }
.d { animation: blip 0.2s ease-out 1; }
.chat-type { --text-micro: 11px; }
.e i { animation-duration: .2s; }
`;

describe('type sizes in source', () => {
  const tokens = typeTokens(CSS);

  it('reads the theme type tokens, not their line heights or a scoped override', () => {
    expect(tokens).toEqual({ body: 12, micro: 9 });
  });

  it('is not misled by comments holding braces or semicolons', () => {
    const commented = '/* a; b { */\n@theme {\n  --text-x: 10px;\n}\n/**\n * note; more\n */\n.s { --text-x: 12px; }';
    expect(typeTokens(commented)).toEqual({ x: 10 });
    expect(tokenOverrides('c.css', commented)).toEqual([{ file: 'c.css', line: 8, selector: '.s', token: 'x', px: 12 }]);
    expect(fontSizes('c.css', '/* font-size: 8px */\n.a { font-size: 9px; }', {}).map((f) => f.px)).toEqual([9]);
    expect(animationUses('c.css', '/* animation: blip 0.1s infinite */').length).toBe(0);
  });

  it('lists scoped token overrides apart, with their selector', () => {
    expect(tokenOverrides('a.css', CSS)).toEqual([{ file: 'a.css', line: 16, selector: '.chat-type', token: 'micro', px: 11 }]);
  });

  it('finds px and rem sizes in CSS, the shorthand included, with line numbers', () => {
    const found = fontSizes('a.css', CSS, tokens);
    expect(found.map((f) => [f.line, f.px, f.kind])).toEqual([[8, 7, 'css'], [9, 8, 'css']]);
  });

  it('finds token, Tailwind, arbitrary, inline, 3D and canvas sizes in TSX', () => {
    const tsx = [
      '<p className="text-micro text-v2-ink md:text-body">a</p>',
      '<p className="text-xs">b</p>',
      '<p className="text-[8px] text-body/5">c</p>',
      '<p style={{ fontSize: 10 }}>d</p>',
      '<Text fontSize={0.4}>e</Text>',
      "ctx.font = '600 11px Inter';",
      'ctx.font = `800 ${String(size)}px system-ui`;',
    ].join('\n');
    const found = fontSizes('a.tsx', tsx, tokens);
    expect(found.map((f) => `${String(f.line)}:${f.kind}:${String(f.px)}:${f.variant ?? ''}`)).toEqual([
      '1:token:9:', '1:token:12:md', '2:tailwind:12:', '3:arbitrary:8:', '3:token:12:', '4:inline:10:', '5:3d:0.4:', '6:canvas:11:', '7:canvas:null:',
    ]);
    expect(found[0]?.token).toBe('micro');
  });
});

describe('fast light-changing animations', () => {
  const frames = keyframes(CSS);

  it('knows which keyframes change light', () => {
    expect(frames.get('blip')).toBe(true);
    expect(frames.get('slide')).toBe(false);
  });

  it('lists every use with its period and repeat count, theme animations included', () => {
    const uses = animationUses('a.css', CSS);
    expect(uses.map((u) => `${String(u.name)}:${String(u.seconds)}:${String(u.repeats)}`)).toEqual(['blip:0.2:Infinity', 'blip:0.25:Infinity', 'slide:0.1:Infinity', 'blip:1.5:Infinity', 'blip:0.2:1', 'null:0.2:null']);
  });

  it('reads Tailwind arbitrary animations in TSX', () => {
    expect(animationUses('a.tsx', '<i className="animate-[blip_0.15s_linear_infinite]" />').map((u) => `${u.name}:${String(u.seconds)}`)).toEqual(['blip:0.15']);
  });
});

describe('hold durations', () => {
  it('finds hold constants and props, digit separators included', () => {
    const source = 'export const HOLD_MS = 600;\nconst PING_HOLD_MS = 1_320;\n<HoldButton holdMs={850} />\nconst WIDTH = 600;';
    expect(holdDurations('a.tsx', source).map((h) => `${h.name}=${String(h.ms)}@${String(h.line)}`)).toEqual(['HOLD_MS=600@1', 'PING_HOLD_MS=1320@2', 'holdMs=850@3']);
  });
});

describe('sound and haptic coverage', () => {
  it('counts actions, direct sound and haptic calls, and actions through a kit control that answers itself', () => {
    const source = [
      '<button onClick={go}>a</button>',
      '<button onClick={() => { playSound(CUE); haptic(); }}>b</button>',
      '<HoldButton onConfirm={go} />',
      '<input onChange={set} />',
    ].join('\n');
    expect(actionCoverage('a.tsx', source, new Set(['HoldButton']))).toEqual({ file: 'a.tsx', actions: 3, sound: 1, haptic: 1, kit: 1 });
  });
});

describe('notification copy', () => {
  const source = [
    'const COPY = {',
    '  tr: {',
    "    incoming_attack: { title: 'Saldırı geliyor', body: '{world} dünyana bir filo yaklaşıyor. Varış: {minutes} dk.' },",
    '  },',
    '  en: {',
    "    probe_detected: { title: 'Probe detected', body: 'A probe scanned {world}.' },",
    '  },',
    '};',
  ].join('\n');

  it('finds each title and body with its language and kind', () => {
    expect(pushCopies('push.ts', source).map((c) => `${c.lang}/${c.kind}@${String(c.line)}`)).toEqual(['tr/incoming_attack@3', 'en/probe_detected@6']);
  });

  it('reads the one-line tuple form too: kind: [title, body]', () => {
    const tuples = "  tr: { repair_done: ['Onarımlar bitti', 'Gemindeki {count} uzun onarım tamamlandı.'], miner_home: [\"Kazıcı döndü\", 'Kazıcın döndü.'] },";
    expect(pushCopies('r.ts', tuples).map((c) => `${c.lang}/${c.kind}:${c.title}`)).toEqual(['tr/repair_done:Onarımlar bitti', 'tr/miner_home:Kazıcı döndü']);
  });

  it('leaves string lists that are not copy alone, even when two of their items sit beside a bracket', () => {
    const config = [
      "  redact: ['req.headers.authorization', 'req.headers.cookie', 'req.body'],",
      "  methods: ['GET', 'HEAD', 'POST'],",
      "  a: ['href', 'title', 'target', 'rel'],",
      "  exposedHeaders: ['x-server-time', 'x-placement', 'Date'],",
    ].join('\n');
    expect(pushCopies('app.ts', config)).toEqual([]);
  });

  it('keeps an escaped quote inside a title or body', () => {
    const escaped = "  fr: { miner_home: ['Prospecteur rentr\\'é', 'L\\'or attend.'] },";
    expect(pushCopies('r.ts', escaped).map((c) => c.body)).toEqual(["L\\'or attend."]);
  });

  it('fills placeholders with typical values before measuring', () => {
    expect(fillPlaceholders('{world} · {{minutes}} dk · {name} ×{{count}}')).toBe('Kestrel · 12 dk · Tersane ×2');
  });
});

describe('the static report', () => {
  const scan: StaticScan = {
    tokens: { micro: 9, body: 12 },
    overrides: [{ file: 'chrome.css', line: 9, selector: '.chat-type', token: 'micro', px: 11 }],
    globalTap: 'button, [role="button"]',
    fontSizes: [
      { file: 'a.tsx', line: 1, kind: 'token', px: 9, token: 'micro', raw: 'text-micro' },
      { file: 'a.tsx', line: 2, kind: 'token', px: 9, token: 'micro', raw: 'text-micro' },
      { file: 'b.css', line: 3, kind: 'css', px: 7, raw: 'font-size: 7px' },
      { file: 'c.tsx', line: 4, kind: '3d', px: 0.4, raw: 'fontSize={0.4}' },
    ],
    animations: [
      { file: 'a.css', line: 5, name: 'blip', seconds: 0.2, repeats: Infinity, raw: 'animation: blip 0.2s infinite', light: true },
      { file: 'a.css', line: 6, name: 'slide', seconds: 0.1, repeats: Infinity, raw: 'animation: slide 0.1s infinite', light: false },
      { file: 'a.css', line: 7, name: 'pulse', seconds: 2, repeats: Infinity, raw: 'animation: pulse 2s infinite', light: true },
    ],
    holds: [{ file: 'h.tsx', line: 1, name: 'HOLD_MS', ms: 600 }],
    coverage: [{ file: 'x.tsx', actions: 4, sound: 0, haptic: 0, kit: 0 }, { file: 'y.tsx', actions: 2, sound: 1, haptic: 1, kit: 0 }],
    notifications: [
      { source: 'push', file: 'p.ts', line: 1, lang: 'tr', kind: 'incoming_attack', title: 'Saldırı geliyor', body: 'Kestrel dünyana bir filo yaklaşıyor. Varış: 12 dk.' },
      { source: 'local', file: 'notificationCenter', line: 0, lang: 'tr', kind: 'fleet', title: 'Filo eve döndü', body: 'Bir filo döndü.' },
    ],
  };
  const markdown = renderStatic(scan, { date: '2026-11-11' });

  it('counts each token by uses and files, and lists sizes under 9 px with their place', () => {
    expect(markdown).toMatch(/\| micro \| 9 px \| 2 \| 1 \|/);
    expect(markdown).toMatch(/chrome\.css:9 — `\.chat-type` micro → 11 px/);
    expect(markdown).toContain('b.css:3');
  });

  it('lists fast light-changing animations and leaves slow or dark ones out', () => {
    expect(markdown).toContain('a.css:5');
    expect(markdown).not.toContain('a.css:6');
    expect(markdown).not.toContain('a.css:7');
  });

  it('names action files with no action-specific sound, haptic or answering kit control, under the global tap sound', () => {
    expect(markdown).toContain('`button, [role="button"]`');
    expect(markdown).toMatch(/x\.tsx — 4 eylem/);
    expect(markdown).not.toMatch(/y\.tsx — 2 eylem/);
  });

  it('shows where a notification body passes 40 characters', () => {
    expect(markdown).toMatch(/incoming_attack.*\| 50 \|.*evet/);
    expect(markdown).toMatch(/fleet.*\| 15 \|.*hayır/);
  });
});
