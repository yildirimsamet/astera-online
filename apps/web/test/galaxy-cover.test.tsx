import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { galaxyCover, useGalaxyCover, watchGalaxyCover } from '../src/lib/galaxyCover.js';
import { SeasonRecap, type SeasonResult } from '../src/screens/SeasonRecap.js';
import { Sheet } from '../src/ui/kit/index.js';
import { Sheet as V2Sheet } from '../src/v2/kit/Sheet.js';

/*
  OWNER, 2026-10-20: "menü, chat vs gibi komple bir yavaşlık hantallık var". Measured on stage as
  the admin: with the Base sheet open over the whole disc, the galaxy still drew thirty frames a
  second of 126 draws and bloom that nobody could see, and it is that loop that starves the sheet's
  own taps and scrolls. A sheet now says how much of the galaxy it hides.
*/
interface Rect { width: number; height: number }
let observers: (() => void)[] = [];

function stubLayout(panel: Rect, holder: Rect) {
  vi.stubGlobal('innerWidth', 360);
  vi.stubGlobal('ResizeObserver', class {
    private readonly run: () => void;
    constructor(callback: () => void) { this.run = () => { callback(); }; observers.push(this.run); }
    observe() { /* jsdom has no layout; the test drives the callback. */ }
    disconnect() { observers = observers.filter(run => run !== this.run); }
  });
  const size = { panel, holder };
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const rect = this.dataset.role === 'panel' ? size.panel : size.holder;
    return { ...rect, x: 0, y: 0, top: 0, left: 0, right: rect.width, bottom: rect.height, toJSON: () => rect };
  });
  return {
    resize(next: Partial<typeof size>) {
      Object.assign(size, next);
      act(() => { for (const run of observers) run(); });
    },
  };
}

function Panel({ modal = true }: { modal?: boolean }) {
  const panel = useRef<HTMLDivElement>(null);
  useGalaxyCover(panel, modal);
  return <div data-role="holder"><div ref={panel} data-role="panel" /></div>;
}

afterEach(() => {
  observers = [];
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('how much of the galaxy a sheet hides', () => {
  it('hides the whole galaxy when it fills the room between the top bar and the dock', () => {
    stubLayout({ width: 360, height: 610 }, { width: 360, height: 625 });
    const view = render(<Panel />);
    expect(galaxyCover()).toBe('whole');
    view.unmount();
    expect(galaxyCover()).toBeNull();
  });

  it('hides only part of it when the sheet is short, and follows the sheet as it grows', () => {
    const layout = stubLayout({ width: 360, height: 300 }, { width: 360, height: 625 });
    render(<Panel />);
    expect(galaxyCover()).toBe('part');
    layout.resize({ panel: { width: 360, height: 625 } });
    expect(galaxyCover()).toBe('whole');
    layout.resize({ panel: { width: 360, height: 280 } });
    expect(galaxyCover()).toBe('part');
  });

  it('hides only part of it as a column beside the live galaxy on a wide screen', () => {
    stubLayout({ width: 440, height: 900 }, { width: 440, height: 900 });
    vi.stubGlobal('innerWidth', 1400);
    render(<Panel />);
    expect(galaxyCover()).toBe('part');
  });

  it('hides nothing while it is a peek card over a live, undimmed galaxy', () => {
    stubLayout({ width: 360, height: 140 }, { width: 360, height: 625 });
    const view = render(<Panel modal={false} />);
    expect(galaxyCover()).toBeNull();
    view.rerender(<Panel modal />);
    expect(galaxyCover()).toBe('part');
  });

  it('is whole while any one sheet hides the whole of it', () => {
    const layout = stubLayout({ width: 360, height: 625 }, { width: 360, height: 625 });
    const heard = vi.fn();
    const stop = watchGalaxyCover(heard);
    const first = render(<Panel />);
    const second = render(<Panel />);
    expect(galaxyCover()).toBe('whole');
    first.unmount();
    expect(galaxyCover()).toBe('whole');
    layout.resize({ panel: { width: 360, height: 200 } });
    expect(galaxyCover()).toBe('part');
    second.unmount();
    expect(galaxyCover()).toBeNull();
    expect(heard).toHaveBeenCalled();
    heard.mockClear();
    stop();
    render(<Panel />);
    expect(heard).not.toHaveBeenCalled();
  });
});

describe('the surfaces that stand over the galaxy', () => {
  it('every sheet reports its cover while open and releases it when it closes', () => {
    const v1 = render(<Sheet title="Planet" onClose={vi.fn()}>Body</Sheet>);
    expect(galaxyCover()).not.toBeNull();
    v1.unmount();
    expect(galaxyCover()).toBeNull();
    const v2 = render(<V2Sheet title="Fleet" onClose={vi.fn()}>Body</V2Sheet>);
    expect(galaxyCover()).not.toBeNull();
    v2.unmount();
    expect(galaxyCover()).toBeNull();
  });

  it('a peek card leaves the galaxy uncovered', () => {
    render(<V2Sheet title="World" detents={['peek', 'half']} onClose={vi.fn()}>Body</V2Sheet>);
    expect(galaxyCover()).toBeNull();
  });

  it('the season recap hides the whole galaxy', () => {
    const result: SeasonResult = { seasonId: 's', accountId: 'a', finalRank: 4, dominion: 10, damageDealt: 0, damageTaken: 0,
      rivalName: null, biggestRaid: 0, title: 'Commander', createdAt: new Date('2026-10-01T00:00:00Z'),
      recap: { commanderName: 'A', planetName: 'B', battles: 0, attacks: 0, defences: 0, rival: null, biggestRaid: null } };
    const view = render(<SeasonRecap result={result} galaxy="Vantage" onClose={vi.fn()} />);
    expect(galaxyCover()).toBe('whole');
    view.unmount();
    expect(galaxyCover()).toBeNull();
  });
});
