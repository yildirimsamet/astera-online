import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createSandboxWorld } from '@astera/rules/arena';
import { TacticPicker } from '../../src/arena/ClassPicker.js';
import { FlightControls } from '../../src/arena/Controls.js';
import { arenaCopy } from '../../src/arena/copy.js';
import { GAME_KEY, ONE_PRESS_KEYS, createControls } from '../../src/arena/input.js';
import { createHudStore } from '../../src/arena/store.js';

describe('two tactic controls', () => {
  it('binds E and C to their slots while Q remains the signature', () => {
    const controls = createControls(); controls.setTactic('smoke', 'radar');
    controls.keyDown('KeyC'); controls.keyUp('KeyC');
    expect(controls.sample().radar).toBe(true);
    expect(controls.sample().radar).toBe(false);
    controls.keyDown('KeyE'); controls.keyUp('KeyE');
    expect(controls.sample().smoke).toBe(true);
    expect(GAME_KEY.test('KeyC')).toBe(true);
    expect(ONE_PRESS_KEYS).toContain('KeyC');
  });

  it('shows two separate buttons and only cools down the skill that was used', () => {
    const world = createSandboxWorld({ bots: 0, tactic: 'illusion', tactic2: 'radar' });
    world.pilot.tacticCooldown = 240;
    const store = createHudStore(); store.publish(world, 'flight', false, false);
    const view = render(<FlightControls controls={createControls()} store={store} onLand={() => undefined} onCancel={() => undefined} />);
    expect(view.container.querySelector<HTMLButtonElement>('.ac-illusion')?.disabled).toBe(true);
    expect(view.container.querySelector<HTMLButtonElement>('.ac-radar')?.disabled).toBe(false);
    expect(view.container.querySelector('.ac-illusion kbd')?.textContent).toBe('E');
    expect(view.container.querySelector('.ac-radar kbd')?.textContent).toBe('C');
  });

  it('replaces the active slot and swaps the pair when its other skill is picked', () => {
    const picked: string[][] = [];
    const view = render(<TacticPicker c={arenaCopy()} value="smoke" value2="cloak" onPick={(a, b) => { picked.push([a, b]); }} />);
    fireEvent.click(view.container.querySelector('[data-slot="2"]')!);
    fireEvent.click(view.container.querySelector('[data-tactic="radar"]')!);
    expect(picked).toEqual([['smoke', 'radar']]);
    fireEvent.click(view.container.querySelector('[data-tactic="smoke"]')!);
    expect(picked[1]).toEqual(['cloak', 'smoke']);
  });
});
