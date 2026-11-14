import { MOBILE_HULLS, type MobileHullId } from '@astera/rules';
import { useTranslation } from 'react-i18next';
import { hullLabel } from '../i18n/names.js';
import { useAccordion } from '../lib/accordion.js';
import { familyGroups } from '../lib/roster.js';
import { HULL_ART } from './assets.js';
import { Glyph } from '../game-ui/index.js';
import { haptic } from '../lib/haptics.js';
import { OWN_SOUND, playSound } from '../lib/sound.js';

/**
 * THE WHOLE FORCE, DRAWN, ON THE WORLD'S OWN SHEET. D170, owner request.
 *
 * The planet sheet stated what stood on the ground and what the shield held, and
 * then stopped. A commander wanting to know what they FLY had to leave for the
 * fleet tab and read nineteen rows — four screens of scrolling to answer "what
 * have I got", the most ordinary question there is.
 *
 * SMALL ENOUGH TO BE A GLANCE, AND FOLDED ON TOP OF THAT. The first version drew
 * cards: a plate, padding, a 28px thumbnail and two lines each, three across. The
 * owner's report is what that produced — *"her kategoriden 3-5 gemim olsa çok yer
 * kaplıyor"* — a block meant to save a trip to another tab that had to be scrolled
 * past instead. So the card is gone entirely. What is left is the smallest thing
 * that still answers the question: a small hull, its name and the two figures, on
 * one line, with no container around it.
 *
 * ON THE KIT SINCE G2-g (2026-11-14). The owner once asked for 8 px and it was 9; the
 * game's type floor is 12 px now (standard 2.2), so the names sit at the floor and the
 * figures one step above, and the band heads are 44 px doors.
 *
 * WRAPPED, NOT GRIDDED. A grid pays the widest name's width for every hull; a wrap
 * lets "Ok" cost two characters and fits five or six chips on a 350px line where
 * three cards used to sit.
 *
 * DRAWN, NOT WRITTEN, because D142 says quantities a player must judge are drawn:
 * a hull's own art is how a commander recognises it at a glance, and at 16px it is
 * still the fastest mark on the row to read.
 *
 * HOME AND AWAY ARE SEPARATE FIGURES, and that is the whole reason this is worth
 * drawing. Six Darts are a defence if they are standing here and an exposure if
 * they are three hours out; a single total hides exactly the thing being asked. A
 * hull with nothing in the air simply has no away figure — a zero would be a
 * second number to read for no information.
 *
 * `roster.ts` is the only statement of the band order, read here as it is by the
 * Fleet tab and the launch picker. An empty band is never drawn.
 */
export function FleetCards({
  fleet,
  fleetAway,
  fleetDocked = {},
}: {
  fleet: Partial<Record<string, number>>;
  fleetAway: Partial<Record<string, number>>;
  /** Waiting in the Repair Station: owned, neither home nor away (Kalıcı gemi hasarı). */
  fleetDocked?: Partial<Record<string, number>>;
}) {
  const { t } = useTranslation();

  const owned = (id: MobileHullId) => (fleet[id] ?? 0) + (fleetAway[id] ?? 0) + (fleetDocked[id] ?? 0);
  const groups = familyGroups(MOBILE_HULLS.filter((id) => owned(id) > 0));
  /*
    ONE OPEN, THE REST SHUT AND COUNTED — the shape the Fleet tab and the launch
    picker already use. Seeded with the FIRST band that has anything in it rather
    than a fixed family, so a commander holding only transports does not arrive on
    an empty Offensive heading. Its own surface key, because which band a player
    wants open here is not the one they want open while shopping for hulls.
  */
  const families = useAccordion('fleet-cards', groups[0] ? [groups[0].family] : []);
  if (groups.length === 0) return null;

  return (
    <div className="gk-fleetbands">
      {groups.map(({ family, hulls }) => {
        const open = families.isOpen(family);
        const total = hulls.reduce((sum, id) => sum + owned(id), 0);
        return (
          <div key={family} data-testid={`fleet-band-${family}`} data-family={family} className="gk-fleetband">
            {/*
              THE HEADING IS THE WHOLE OF A SHUT BAND, so it carries the count: a
              fold that hides its contents without saying how much it is hiding is
              a fold a commander has to open to find out whether it was worth
              opening.
            */}
            <button
              type="button"
              {...OWN_SOUND}
              aria-expanded={open}
              className="gk-fleetband__head"
              onClick={() => { playSound('tap'); haptic('tap'); families.toggle(family); }}
            >
              <Glyph id={open ? 'down' : 'next'} />
              <span className="gk-label">{t(`planet.reach.family.${family}.label`)}</span>
              <span className="gk-fleetband__count gk-num">{total}</span>
            </button>
            {open && (
              <div className="gk-fleetband__chips">
                {hulls.map((id) => {
                  const home = fleet[id] ?? 0;
                  const away = fleetAway[id] ?? 0;
                  const docked = fleetDocked[id] ?? 0;
                  const art = HULL_ART[id];
                  return (
                    <span key={id} data-testid={`fleet-card-${id}`} className="gk-fleetchip">
                      {art !== null && <img src={art} alt="" aria-hidden="true" className="gk-fleetchip__art" />}
                      <span className="gk-fleetchip__name">{hullLabel(id)}</span>
                      <span data-testid={`fleet-home-${id}`} className="gk-fleetchip__home gk-num">{home}</span>
                      {/*
                        THE ARROW IS THE LABEL. One glyph says "out" in every
                        language this game ships, and at this size a word would
                        cost more room than the figure it describes.
                      */}
                      {away > 0 && (
                        <span data-testid={`fleet-away-${id}`} className="gk-fleetchip__away gk-num"
                          title={t('planetHero.fleetAway', { count: away })}>
                          <Glyph id="up" />{away}
                        </span>
                      )}
                      {/* Waiting for repair: the reason the home figure is short. */}
                      {docked > 0 && (
                        <span data-testid={`fleet-docked-${id}`} className="gk-fleetchip__docked gk-num"
                          title={t('repairStation.docked', { count: docked })}>
                          <Glyph id="repair" />{docked}
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
