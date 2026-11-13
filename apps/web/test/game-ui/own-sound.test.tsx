import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BottomNav, GameButton, GameHold, GameTabs, LanguagePicker, Lever, RewardPod, Slider, Toggle, UnitBay, UnitCard } from '../../src/game-ui/index.js';
import { tapsFor } from '../../src/lib/sound.js';

/*
  ONE PRESS, ONE SOUND (review of stage 2, 2026-11-13). The mixer clicks for every button the game
  has, and each kit control plays its own moment (owner's picks, 2026-11-12): a tab clicks, a lever
  throws, a locked press says no. Before, both sounded, so a refused tab said "yes" over its "no".
  The mixer's click is for buttons with no sound of their own.
*/

describe('the mixer\u2019s click', () => {
  it('sounds for a plain button, never a disabled one', () => {
    render(<><button type="button">Plain</button><button type="button" disabled>Off</button></>);
    expect(tapsFor(screen.getByRole('button', { name: 'Plain' }))).toBe(true);
    expect(tapsFor(screen.getByRole('button', { name: 'Off' }))).toBe(false);
  });

  it('leaves every kit control to its own sound', () => {
    render(
      <>
        <GameButton heavy onPress={() => undefined}>Raise</GameButton>
        <GameHold label="Attack" detail="39 ships" weight="spends" onCommit={() => undefined} />
        <Toggle label="Escort" checked={false} onChange={() => undefined} />
        <Lever label="Speed" options={[{ id: 'a', label: 'Slow' }, { id: 'b', label: 'Fast' }]} value="a" onChange={() => undefined} />
        <Slider label="Dart" value={2} max={4} onChange={() => undefined} />
        <GameTabs label="Clan" tabs={[{ id: 'o', label: 'Overview' }, { id: 'w', label: 'War', locked: 'Clan level 2' }]} value="o" onChange={() => undefined} />
        <BottomNav label="Main" items={[{ id: 'g', label: 'Galaxy' }]} value="g" onChange={() => undefined} />
        <LanguagePicker label="Dil" value="tr" onChange={() => undefined} />
        <UnitCard name="Dart" art="/dart.webp" cls="SKIRMISHER" multiplier={1} home={4} chosen={1} onChange={() => undefined} />
        <UnitBay name="Lance" art="/lance.webp" cls="LANCE" multiplier={1} home={4} chosen={1} selected={false} onSelect={() => undefined} />
        <RewardPod label="Open the pod" onOpen={() => undefined} />
      </>,
    );
    for (const control of [...screen.getAllByRole('button'), ...screen.getAllByRole('tab'), ...screen.getAllByRole('switch'), ...screen.getAllByRole('radio')]) {
      expect(tapsFor(control), control.textContent).toBe(false);
    }
  });
});
