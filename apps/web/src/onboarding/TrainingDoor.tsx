import { lazy, Suspense, useEffect, useState } from 'react';
import { useApi } from '../api/context.js';
import type { CommunityPolicyConsent } from '../api/communityPolicySchemas.js';
import type { ClaimIntent } from '../api/schemas.js';
import type { CountryCode, VesselHull } from '@astera/rules';

const FlightSchool = lazy(() => import('./flightSchool/FlightSchool.js').then(module => ({ default: module.FlightSchool })));
const Prologue = lazy(() => import('./prologue/Prologue.js').then(module => ({ default: module.Prologue })));
const Handbook = lazy(() => import('./prologue/Handbook.js').then(module => ({ default: module.Handbook })));

/** How long the first screen will wait to be told. It is a choice of two local tutorials, not a login. */
const ASK_MS = 2_500;

/**
 * WHICH TUTORIAL A NEWCOMER GETS. Plan §3.9: the prologue when the server says ships are open; the old
 * school if it says no, says nothing, or cannot be reached, until phase 11 retires it.
 */
export function TrainingDoor(props: {
  onClaim: (username: string, password: string, progress: readonly ClaimIntent[], country?: CountryCode, policy?: CommunityPolicyConsent, hull?: VesselHull) => Promise<void>;
  onSignIn: () => void;
  onLeave: () => void;
  replay?: boolean;
}) {
  const api = useApi();
  const [door, setDoor] = useState<'asking' | 'prologue' | 'school'>('asking');
  useEffect(() => {
    let settled = false;
    const decide = (next: 'prologue' | 'school'): void => {
      if (settled) return;
      settled = true;
      setDoor(next);
    };
    const timer = setTimeout(() => { decide('school'); }, ASK_MS);
    api.authCapabilities().then(
      (answer) => { decide(answer.starterGalaxy === true ? 'prologue' : 'school'); },
      () => { decide('school'); },
    );
    return () => { settled = true; clearTimeout(timer); };
  }, [api]);
  if (door === 'asking') return <main data-testid="training-door" className="h-dvh w-full bg-v2-void" />;
  return (
    <Suspense fallback={<main className="h-dvh w-full bg-v2-void" />}>
      {door === 'school' ? <FlightSchool {...props} /> : props.replay ? <Handbook onClose={props.onLeave} /> : <Prologue {...props} />}
    </Suspense>
  );
}
