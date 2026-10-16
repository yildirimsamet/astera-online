import { MONUMENT_BALANCE, RADIATION_SHIELDING_RULESET } from '@astera/rules';

interface RadiationSeason {
  rulesetVersion: number;
  startsAt: Date;
  monumentRadiationStartsAt?: Date | null;
}

export const monumentRadiationStart = (season: RadiationSeason): Date | undefined =>
  season.monumentRadiationStartsAt ?? (season.rulesetVersion >= RADIATION_SHIELDING_RULESET ? season.startsAt : undefined);

export const LEGACY_MONUMENT_HP_PER_MINUTE = { EASY: 2, HARD: 5 } as const;

/** Only explicit old-season seeding retains the original 2/5 HP/min source rates. */
export const monumentBaseRadiation = (difficulty: 'EASY' | 'HARD', season: RadiationSeason) => ({
  radiationLevel: MONUMENT_BALANCE[difficulty].radiationLevel,
  intensityHpPerMinute: monumentRadiationStart(season)
    ? MONUMENT_BALANCE[difficulty].intensityHpPerMinute : LEGACY_MONUMENT_HP_PER_MINUTE[difficulty],
});
