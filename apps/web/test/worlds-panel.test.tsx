import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WorldsPanel } from '../src/screens/WorldsPanel.js';
import { planetView } from './fixtures.js';

const capital = planetView(
  { fleet: { DART: 4, COURIER: 1 }, ground: { THORN: 2 }, flight: { used: 1, total: 3 } },
  { id: 'capital-1', name: 'Kestrel-12', alloy: 9_400, crystal: 2_100, deuterium: 60 },
);
const haven = planetView(
  { fleet: { DART: 2 }, ground: {}, flight: { used: 0, total: 3 } },
  { id: 'colony-1', name: 'Haven', alloy: 300, crystal: 80, deuterium: 0 },
);
const orlo = planetView(
  { fleet: {}, ground: {}, flight: { used: 2, total: 3 } },
  { id: 'colony-2', name: 'Orlo', alloy: 12, crystal: 4, deuterium: 0 },
);

const panel = (over: Partial<Parameters<typeof WorldsPanel>[0]> = {}) => (
  <WorldsPanel
    worlds={[capital, haven, orlo]}
    activePlanetId="capital-1"
    capitalPlanetId="capital-1"
    onSelect={vi.fn()}
    onTransfer={vi.fn()}
    onClose={vi.fn()}
    {...over}
  />
);

/**
 * The world list, never the source selector. Both print the same three names, so
 * every query here is scoped to the list first — otherwise "Haven" is ambiguous
 * and the failure reads as a missing element rather than a duplicated one.
 */
const list = () => screen.getByRole('list', { name: /your worlds/i });
const row = (name: string): HTMLElement => {
  const item = within(list()).getByText(name).closest('li');
  if (!item) throw new Error(`no row for ${name}`);
  return item;
};
/** The row body itself: its accessible name STARTS with the world's name. */
const openRow = (name: string) =>
  within(row(name)).getByRole('button', { name: new RegExp(`^${name}`) });
const from = () => screen.getByRole<HTMLSelectElement>('combobox', { name: /from/i });
const to = () => screen.getByRole<HTMLSelectElement>('combobox', { name: /to/i });
const send = () => screen.getByRole('button', { name: /^transfer$/i });

/**
 * THE PANEL EXISTS BECAUSE THE DISC IS NOT A LIST. T3.
 *
 * Switching worlds and moving things between them both used to require finding a
 * second world by eye on a 3D disc and tapping it — which is a fine way to look at
 * a galaxy and a poor way to answer "which of my worlds has the alloy". The old
 * route is untouched (D118); this is a second door onto the same two verbs.
 */
