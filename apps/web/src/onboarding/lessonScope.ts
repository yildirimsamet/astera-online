import { createContext, useContext } from 'react';
import { ACADEMY_STEPS, type AcademyStepId } from '@astera/rules';
import type { PlanetGroup } from '../lib/directives.js';

/** Private presentation scope; no game API or persistent device preferences. */
export const AcademyLessonContext = createContext<AcademyStepId | null>(null);
export const useAcademyLesson = () => useContext(AcademyLessonContext);

/** The newest revealed tab; an introductory tab press still shows the previous panel. */
export function academyGroup(id: AcademyStepId): PlanetGroup {
  const step = ACADEMY_STEPS.findIndex((s) => s.id === id);
  return step < 10 ? 'grow' : step < 15 ? 'orbit' : step < 22 ? 'defend' : 'reach';
}
