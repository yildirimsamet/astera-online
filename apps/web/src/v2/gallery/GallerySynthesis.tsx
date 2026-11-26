import { useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import type { SynthesisView } from '../../api/schemas.js';
import { SynthesisLab } from '../../screens/SynthesisLab.js';

/** Sentez Laboratuvarı in the gallery (plan 2026-11-24): the season and the laboratory read seeded, nothing fetched. */
export type SynthesisGalleryState = 'idle' | 'running';

const MIN = 60_000;
export const GALLERY_CAPSULES = { OPTIC_VEIL: 3, SILENT_THRUST: 1 } as const;

const lab = (state: SynthesisGalleryState, now: number): SynthesisView => ({
  enabled: true, requiredCore: 10, coreLevel: 10, unlocked: true, asterium: 14, perDay: 7,
  moons: [
    { planetId: 'p-1', planetName: 'Vega', rarity: 'RARE', perDay: 3, closedUntil: null, nextAt: null },
    { planetId: 'p-2', planetName: 'Kestrel', rarity: 'EPIC', perDay: 4, closedUntil: null, nextAt: null },
  ],
  capsules: { ...GALLERY_CAPSULES },
  job: state === 'running'
    ? { capsuleId: 'SILENT_THRUST', quantity: 8, delivered: 3, startedAt: new Date(now - 220 * MIN), nextAt: new Date(now + 20 * MIN), completesAt: new Date(now + 260 * MIN) }
    : null,
  storm: { active: false, startsAt: new Date(now + 95 * MIN), endsAt: new Date(now + 155 * MIN) },
});

/** Seeds the reads a capsule surface takes, once, before the surface mounts. */
export function SynthesisSeed({ state = 'idle', children }: { state?: SynthesisGalleryState; children: ReactNode }) {
  const client = useQueryClient();
  useState(() => {
    const season = client.getQueryData<Record<string, unknown>>(['season']) ?? {};
    client.setQueryData(['season'], { ...season, features: { moons: true, synthesis: true } });
    client.setQueryData(['synthesis'], lab(state, Date.now()));
    return null;
  });
  return <>{children}</>;
}

export function GallerySynthesis({ state }: { state: SynthesisGalleryState }) {
  return (
    <SynthesisSeed state={state}>
      <div className="mx-auto max-w-[420px] p-3">
        <SynthesisLab held={{ alloy: 60_000, crystal: 80_000, deuterium: 9_000 }} />
      </div>
    </SynthesisSeed>
  );
}
