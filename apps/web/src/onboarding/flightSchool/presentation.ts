import { createContext, useContext } from 'react';
import type { Fleet } from '@astera/rules';
import type { SchoolFrame, SchoolTransit } from './visualStory.js';

/** Local quotes and picker limits for the private exercise. Never changes a
 * commander's real rules, prices, or saved UI preferences. */
export const SchoolPresentationContext = createContext<{
  orderSeconds: number; legSeconds: number;
  order?: { subject: string; count: number };
  fleet?: Fleet;
  pausedIncoming?: boolean;
  overview?: SchoolFrame;
  transit?: SchoolTransit;
} | null>(null);
export const useSchoolPresentation = () => useContext(SchoolPresentationContext);