describe('the worlds panel', () => {
  it('names every world and says which kind it is', () => {
    render(panel());

    for (const name of ['Kestrel-12', 'Haven', 'Orlo']) {
      expect(within(list()).getByText(name)).toBeInTheDocument();
    }
    // The capital is the one world that cannot be taken, and the list says so.
    expect(within(row('Kestrel-12')).getByText(/capital/i)).toBeInTheDocument();
    expect(within(row('Haven')).getByText(/colony/i)).toBeInTheDocument();
  });

  /**
   * The figures a commander is actually choosing between. Without them the list
   * is a menu of names and the player still has to visit each world to decide.
   */
  it('carries the stock, the craft and the flight bays of each world', () => {
    render(panel());

    const capitalRow = row('Kestrel-12');
    expect(within(capitalRow).getByText('9.4k')).toBeInTheDocument();
    expect(within(capitalRow).getByText('2.1k')).toBeInTheDocument();
    // Five at home plus two guns, and one bay of three already flying.
    expect(within(capitalRow).getByText(/7 craft/i)).toBeInTheDocument();
    /*
      THE BAYS ARE A RACK NOW, NOT A FRACTION. D142: "1 / 3" is the one figure on
      this row a commander reads to decide whether they can launch at all, and
      three marks answer it without being parsed. The count survives as the
      accessible name, which is where a screen reader needs the digits.
    */
    expect(within(capitalRow).getByRole('img', { name: /1 of 3 flight bays/i }))
      .toBeInTheDocument();
  });

  /**
   * THIS PANEL'S WHOLE REASON FOR EXISTING: "which of mine has the alloy".
   *
   * Three bare figures per row made that a comparison across nine numbers. Each
   * store is a quantity against a ceiling, so each gets the meter the header has
   * drawn since the first session — and the answer is then the longest bar.
   */
  it('draws every store against its own ceiling, so the rows compare by eye', () => {
    render(panel());

    const capitalRow = row('Kestrel-12');
    const meters = within(capitalRow).getAllByRole('meter');
    expect(meters).toHaveLength(3);
    expect(within(capitalRow).getByRole('meter', { name: /alloy: 9\.4k of/i }))
      .toBeInTheDocument();
  });

  it('marks the world that is currently active', () => {
    render(panel({ activePlanetId: 'colony-1' }));

    expect(within(row('Haven')).getByText(/active/i)).toBeInTheDocument();
    expect(within(row('Kestrel-12')).queryByText(/active/i)).not.toBeInTheDocument();
  });

  /**
   * ONE GESTURE, BOTH EFFECTS. The camera and the active world move together or
   * the player ends up managing one world while looking at another — the split
   * `StatusBar` already carries a comment about.
   */
  it('focuses and activates a world in a single tap, then gets out of the way', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(panel({ onSelect, onClose }));

    await user.click(openRow('Haven'));

    expect(onSelect).toHaveBeenCalledWith('colony-1');
    expect(onClose).toHaveBeenCalled();
  });

  /**
   * THE CAMERA MOVE LEFT THIS SHEET ENTIRELY. D163.
   *
   * "Zoom in on the active planet" was a text button at the top of a list, which
   * is two taps and a read for the most frequent camera move in the game — behind
   * a glyph on the disc that already looked exactly like it. The glyph does it now
   * (`DiscControls`), and nothing here offers it.
   */
  it('offers no camera control of its own', () => {
    render(panel());
    expect(screen.queryByRole('button', { name: /active planet/i })).not.toBeInTheDocument();
  });

  /**
   * TWO DROPDOWNS AND ONE BUTTON. Owner instruction, D163: *"tablı sistem ile
   * değil dropdown ile nereden -> nereye şeklinde anlaması daha basit."*
   *
   * The old shape asked the same question in two unrelated places — a segmented
   * control at the top picked the SOURCE, and then one of three identical "send
   * here" buttons further down the list picked the DESTINATION, with the two ends
   * of one sentence separated by three world rows. A commander had to work out
   * that the tabs and the buttons were the same decision.
   *
   * Written as `from → to` in one line, the sentence reads itself, both ends are
   * visible at once, and there is exactly one control that commits.
   */
  describe('starting a transfer', () => {
    /**
     * THE ACTIVE WORLD DOES NOT MOVE. That is the whole point of the second door:
     * `POST /api/fleet/transfer` has taken an explicit origin since D118, so the
     * panel can name both ends without making the player stand on one of them.
     */
    it('sends from the chosen source to the chosen target, and moves neither', async () => {
      const user = userEvent.setup();
      const onTransfer = vi.fn();
      const onSelect = vi.fn();
      render(panel({ onTransfer, onSelect }));

      await user.selectOptions(to(), 'colony-1');
      await user.click(send());

      expect(onTransfer).toHaveBeenCalledWith('capital-1', 'colony-1');
      expect(onSelect).not.toHaveBeenCalled();
    });

    /** The world they are standing on is the source nine times out of ten. */
    it('opens on the active world as the source', () => {
      render(panel({ activePlanetId: 'colony-2' }));
      expect(from().value).toBe('colony-2');
    });

    /**
     * NOTHING MAY BE SENT TO ITSELF. The server refuses it as `SELF_TRANSFER`, and
     * an option that cannot be committed is not offered — the destination list is
     * every world EXCEPT the source, and it re-picks itself the moment the source
     * becomes what the destination was.
     */
    it('never offers the source as its own destination', async () => {
      const user = userEvent.setup();
      render(panel());

      expect([...to().options].map((option) => option.value)).toEqual(['colony-1', 'colony-2']);

      await user.selectOptions(from(), 'colony-1');
      expect([...to().options].map((option) => option.value)).toEqual(['capital-1', 'colony-2']);
      expect(to().value).not.toBe('colony-1');
    });

    it('commits whatever the two dropdowns are showing', async () => {
      const user = userEvent.setup();
      const onTransfer = vi.fn();
      render(panel({ onTransfer }));

      await user.selectOptions(from(), 'colony-1');
      await user.selectOptions(to(), 'colony-2');
      await user.click(send());

      expect(onTransfer).toHaveBeenCalledWith('colony-1', 'colony-2');
    });

    /**
     * A commander with one world has nowhere to send anything, and two dropdowns
     * over a list of one decide nothing. The list still has to work — it is also
     * how they switch between worlds.
     */
    it('shows no transfer machinery at all to a commander with one world', () => {
      render(panel({ worlds: [capital] }));

      expect(within(list()).getByText('Kestrel-12')).toBeInTheDocument();
      expect(screen.queryByRole('combobox', { name: /from/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^transfer$/i })).not.toBeInTheDocument();
    });
  });
});
