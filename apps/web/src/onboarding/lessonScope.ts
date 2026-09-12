import { createContext, useContext } from 'react';
import { ACADEMY_STEPS, type AcademyStepId } from '@astera/rules';
import type { PlanetGroup } from '../lib/directives.js';

/** Private presentation scope; no game API or persistent device preferences. */
export const AcademyLessonContext = createContext<AcademyStepId | null>(null);
export const useAcademyLesson = () => useContext(AcademyLessonContext);

/** The newest revealed tab; boundaries follow the authored menu introductions,
 * so moving a lesson between phases cannot strand it on its former tab. */
export function academyGroup(id: AcademyStepId): PlanetGroup {
  const step = ACADEMY_STEPS.findIndex((s) => s.id === id);
  const intel = ACADEMY_STEPS.findIndex((s) => s.id === 'intel');
  const defend = ACADEMY_STEPS.findIndex((s) => s.id === 'defend');
  const fleet = ACADEMY_STEPS.findIndex((s) => s.id === 'fleet');
  return step < intel ? 'grow' : step < defend ? 'orbit' : step < fleet ? 'defend' : 'reach';
}
