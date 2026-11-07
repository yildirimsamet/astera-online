import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { StarterGoal } from '../src/starter/tutorial/visualGoal.js';
import { StarterWaitLine } from '../src/starter/tutorial/StarterWaitLine.js';
afterEach(()=>{cleanup();vi.useRealTimers();});
it('shows the repair clock and what comes after, without sending the player to an unrelated price',()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-07T07:00:00Z'));
 const view=render(<StarterGoal.Provider value={{kind:'step',id:'waitShipyard',step:'wait',chapter:5,marks:[]}}><StarterWaitLine queue={[{subject:'SHIPYARD',stage:1,startedAt:new Date('2026-11-07T06:58:30Z'),readyAt:new Date('2026-11-07T07:01:30Z')}]}/></StarterGoal.Provider>);
 expect(view.getByTestId('starter-wait-line').textContent).toContain('1m 30s');
 expect(view.getByLabelText('Salvage')).toBeTruthy();
});
