import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { openingProgress } from '@astera/rules';
import { ShipHero } from '../src/starter/ShipHero.js';
import { StarterGoal, StarterGoalPulse } from '../src/starter/tutorial/visualGoal.js';
vi.mock('../src/lib/sound.js', () => ({ playSound: vi.fn() }));
afterEach(cleanup);
it('pulses only the first visible enabled goal and remembers an unrecorded press without gating anything', () => {
  const ack = vi.fn(), other = vi.fn();
  const view = render(<><button data-guide="works" disabled>hidden</button><button data-guide="works">works</button><button onClick={other}>free</button><StarterGoalPulse tutorial={{ action: {kind:'step',id:'collect',step:'press',chapter:1,marks:['[data-guide="works"]']},answer:{kind:'done'},ack,backIn:0 }} /></>);
  expect(document.querySelectorAll('[data-starter-next]')).toHaveLength(1);
  fireEvent.click(document.querySelector('[data-starter-next]')!);
  expect(ack).toHaveBeenCalledWith('collect');
  fireEvent.click(view.getByText('free'));expect(other).toHaveBeenCalledOnce();
  view.unmount();expect(document.querySelector('[data-starter-next]')).toBeNull();
});
it('leaves the officer as the only pointing source while its card is visible', () => {
  render(<><div data-school-coach/><button data-guide="works"/><StarterGoalPulse tutorial={{action:{kind:'step',id:'collect',step:'press',chapter:1,marks:['[data-guide="works"]']},answer:{kind:'done'},ack:vi.fn(),backIn:0}}/></>);
  expect(document.querySelector('[data-starter-next]')).toBeNull();
});

it('lights the next damaged machine on the ship itself', () => {
 const view=render(<StarterGoal.Provider value={{kind:'step',id:'orderAntenna',step:'press',chapter:3,marks:[]}}><ShipHero id="ship-1" progress={openingProgress()} selected="REFINERY" onSelect={vi.fn()}/></StarterGoal.Provider>);
 const nodes=view.container.querySelectorAll('[data-testid="ship-hero"] svg line');
 expect(nodes[1]?.getAttribute('stroke')).toBe('var(--color-v2-self)');
 const mark=view.getByRole('button',{name:'Survey antenna'});
 expect(mark.querySelector('[style]')?.getAttribute('style')).toContain('var(--color-v2-self)');
 expect(nodes[2]?.getAttribute('stroke')).toBe('var(--color-v2-hostile)');
});
