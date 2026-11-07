import { REPAIR_LADDER } from '@astera/rules';
import { createContext, useContext, useEffect } from 'react';
import { haptic } from '../../lib/haptics.js';
import { ROAD, type TutorialAnswer } from './script.js';
import { ACK_ON_PRESS, type StarterTutorial } from './useStarterTutorial.js';
import './visualGoal.css';

export const StarterLesson = createContext<TutorialAnswer | null>(null);
export const useStarterLesson = () => useContext(StarterLesson);
export const StarterGoal = createContext<TutorialAnswer | null>(null);
export const useStarterGoal = () => useContext(StarterGoal);
export function goalRepair(goal: TutorialAnswer | null) {
  const mark = goal?.kind === 'step' ? ROAD.find(s => s.id === goal.id)?.marks[0] : undefined;
  return REPAIR_LADDER.find(s => mark?.includes(`[data-step="${s.module}:${String(s.stage)}"]`));
}

/** One visible real control. No overlay and no gate: the player keeps every choice. */
export function StarterGoalPulse({ tutorial }: { tutorial: StarterTutorial }) {
  const goal = tutorial.action;
  useEffect(() => {
    let marked: HTMLElement | null = null;
    const clicked = () => { if (goal?.kind === 'step' && ACK_ON_PRESS.includes(goal.id)) tutorial.ack(goal.id); haptic('tap'); };
    const clear = () => { marked?.removeAttribute('data-starter-next'); marked?.removeEventListener('click', clicked); marked = null; };
    const refresh = () => {
      let next: HTMLElement | undefined;
      if (goal?.kind === 'step' && goal.step === 'press' && !document.querySelector('[data-school-coach], [data-loading-screen]')) {
        for (const selector of goal.marks) {
          next = [...document.querySelectorAll<HTMLElement>(selector)].find(el => !el.matches(':disabled') && (!('checkVisibility' in el) || el.checkVisibility()));
          if (next) break;
        }
      }
      if (marked === (next ?? null)) return;
      clear();
      if (next) { marked = next; marked.setAttribute('data-starter-next', ''); marked.addEventListener('click', clicked); if ('scrollIntoView' in marked) marked.scrollIntoView({block:'nearest'}); }
    };
    refresh();
    const timer = window.setInterval(refresh, 250);
    return () => { window.clearInterval(timer); clear(); };
  }, [goal, tutorial.ack]);
  return null;
}
