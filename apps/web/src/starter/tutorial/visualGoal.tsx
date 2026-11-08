import { REPAIR_LADDER, type RepairStep } from '@astera/rules';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { haptic } from '../../lib/haptics.js';
import { SchoolPointer } from '../../onboarding/flightSchool/SchoolPointer.js';
import type { Opportunity } from '../opportunities.js';
import { ROAD, adviceMarks, type TutorialAnswer, type TutorialStep, type TutorialStepId, type TutorialView } from './script.js';
import { ACK_ON_PRESS, ackAfterPress, type StarterTutorial } from './useStarterTutorial.js';
import './visualGoal.css';

export const StarterLesson = createContext<TutorialAnswer | null>(null);
export const useStarterLesson = () => useContext(StarterLesson);

/**
 * WHAT THE MARKS FOLLOW (plan F3, N1). The guide's step while it speaks; after the core, what the
 * player picked from the advisor, or its first offer until they pick (owner item Z2: a player without
 * the officer still sees where the next thing is done). The hand is the guide's, for a pick only.
 */
export interface StarterGoalValue {
  /** The guide's step, only while the guide is on. */
  step: TutorialStep | null;
  choice: Opportunity | null;
  /** The choice is the player's own pick, not the advisor's first offer. */
  picked: boolean;
  guided: boolean;
  view: TutorialView;
}
export const StarterGoal = createContext<StarterGoalValue | null>(null);
export const useStarterGoal = () => useContext(StarterGoal);

export function starterGoal(tutorial: Pick<StarterTutorial, 'answer' | 'offers' | 'pick' | 'view'>, guided: boolean): StarterGoalValue {
  return {
    step: guided && tutorial.answer.kind === 'step' ? tutorial.answer : null,
    choice: tutorial.pick ?? tutorial.offers[0] ?? null,
    picked: tutorial.pick !== undefined,
    guided,
    view: tutorial.view,
  };
}

const NONE = { marks: [] as readonly string[], hand: false };

/** The real controls to light, the way there first. The guide's card draws its own hand. */
export function goalMarks(goal: StarterGoalValue | null): { marks: readonly string[]; hand: boolean } {
  if (!goal) return NONE;
  if (goal.step) return goal.step.step === 'press' ? { marks: goal.step.marks, hand: false } : NONE;
  if (!goal.choice) return NONE;
  const { marks } = adviceMarks(goal.choice, goal.view);
  return marks.length === 0 ? NONE : { marks, hand: goal.picked && goal.guided };
}

/** The repair a step of the guide is about, read off its own mark rather than the way to it. */
const stepRepair = (step: TutorialStep): RepairStep | undefined => {
  const mark = ROAD.find(s => s.id === step.id)?.marks[0];
  return REPAIR_LADDER.find(s => mark?.includes(`[data-step="${s.module}:${String(s.stage)}"]`));
};

/** The machine to light: the guide's repair while it speaks, else the one chosen or saved for. */
export function goalRepair(goal: StarterGoalValue | null): RepairStep | undefined {
  if (!goal) return undefined;
  if (goal.step) return stepRepair(goal.step);
  return goal.choice?.kind === 'repair' || goal.choice?.kind === 'save' ? goal.choice.step : undefined;
}

/** How often the pulse looks for its control: sheets open and close under it. */
const LOOK_MS = 250;

/** One visible real control. No overlay and no gate: the player keeps every choice. */
export function StarterGoalPulse({ goal, ack }: { goal: StarterGoalValue | null; ack: (id: TutorialStepId) => void }) {
  const { marks, hand } = goalMarks(goal);
  const key = marks.join('|');
  const pressId = goal?.step && ACK_ON_PRESS.includes(goal.step.id) ? goal.step.id : null;
  const marked = useRef<HTMLElement | null>(null);
  const [handOn, setHandOn] = useState<HTMLElement | null>(null);
  const targets = useCallback((): Element[] => (marked.current ? [marked.current] : []), []);
  useEffect(() => {
    if (key === '') return undefined;
    const selectors = key.split('|');
    const clicked = () => { if (pressId) ackAfterPress(ack, pressId); haptic('tap'); };
    const clear = () => {
      marked.current?.removeAttribute('data-starter-next');
      marked.current?.removeEventListener('click', clicked);
      marked.current = null;
      setHandOn(null);
    };
    const refresh = () => {
      let next: HTMLElement | undefined;
      if (!document.querySelector('[data-school-coach], [data-loading-screen]')) {
        for (const selector of selectors) {
          next = [...document.querySelectorAll<HTMLElement>(selector)].find(el => !el.matches(':disabled') && (!('checkVisibility' in el) || el.checkVisibility()));
          if (next) break;
        }
      }
      if (marked.current === (next ?? null)) return;
      clear();
      if (!next) return;
      marked.current = next;
      next.setAttribute('data-starter-next', '');
      next.addEventListener('click', clicked);
      if ('scrollIntoView' in next) next.scrollIntoView({ block: 'nearest' });
      setHandOn(next);
    };
    refresh();
    const timer = window.setInterval(refresh, LOOK_MS);
    return () => { window.clearInterval(timer); clear(); };
  }, [key, pressId, ack]);
  return hand && handOn ? <SchoolPointer targets={targets} /> : null;
}
