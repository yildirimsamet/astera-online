import { describe, expect, it } from 'vitest';
import type { GameSurface } from '../src/inventory.js';
import { actionCoverage, animationUses, classDialects, cssClasses, dialectOf, fillPlaceholders, fontSizes, holdDurations, keyframes, pushCopies, renderStatic, tokenOverrides, typeTokens, type StaticScan } from '../src/static.js';

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

describe('the design dialect a screen file still speaks (stage 4.A, 2026-11-13)', () => {
  const CLASSES = classDialects([
    { path: 'styles/chrome.css', text: '/* .ghost */\n.plate, .plate-inset { color: red; }\n.slab-primary:hover > .works-fill { margin: .5rem; }' },
    { path: 'styles.css', text: "@import './styles/chrome.css';\n.legend { background: url(a.png); }\n.name { }\n.v2-segmented-option { }" },
    { path: 'v2/surfaces.css', text: '.v2-panel { }' },
    { path: 'styles/atmosphere.css', text: '.sheet-art-head { }' },
    { path: 'battle-simulator/simulator.css', text: '.sim-field-error { }\n.simulator .sr-only { }\n.simulator .overflow-y-auto { }' },
    { path: 'game-ui/game-ui.css', text: '.gk-plate { }' },
  ]);

  it('reads the classes a stylesheet defines, never a number, a file name or a comment', () => {
    expect(cssClasses('/* .ghost */\n.plate, .plate-inset { margin: .5rem; background: url(a.png); }\n.a:hover > .b-c { }')).toEqual(['plate', 'plate-inset', 'a', 'b-c']);
  });

  it('files each class under the dialect of the sheet that defines it, or its v2-/gk- name; a Tailwind utility a sheet restyles stays Tailwind\'s', () => {
    expect(Object.fromEntries(CLASSES)).toEqual({ plate: 'v1', 'plate-inset': 'v1', 'slab-primary': 'v1', 'works-fill': 'v1', legend: 'v1', name: 'v1', 'v2-segmented-option': 'v2', 'v2-panel': 'v2', 'sheet-art-head': 'v2', 'simulator': 'own', 'sim-field-error': 'own', 'gk-plate': 'kit' });
  });

  it('counts the old chrome (v1): its kit imports, its classes, and the bone/dim/faint colours and old type scale', () => {
    const v1 = "import { Button } from '../../ui/kit';\nimport { Meter } from '../../ui/kit/Meter';\n<div className=\"plate plate-inset slab-primary legend text-bone hover:text-dim/70 border-faint text-micro\" />";
    expect(dialectOf('screens/clan/A.tsx', v1, CLASSES)).toEqual({ file: 'screens/clan/A.tsx', v1: 10, v2: 0, own: 0, kit: 0 });
  });

  it('counts the v2 kit imports, resolved from the file (`../kit` inside v2/), its classes and v2 colour utilities', () => {
    const v2 = "import { Sheet } from '../kit/Sheet';\n<p className={`v2-panel text-v2-ink-2 bg-v2-panel/40 ${x}`} />";
    expect(dialectOf('v2/hud/B.tsx', v2, CLASSES)).toEqual({ file: 'v2/hud/B.tsx', v1: 0, v2: 4, own: 0, kit: 0 });
  });

  it('counts a screen\'s own stylesheet as a dialect of its own', () => {
    expect(dialectOf('battle-simulator/S.tsx', '<p className="sim-field-error" />', CLASSES)).toEqual({ file: 'battle-simulator/S.tsx', v1: 0, v2: 0, own: 1, kit: 0 });
  });

  it('counts the game kit imports and gk- classes, and never reads a gk- class as the old chrome', () => {
    const kit = "import { GameButton } from '../game-ui';\nimport { GameHold } from '../game-ui/buttons';\n<div className=\"gk-plate gk-t-body gk-inote--plate\" />";
    expect(dialectOf('screens/C.tsx', kit, CLASSES)).toEqual({ file: 'screens/C.tsx', v1: 0, v2: 0, own: 0, kit: 5 });
  });

  it('reads a stylesheet\'s class from a lone string only where a className takes it; a token shape counts anywhere', () => {
    const classed = "<b className=\"legend\" /><i className={on ? 'plate' : `name`} />";
    expect(dialectOf('screens/E.tsx', classed, CLASSES).v1).toBe(3);
    const data = "const key = 'name';\nregister('plate');\nconst kind = 'works-fill';\nconst tone = ok ? 'text-v2-ink' : 'text-dim';";
    expect(dialectOf('screens/F.tsx', data, CLASSES)).toEqual({ file: 'screens/F.tsx', v1: 1, v2: 1, own: 0, kit: 0 });
  });

  it('reads no comment, link, component name or identifier as a class', () => {
    const quiet = "// plate text-bone, don't\n/* slab 'chip' */\nconst url = 'https://x.y/plate';\n{/* legend */}\n<Plate tone=\"lit\" />\nconst plateCount = legendary + field;\nimport { x } from './kit';";
    expect(dialectOf('screens/D.tsx', quiet, CLASSES)).toEqual({ file: 'screens/D.tsx', v1: 0, v2: 0, own: 0, kit: 0 });
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
    dialects: [
      { file: 'shell/Bell.tsx', v1: 3, v2: 1, own: 0, kit: 0 },
      { file: 'shell/Feed.tsx', v1: 0, v2: 1, own: 4, kit: 2 },
      { file: 'screens/Base.tsx', v1: 0, v2: 0, own: 0, kit: 7 },
    ],
  };
  const surfaces: Pick<GameSurface, 'id' | 'group' | 'files' | 'unreached'>[] = [
    { id: 'base', group: 'G10', files: ['screens/Base.tsx'] },
    { id: 'bell', group: 'G1', files: ['shell/Bell.tsx', 'shell/Feed.tsx'], unreached: ['sinyal satırları', 'boş akış'] },
    { id: 'planet', group: 'G2', files: [] },
  ];
  const markdown = renderStatic(scan, { date: '2026-11-11', surfaces });

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

  it('adds up each surface\'s dialect over its files, in group order, beside the states nothing reaches yet', () => {
    expect(markdown).toMatch(/\| G1 \| bell \| 3 \| 2 \| 4 \| 2 \| sinyal satırları; boş akış \|/);
    expect(markdown).toMatch(/\| G10 \| base \| 0 \| 0 \| 0 \| 7 \| — \|/);
    expect(markdown.indexOf('| G2 | planet')).toBeLessThan(markdown.indexOf('| G10 | base'));
    // No file of its own: drawn by shared parts, so it is neither clean nor counted.
    expect(markdown).toMatch(/\| G2 \| planet \| — \| — \| — \| — \| — \|/);
    expect(markdown).toContain('Eski dil (v1, v2 ya da kendi CSS\'i) izi kalan yüzey: 1 / 2');
    expect(markdown).toContain('Ulaşılmamış durum: 2');
  });

  it('shows where a notification body passes 40 characters', () => {
    expect(markdown).toMatch(/incoming_attack.*\| 50 \|.*evet/);
    expect(markdown).toMatch(/fleet.*\| 15 \|.*hayır/);
  });
});
