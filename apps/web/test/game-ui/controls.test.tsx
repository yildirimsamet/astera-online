import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { BottomNav, Choices, GameTabs, InfoPeek, Lever, SettingLink, Slider, Toggle } from '../../src/game-ui/index.js';

/** A press that began on the control, as a finger makes it (see `useOwnPress`). */
const press = (element: HTMLElement): void => {
  fireEvent.pointerDown(element, { button: 0 });
  fireEvent.pointerUp(element);
  fireEvent.click(element, { detail: 1 });
};

describe('the toggle switch', () => {
  it('is a switch that flips on a press and on a keyboard activation', () => {
    const onChange = vi.fn();
    render(<Toggle label="Commander escort" checked={false} onChange={onChange} />);
    const toggle = screen.getByRole('switch', { name: /Commander escort/ });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    press(toggle);
    expect(onChange).toHaveBeenLastCalledWith(true);
    fireEvent.click(toggle, { detail: 0 });
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('refuses a click whose press began somewhere else', () => {
    const onChange = vi.fn();
    render(<Toggle label="Escort" checked onChange={onChange} />);
    fireEvent.click(screen.getByRole('switch'), { detail: 1 });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('the lever', () => {
  const options = [{ id: 'full', label: 'Full' }, { id: '75', label: '75%' }, { id: '50', label: '50%' }];

  it('is a radio group whose positions can be pressed', () => {
    const onChange = vi.fn();
    render(<Lever label="Speed" options={options} value="full" onChange={onChange} />);
    const group = screen.getByRole('radiogroup', { name: 'Speed' });
    expect(within(group).getByRole('radio', { name: 'Full' })).toHaveAttribute('aria-checked', 'true');
    press(within(group).getByRole('radio', { name: '50%' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('50');
  });

  it('moves one position per arrow key and stops at the ends', () => {
    const onChange = vi.fn();
    render(<Lever label="Speed" options={options} value="full" onChange={onChange} />);
    const current = screen.getByRole('radio', { name: 'Full' });
    fireEvent.keyDown(current, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('75');
    fireEvent.keyDown(current, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('carries the keyboard focus to the position an arrow key chose, as a radio group does', () => {
    function Live() {
      const [value, setValue] = useState('full');
      return <Lever label="Speed" options={options} value={value} onChange={setValue} />;
    }
    render(<Live />);
    const full = screen.getByRole('radio', { name: 'Full' });
    full.focus();
    fireEvent.keyDown(full, { key: 'ArrowRight' });
    const next = screen.getByRole('radio', { name: '75%' });
    expect(next).toHaveAttribute('aria-checked', 'true');
    expect(next).toHaveFocus();
  });
});

describe('the slider', () => {
  it('reports its value and moves by keys inside the stock', () => {
    const onChange = vi.fn();
    render(<Slider label="Dart" value={24} max={40} onChange={onChange} />);
    const slider = screen.getByRole('slider', { name: 'Dart' });
    expect(slider).toHaveAttribute('aria-valuenow', '24');
    expect(slider).toHaveAttribute('aria-valuemax', '40');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith(25);
    fireEvent.keyDown(slider, { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith(40);
    fireEvent.keyDown(slider, { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it('lets a thumb scrolling the sheet pass over it: a touch alone, or one the page took for a scroll, moves nothing', () => {
    const onChange = vi.fn();
    render(<Slider label="Dart" value={24} max={40} onChange={onChange} />);
    const slider = screen.getByRole('slider');
    fireEvent.pointerDown(slider, { button: 0, clientX: 0 });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.pointerCancel(slider);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('a tap on the track still jumps to where it landed', () => {
    const onChange = vi.fn();
    render(<Slider label="Dart" value={24} max={40} onChange={onChange} />);
    const slider = screen.getByRole('slider');
    fireEvent.pointerDown(slider, { button: 0, clientX: 0 });
    fireEvent.pointerUp(slider, { clientX: 0 });
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('does not report a move past the end', () => {
    const onChange = vi.fn();
    render(<Slider label="Dart" value={40} max={40} onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('has fine buttons and a max button', () => {
    const onChange = vi.fn();
    render(<Slider label="Dart" value={24} max={40} onChange={onChange} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: /more Dart/i }), { button: 0 });
    fireEvent.pointerUp(screen.getByRole('button', { name: /more Dart/i }));
    expect(onChange).toHaveBeenLastCalledWith(25);
    press(screen.getByRole('button', { name: /max/i }));
    expect(onChange).toHaveBeenLastCalledWith(40);
  });

  /** G1-f, 2026-11-14: a level (a volume) says where it stands; "all of it" means nothing there. */
  it('can say its level in place of the max button', () => {
    render(<Slider label="Müzik ses düzeyi" value={35} max={100} readout="%35" onChange={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /max|maks/i })).toBeNull();
    const level = screen.getByText('%35');
    expect(level.tagName).toBe('OUTPUT');
    expect(screen.getByRole('slider', { name: 'Müzik ses düzeyi' })).toHaveAttribute('aria-valuenow', '35');
  });
});

/**
 * A SETTING'S CHOICES (G1-f, 2026-11-14): a few named positions on metal plates, the chosen one
 * lit, the way a lever's positions are — a radio group, since choosing one is the whole act.
 */
describe('the choices of a setting', () => {
  const rungs = [{ id: 'high', label: 'Yüksek' }, { id: 'balanced', label: 'Dengeli' }, { id: 'low', label: 'Düşük' }] as const;

  it('is a radio group named for the setting, with the chosen one checked', () => {
    render(<Choices label="Görüntü kalitesi" options={rungs} value="balanced" onChange={vi.fn()} />);
    const group = screen.getByRole('radiogroup', { name: 'Görüntü kalitesi' });
    expect(within(group).getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByRole('radio', { name: 'Dengeli' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Yüksek' })).toHaveAttribute('aria-checked', 'false');
  });

  it('takes a press at once, and does nothing for the one already chosen', () => {
    const onChange = vi.fn();
    render(<Choices label="Görüntü kalitesi" options={rungs} value="balanced" onChange={onChange} />);
    press(screen.getByRole('radio', { name: 'Düşük' }));
    expect(onChange).toHaveBeenCalledWith('low');
    press(screen.getByRole('radio', { name: 'Dengeli' }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('walks with the arrows and keeps one stop for the Tab key', () => {
    const onChange = vi.fn();
    render(<Choices label="Görüntü kalitesi" options={rungs} value="balanced" onChange={onChange} />);
    expect(screen.getByRole('radio', { name: 'Dengeli' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: 'Yüksek' })).toHaveAttribute('tabindex', '-1');
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Dengeli' }), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('low');
  });
});

/** A setting that opens somewhere else, saying where it stands on its line (G1-f). */
describe('a setting that opens elsewhere', () => {
  it('names the setting and its state, and opens on a press', () => {
    const onPress = vi.fn();
    render(<SettingLink label="Gizlilik" value="Henüz seçilmedi" onPress={onPress} />);
    const link = screen.getByRole('button', { name: /Gizlilik/ });
    expect(link).toHaveTextContent('Henüz seçilmedi');
    press(link);
    expect(onPress).toHaveBeenCalledOnce();
  });

  it('can carry a fuller name for a reader, and says its state in it', () => {
    render(<SettingLink label="Gizlilik" name="Gizlilik ve çerez ayarları" value="Reddedildi" onPress={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Gizlilik ve çerez ayarları. Reddedildi' })).toBeInTheDocument();
  });
});

describe('tabs and the bottom bar', () => {
  const tabs = [{ id: 'overview', label: 'Overview' }, { id: 'war', label: 'War', locked: 'Clan level 2' }];

  it('selects an open tab and names what a locked one needs instead of opening it', () => {
    const onChange = vi.fn();
    render(<GameTabs label="Clan" tabs={tabs} value="overview" onChange={onChange} />);
    expect(screen.getByRole('tab', { name: /Overview/ })).toHaveAttribute('aria-selected', 'true');
    press(screen.getByRole('tab', { name: /War/ }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Clan level 2');
  });

  /** Stage 4.1: the base's five tabs — linked to their panels, walked with arrows, pointed at by the lessons. */
  const five = [{ id: 'grow', label: 'Production' }, { id: 'orbit', label: 'Intel' }, { id: 'defend', label: 'Defend' }];

  it('links each tab to the panel it opens, when told the ids', () => {
    render(<GameTabs label="Base" tabs={five} value="grow" onChange={vi.fn()} ids={{ tab: (id) => `tab-${id}`, panel: (id) => `panel-${id}` }} />);
    const tab = screen.getByRole('tab', { name: 'Intel' });
    expect(tab).toHaveAttribute('id', 'tab-orbit');
    expect(tab).toHaveAttribute('aria-controls', 'panel-orbit');
  });

  it('carries its id for a lesson that points at it, when asked', () => {
    render(<GameTabs label="Base" tabs={five} value="grow" onChange={vi.fn()} lessonMarks />);
    expect(screen.getByRole('tab', { name: 'Defend' })).toHaveAttribute('data-tab', 'defend');
  });

  /** A lesson that lets "a tab" be pressed must not let the Base switch take the player off the page. */
  it('carries no lesson mark unless asked', () => {
    render(<GameTabs label="Base" tabs={five} value="grow" onChange={vi.fn()} />);
    expect(screen.getByRole('tab', { name: 'Defend' })).not.toHaveAttribute('data-tab');
  });

  it('walks the tabs with the arrows, round the ends, and keeps only the open one in the tab order', () => {
    const onChange = vi.fn();
    render(<GameTabs label="Base" tabs={five} value="grow" onChange={onChange} />);
    expect(screen.getAllByRole('tab').map((tab) => tab.tabIndex)).toEqual([0, -1, -1]);
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('orbit');
    expect(screen.getByRole('tab', { name: 'Intel' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith('defend');
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'Home' });
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  /** Owner 2026-10-27: a coloured glyph beside each word on the Base switch. */
  it('draws a glyph in its own tone beside a tab\'s name, silent to a reader', () => {
    render(<GameTabs label="Base" tabs={[{ id: 'world', label: 'This world', glyph: { id: 'home', tone: 'alloy' } }]} value="world" onChange={vi.fn()} />);
    const tab = screen.getByRole('tab', { name: 'This world' });
    const glyph = tab.querySelector<HTMLElement>('.gk-tab__glyph');
    expect(glyph).toHaveAttribute('aria-hidden', 'true');
    expect(glyph?.style.color).toBe('var(--gk-alloy)');
  });

  /** Owner note 3 (2026-11-14): the Base's tabs are two storeys — the mark over the name, 44 px. */
  it('stacks a tab\'s mark over its name when asked, lit with the tab rather than in a tone of its own', () => {
    render(<GameTabs label="Base" stacked tabs={[{ id: 'grow', label: 'Production', glyph: { id: 'mine' } }, { id: 'orbit', label: 'Intel', glyph: { id: 'eye' } }]} value="grow" onChange={vi.fn()} />);
    expect(screen.getByRole('tablist')).toHaveClass('gk-tabs--stacked');
    const tab = screen.getByRole('tab', { name: 'Production' });
    const glyph = tab.querySelector<HTMLElement>('.gk-tab__glyph');
    expect(tab.firstElementChild).toBe(glyph);
    expect(glyph?.style.color).toBe('');
  });

  it('shows a mark on a tab and says what it means to a reader', () => {
    render(<GameTabs label="Base" tabs={[{ id: 'grow', label: 'Production', mark: { glyph: 'damaged', hint: 'Production — something has stopped' } }]} value="grow" onChange={vi.fn()} />);
    const tab = screen.getByRole('tab', { name: 'Production — something has stopped' });
    expect(tab.querySelector('svg')).not.toBeNull();
  });

  it('marks the current page and shows a count on an item', () => {
    const onChange = vi.fn();
    render(
      <BottomNav
        label="Main"
        items={[{ id: 'galaxy', label: 'Galaxy' }, { id: 'base', label: 'Base', badge: 3 }, { id: 'clan', label: 'Clan', locked: 'Shipyard 2' }]}
        value="galaxy"
        onChange={onChange}
      />,
    );
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('button', { name: /Galaxy/ })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('button', { name: /Base/ })).toHaveTextContent('3');
    press(within(nav).getByRole('button', { name: /Base/ }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('base');
    press(within(nav).getByRole('button', { name: /Clan/ }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

/**
 * THE GAME'S OWN BOTTOM BAR (G1-a, 2026-11-14): what the shell's dock said before it moved
 * onto the kit \u2014 a place keeps saying what waits behind it, and the bar can stand
 * see-through over the galaxy or sit in a desk's top bar.
 */
describe('the bottom bar, as the game\u2019s dock', () => {
  const places = [{ id: 'galaxy', label: 'Galaxy' }, { id: 'base', label: 'Base' }, { id: 'fleet', label: 'Fleet' }];

  it('hands a press on the open place to onReselect, never to onChange', () => {
    const onChange = vi.fn();
    const onReselect = vi.fn();
    render(<BottomNav label="Main" items={places} value="galaxy" onChange={onChange} onReselect={onReselect} />);
    press(screen.getByRole('button', { name: 'Galaxy' }));
    expect(onReselect).toHaveBeenCalledWith('galaxy');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('marks no place while a page from elsewhere is open', () => {
    render(<BottomNav label="Main" items={places} value={null} onChange={vi.fn()} />);
    expect(screen.getAllByRole('button').filter((button) => button.hasAttribute('aria-current'))).toHaveLength(0);
  });

  it('says what waits behind a place after its name', () => {
    render(<BottomNav label="Main" items={[{ id: 'intel', label: 'Intel', badge: 3, said: 'New reports: 3' }]} value={null} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Intel \u00b7 New reports: 3' })).toHaveTextContent('3');
  });

  it('counts a state quietly, apart from the red of news', () => {
    const { container } = render(<BottomNav label="Main" items={[{ id: 'fleet', label: 'Fleet', tally: 2 }]} value={null} onChange={vi.fn()} />);
    expect(container.querySelector('[data-tally]')).toHaveTextContent('2');
    expect(container.querySelector('.gk-dot')).toBeNull();
  });

  it('dots a place with a gap to close, with no number', () => {
    const { container } = render(<BottomNav label="Main" items={[{ id: 'base', label: 'Base', warn: true }]} value={null} onChange={vi.fn()} />);
    expect(container.querySelector('[data-warn]')).toBeEmptyDOMElement();
  });

  it('rings a place toward its next event, and draws no ring without one', () => {
    const { container, rerender } = render(<BottomNav label="Main" items={[{ id: 'fleet', label: 'Fleet', progress: 0.4 }]} value={null} onChange={vi.fn()} />);
    expect(container.querySelector('[data-ring]')).toHaveAttribute('data-progress', '0.4');
    rerender(<BottomNav label="Main" items={[{ id: 'fleet', label: 'Fleet', progress: null }]} value={null} onChange={vi.fn()} />);
    expect(container.querySelector('[data-ring]')).toBeNull();
  });

  it('shines a place that has just opened, with its word', () => {
    render(<BottomNav label="Main" items={[{ id: 'base', label: 'Base', fresh: 'New' }]} value={null} onChange={vi.fn()} />);
    const base = screen.getByRole('button', { name: /Base/ });
    expect(base).toHaveAttribute('data-fresh');
    expect(base).toHaveTextContent('New');
  });

  it('keeps a place that does nothing in its place, inert', () => {
    const onChange = vi.fn();
    render(<BottomNav label="Main" items={[...places, { id: 'clan', label: 'Clan', disabled: true }]} value="galaxy" onChange={onChange} />);
    const clan = screen.getByRole('button', { name: 'Clan' });
    expect(clan).toBeDisabled();
    press(clan);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getAllByRole('button')).toHaveLength(4);
  });

  it('lets a lesson find a place and names the key that opens it', () => {
    render(<BottomNav label="Main" items={[{ id: 'base', label: 'Base', guide: 'dock-base', shortcut: '2' }]} value={null} onChange={vi.fn()} />);
    const base = screen.getByRole('button', { name: 'Base' });
    expect(base).toHaveAttribute('data-guide', 'dock-base');
    expect(base).toHaveAttribute('aria-keyshortcuts', '2');
    expect(base.querySelector('kbd')).toBeNull();
  });

  /** Owner, 2026-09-24: over the galaxy the bar lets the scene through. */
  it('stands see-through when clear, on its metal otherwise', () => {
    const { rerender } = render(<BottomNav label="Main" items={places} value="galaxy" onChange={vi.fn()} clear />);
    expect(screen.getByRole('navigation')).toHaveAttribute('data-clear');
    rerender(<BottomNav label="Main" items={places} value="base" onChange={vi.fn()} />);
    expect(screen.getByRole('navigation')).not.toHaveAttribute('data-clear');
  });

  /** E11 \u00b7 K10: on a desk the same places sit in the top bar, each with its key. */
  it('sits in a desk\u2019s top bar with each place\u2019s key, never see-through', () => {
    render(<BottomNav label="Main" items={places.map((place, index) => ({ ...place, shortcut: String(index + 1) }))} value="galaxy" onChange={vi.fn()} bar clear />);
    const nav = screen.getByRole('navigation');
    expect(nav).toHaveAttribute('data-bar');
    expect(nav).not.toHaveAttribute('data-clear');
    expect(within(nav).getAllByRole('button').map((button) => button.querySelector('kbd')?.textContent)).toEqual(['1', '2', '3']);
  });
});

describe('the bottom bar\u2019s locked word', () => {
  it('says what opens a locked place, then clears by itself', () => {
    vi.useFakeTimers();
    try {
      render(<BottomNav label="Main" items={[{ id: 'galaxy', label: 'Galaxy' }, { id: 'clan', label: 'Clan', locked: 'Shipyard 2' }]} value="galaxy" onChange={vi.fn()} />);
      press(screen.getByRole('button', { name: /Clan/ }));
      expect(screen.getByRole('status')).toHaveTextContent('Shipyard 2');
      act(() => { vi.advanceTimersByTime(3_000); });
      expect(screen.queryByRole('status')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('the info peek', () => {
  it('shows the fact and opens the rule in place', () => {
    render(<InfoPeek fact="Lance-heavy target" rule="Lance beats Skirmisher." />);
    expect(screen.getByText('Lance-heavy target')).toBeVisible();
    expect(screen.queryByText('Lance beats Skirmisher.')).toBeNull();
    const toggle = screen.getByRole('button', { expanded: false });
    press(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Lance beats Skirmisher.')).toBeVisible();
  });

  /** Several peeks on one screen: a reader must hear which rule each "?" opens. */
  it('names its toggle for the fact it explains, when told', () => {
    render(<InfoPeek fact="0 HP/min" rule="Aegis guards ships here." about="About planet radiation protection" />);
    expect(screen.getByRole('button', { name: 'About planet radiation protection' })).toHaveAttribute('aria-expanded', 'false');
  });
});
