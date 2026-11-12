import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GameKitGallery, KIT_VIEWS } from '../../src/v2/gallery/GameKitGallery.js';
import { TYPE_LADDERS, countWords, ladderVars, shortNumber } from '../../src/v2/gallery/StandardGallery.js';

/**
 * THE STANDARD'S DECISIONS, SIDE BY SIDE (stage 2.2–2.8). One gallery page holds each
 * open decision with its options drawn in kit parts, so the owner picks by looking and
 * pressing on the phone. Nothing here changes a game screen.
 */

const tap = (element: HTMLElement): void => {
  fireEvent.pointerDown(element, { button: 0 });
  fireEvent.pointerUp(element);
  fireEvent.click(element, { detail: 1 });
};

describe('the type ladders', () => {
  it('maps a ladder onto the kit type tokens', () => {
    const vars = ladderVars('kit', 1);
    expect(vars['--gk-t-floor']).toBe('12px');
    expect(vars['--gk-t-body']).toBe('14px');
    expect(vars['--gk-t-head']).toBe('24px');
  });

  it("draws today's game scale in the same roles", () => {
    expect(ladderVars('today', 1)['--gk-t-floor']).toBe('9px');
    expect(ladderVars('today', 1)['--gk-t-body']).toBe('12px');
  });

  it('scales a ladder for the text size setting, to whole pixels', () => {
    const vars = ladderVars('kit', 1.15);
    expect(vars['--gk-t-floor']).toBe('14px');
    expect(vars['--gk-t-body']).toBe('16px');
  });

  it('keeps every ladder in rising order from the floor to the head', () => {
    for (const ladder of Object.values(TYPE_LADDERS)) {
      const steps = [ladder.floor, ladder.small, ladder.body, ladder.lead, ladder.title, ladder.head];
      expect([...steps].sort((a, b) => a - b)).toEqual(steps);
    }
  });
});

describe('the short number options', () => {
  it("writes today's Turkish short form", () => {
    expect(shortNumber(6_422, 'today')).toBe('6.422');
    expect(shortNumber(240_100, 'today')).toBe('240\u00a0B');
    expect(shortNumber(1_400_000, 'today')).toBe('1,4\u00a0Mn');
    expect(shortNumber(12_400_000, 'today')).toBe('12\u00a0Mn');
  });

  it('writes K and M with the Turkish decimal comma, as Whiteout does in Turkish', () => {
    expect(shortNumber(6_422, 'game')).toBe('6.422');
    expect(shortNumber(99_999, 'game')).toBe('99.999');
    expect(shortNumber(240_100, 'game')).toBe('240,1K');
    expect(shortNumber(240_000, 'game')).toBe('240K');
    expect(shortNumber(1_400_000, 'game')).toBe('1,4M');
    expect(shortNumber(12_400_000, 'game')).toBe('12,4M');
  });

  it('moves up a unit when rounding reaches a thousand', () => {
    expect(shortNumber(999_960, 'game')).toBe('1M');
  });

  it('writes the whole figure when asked', () => {
    expect(shortNumber(1_400_000, 'full')).toBe('1.400.000');
  });
});

describe('the word count', () => {
  it('counts every piece holding a letter or a digit, as the audit does', () => {
    expect(countWords('Yakıt · 120 · iade yok')).toBe(4);
    expect(countWords('  ')).toBe(0);
  });
});

describe('the decision page', () => {
  it('is a kit view', () => {
    expect(KIT_VIEWS).toContain('ui-kit-standard');
  });

  it('holds each open decision, 2.2 to 2.8, as its own region', () => {
    render(<GameKitGallery view="ui-kit-standard" />);
    for (const name of [/2\.2/, /2\.3/, /2\.4/, /2\.5/, /2\.6/, /2\.7/, /2\.8/]) {
      expect(screen.getByRole('region', { name })).toBeInTheDocument();
    }
  });

  it('redraws the type sample in the ladder that is picked', () => {
    render(<GameKitGallery view="ui-kit-standard" />);
    const region = screen.getByRole('region', { name: /2\.2/ });
    const sample = region.querySelector<HTMLElement>('[data-std-sample]');
    expect(sample?.style.getPropertyValue('--gk-t-body')).toBe('14px');
    tap(within(region).getByRole('tab', { name: /Bugün/ }));
    expect(sample?.style.getPropertyValue('--gk-t-body')).toBe('12px');
  });

  it('shows fewer than half the words when the text is on budget', () => {
    render(<GameKitGallery view="ui-kit-standard" />);
    const region = screen.getByRole('region', { name: /2\.3/ });
    const words = (): number => countWords(region.querySelector('[data-std-sample]')?.textContent ?? '');
    tap(within(region).getByRole('tab', { name: /Bugün/ }));
    const today = words();
    tap(within(region).getByRole('tab', { name: /Bütçeli/ }));
    expect(words() * 2).toBeLessThan(today);
  });

  it('widens every hit area to 48 px and can outline them', () => {
    render(<GameKitGallery view="ui-kit-standard" />);
    const region = screen.getByRole('region', { name: /2\.4/ });
    const sample = region.querySelector<HTMLElement>('[data-std-sample]');
    expect(sample?.style.getPropertyValue('--gk-hit')).toBe('44px');
    tap(within(region).getByRole('tab', { name: /48/ }));
    expect(sample?.style.getPropertyValue('--gk-hit')).toBe('48px');
    tap(within(region).getByRole('switch', { name: /Dokunma alanını göster/ }));
    expect(sample).toHaveAttribute('data-std-hits');
  });

  it('shows the colour roles as a colour-blind player sees them', () => {
    render(<GameKitGallery view="ui-kit-standard" />);
    const region = screen.getByRole('region', { name: /2\.5/ });
    const sample = region.querySelector<HTMLElement>('[data-std-sample]');
    expect(sample?.style.filter ?? '').toBe('');
    tap(within(region).getByRole('tab', { name: /Yeşil/ }));
    expect(sample?.style.filter).toContain('url(#');
  });

  it('lets each hold be felt at the length its weight asks for', () => {
    render(<GameKitGallery view="ui-kit-standard" />);
    const region = screen.getByRole('region', { name: /2\.6/ });
    const lengths = [...region.querySelectorAll<HTMLElement>('.gk-hold')].map((hold) => hold.style.getPropertyValue('--gk-hold-ms'));
    expect(lengths).toEqual(['600ms', '1000ms', '1500ms']);
  });

  it('sets the side gutter that is picked', () => {
    render(<GameKitGallery view="ui-kit-standard" />);
    const region = screen.getByRole('region', { name: /2\.7/ });
    const sample = region.querySelector<HTMLElement>('[data-std-sample]');
    expect(sample?.style.getPropertyValue('--std-gutter')).toBe('12px');
    tap(within(region).getByRole('tab', { name: /16/ }));
    expect(sample?.style.getPropertyValue('--std-gutter')).toBe('16px');
  });

  it('writes the resource bar in the number style that is picked', () => {
    render(<GameKitGallery view="ui-kit-standard" />);
    const region = screen.getByRole('region', { name: /2\.8/ });
    tap(within(region).getByRole('tab', { name: /K\/M/ }));
    expect(within(region).getAllByText('240,1K').length).toBeGreaterThan(0);
    tap(within(region).getByRole('tab', { name: /Bugün/ }));
    expect(within(region).getAllByText(/^240\sB$/).length).toBeGreaterThan(0);
  });
});
