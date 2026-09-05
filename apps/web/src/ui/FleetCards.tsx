import { MOBILE_HULLS, type MobileHullId } from '@astera/rules';
import { useTranslation } from 'react-i18next';
import { hullLabel } from '../i18n/names.js';
import { familyGroups } from '../lib/roster.js';
import { HULL_ART } from './assets.js';

/**
 * THE WHOLE FORCE, DRAWN, ON THE WORLD'S OWN SHEET. D170, owner request.
 *
 * The planet sheet stated what stood on the ground and what the shield held, and
 * then stopped. A commander wanting to know what they FLY had to leave for the
 * fleet tab and read nineteen rows — which is four screens of scrolling to answer
 * "what have I got", the most ordinary question there is. The force is a fact
 * about this world, so it belongs under the two verdicts about this world.
 *
 * DRAWN, NOT WRITTEN, because D142 says quantities a player must judge are drawn:
 * a hull's own art is how a commander recognises it at a glance, and a grid of
 * pictures is read in one pass where a column of names is read line by line.
 *
 * HOME AND AWAY ARE SEPARATE FIGURES, and that is the whole reason this is worth
 * drawing. Six Darts are a defence if they are standing here and an exposure if
 * they are three hours out; a single total hides exactly the thing being asked.
 * A hull with nothing in the air simply has no away figure — a zero would be a
 * second number to read for no information.
 *
 * `roster.ts` is the only statement of the band order, read here as it is by the
 * Fleet tab and the launch picker. An empty band is never drawn.
 */
export function FleetCards({
  fleet,
  fleetAway,
}: {
  fleet: Partial<Record<string, number>>;
  fleetAway: Partial<Record<string, number>>;
}) {
  const { t } = useTranslation();

  const owned = (id: MobileHullId) => (fleet[id] ?? 0) + (fleetAway[id] ?? 0);
  const groups = familyGroups(MOBILE_HULLS.filter((id) => owned(id) > 0));
  if (groups.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {groups.map(({ family, hulls }) => (
        <div key={family} data-testid={`fleet-band-${family}`} data-family={family}>
          <p className="legend mb-1">{t(`planet.reach.family.${family}.label`)}</p>
          <div className="grid grid-cols-3 gap-1.5">
            {hulls.map((id) => {
              const home = fleet[id] ?? 0;
              const away = fleetAway[id] ?? 0;
              const art = HULL_ART[id];
              return (
                <div
                  key={id}
                  data-testid={`fleet-card-${id}`}
                  className="plate flex flex-col gap-1 p-1.5"
                >
                  {/*
                    ART AND FIGURES ON ONE LINE, THE NAME ON ITS OWN.

                    Three cards across a 375px sheet leaves about 115px each, and
                    a name sharing that line with a 28px thumbnail would be cut to
                    six characters. The name gets the full width instead; the
                    picture is what identifies the hull at a glance anyway, and
                    the name is what confirms it.

                    HOME IN THE READING COLOUR, AWAY DIMMED AND GLYPHED. Two facts,
                    no labels: the arrow says "out", and a hull that is entirely
                    home draws nothing after its own number.
                  */}
                  <div className="flex items-center gap-1.5">
                    {art !== null && (
                      <img
                        src={art}
                        alt=""
                        aria-hidden="true"
                        className="size-7 shrink-0 rounded-chip object-cover"
                      />
                    )}
                    <span className="flex min-w-0 items-baseline gap-1">
                      <span data-testid={`fleet-home-${id}`} className="readout">{home}</span>
                      {away > 0 && (
                        <span
                          data-testid={`fleet-away-${id}`}
                          className="text-caption text-faint"
                          title={t('planetHero.fleetAway', { count: away })}
                        >
                          ↗{away}
                        </span>
                      )}
                    </span>
                  </div>
                  <span className="name block truncate">{hullLabel(id)}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
