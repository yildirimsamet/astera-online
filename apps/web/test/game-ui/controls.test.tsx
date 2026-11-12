import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { BottomNav, GameTabs, InfoPeek, Lever, Slider, Toggle } from '../../src/game-ui/index.js';

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

  it('carries its id for a lesson that points at it', () => {
    render(<GameTabs label="Base" tabs={five} value="grow" onChange={vi.fn()} />);
    expect(screen.getByRole('tab', { name: 'Defend' })).toHaveAttribute('data-tab', 'defend');
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
