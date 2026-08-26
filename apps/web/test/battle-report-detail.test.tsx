import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Api } from '../src/api/client.js';
import type { BattleReport } from '../src/api/schemas.js';
import { ApiProvider } from '../src/api/context.js';
import { BattleReports } from '../src/screens/BattleReports.js';

/**
 * "THE REPORTS ARE NOT EXPLANATORY ENOUGH" — player complaints, D121.
 *
 * Every one of those complaints turned out to be a number the server had already
 * decided and then thrown away on the way to the screen. A raider who flew home
 * under-loaded could not learn that their own holds, not the defence, capped the
 * haul. A defender told they lost seven Bastions could not learn that four were
 * standing again by the time they read it. "You lost 12 Wasp" had no denominator
 * at all, so a disaster and a rounding error printed identically.
 *
 * What none of it was allowed to do is widen what one side may know about the
 * other, and the case that guards that line is `the fog holds` below.
 */

const base: BattleReport = {
  id: 'b1',
  at: new Date('2026-08-26T12:00:00.000Z'),
  grade: 'PARTIAL',
  attacking: true,
  opponentName: 'Sable',
  opponentPlanet: 'Grimhold',
  opponentPlanetId: 'p2',
  neutral: false,
  yourPlanet: 'Vantage-3',
  rounds: [
    {
      round: 1,
      attackerDamage: 800,
      defenderDamage: 300,
      shieldAbsorbed: 100,
      breacherShieldDamage: 0,
      attackerLosses: { WASP: 2 },
      defenderLosses: { WASP: 6 },
    },
    {
      round: 2,
      attackerDamage: 640,
      defenderDamage: 120,
      shieldAbsorbed: 0,
      breacherShieldDamage: 0,
      attackerLosses: {},
      defenderLosses: { BASTION: 1 },
    },
  ],
  yourLosses: { WASP: 2 },
  theirLosses: { WASP: 6, BASTION: 1 },
  yourFleet: { WASP: 12, HAULER: 3 },
  lootAlloy: 300,
  lootCrystal: 80,
  lootDeuterium: 0,
  dominion: 120,
  shieldAbsorbed: 100,
  cargoLimited: false,
  defenceSalvage: {},
  disruptedMinutes: 0,
  wreckValue: 0,
};

const report = (over: Partial<BattleReport> = {}): BattleReport => ({ ...base, ...over });

async function openSheet(one: BattleReport) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['reports'], { reports: [one] });
  const api = { reports: () => Promise.resolve({ reports: [one] }) } as unknown as Api;
  render(
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>
        <BattleReports />
      </ApiProvider>
    </QueryClientProvider>,
  );
  // By the opponent's name rather than by the verb: the same helper opens the
  // sheet in both languages, and the Turkish case below depends on that.
  await userEvent.click(screen.getByRole('button', { name: new RegExp(one.opponentName) }));
}

beforeEach(async () => {
  const i18n = (await import('../src/i18n/index.js')).default;
  await i18n.changeLanguage('en');
});

describe('what a battle report explains', () => {
  /**
   * THE DENOMINATOR. Twelve of fifteen is a disaster and twelve of eighty is the
   * cost of doing business; without the roster the report could not tell them
   * apart, and "you lost 2 Wasp" was the whole of what it said.
   */
  it('gives your own losses a force to be measured against', async () => {
    await openSheet(report());

    expect(screen.getByText('Sent')).toBeVisible();
    expect(screen.getByText('Lost')).toBeVisible();
    expect(screen.getByText('Left')).toBeVisible();
    // Fifteen craft went — twelve Wasps AND the three Haulers that never fired,
    // because a raid that brings its cargo home is a raid that paid for itself.
    expect(screen.getByText('15 into the fight · 2 destroyed · 13 standing')).toBeVisible();
  });

  /** A defender's board is theirs, and the word for it is not "sent". */
  it('calls the defender’s board what it was — held, not sent', async () => {
    await openSheet(report({
      attacking: false,
      yourFleet: { WASP: 20, BASTION: 6 },
      yourLosses: { BASTION: 4 },
      theirLosses: { WASP: 9 },
    }));

    expect(screen.getByText('Had')).toBeVisible();
    expect(screen.queryByText('Sent')).not.toBeInTheDocument();
  });

  /**
   * GROUND DEFENCE IS DURABLE BY DESIGN (60% salvage) and the game had never said
   * so anywhere. A defender reading "you lost 4 Bastions" concluded the opposite
   * of the rule those guns are priced on.
   */
  it('shows the guns that walked back out of their own wreckage', async () => {
    await openSheet(report({
      attacking: false,
      yourFleet: { BASTION: 6 },
      yourLosses: { BASTION: 4 },
      theirLosses: { WASP: 9 },
      defenceSalvage: { BASTION: 2 },
    }));

    expect(screen.getByText(/2 ground guns were rebuilt/)).toBeVisible();
    // And the roster's "Left" column counts them, or the two halves of one sheet
    // disagree about how many guns are standing.
    expect(screen.getByText('6 into the fight · 4 destroyed · 4 standing')).toBeVisible();
  });

  /**
   * WHERE IT HAPPENED, AND WHICH OF MY WORLDS. D97 gave a commander up to four,
   * and "Raided by Sable" stopped saying which of theirs was hit — the most
   * actionable fact there is, absent from the record of it.
   */
  it('names the world an attacker launched from, pointing out', async () => {
    await openSheet(report({ yourPlanet: 'Quillon-116' }));
    expect(screen.getByText('Quillon-116')).toBeVisible();
    expect(screen.getByText('→')).toBeVisible();
  });

  it('names the world a defender was hit at, pointing in', async () => {
    await openSheet(report({ attacking: false, yourPlanet: 'Neutral T1-29' }));
    expect(screen.getByText('Neutral T1-29')).toBeVisible();
    expect(screen.getByText('←')).toBeVisible();
  });

  /** A world that has since ceased to exist leaves the line out rather than blank. */
  it('omits the route when the world is gone', async () => {
    await openSheet(report({ yourPlanet: '' }));
    expect(screen.queryByText('→')).not.toBeInTheDocument();
  });

  /**
   * THE THREE NUMBERS A PLAYER FEELS. `Rounds` led this row and is the least
   * consequential figure on the surface — a fixed three at most, decided by the
   * combat model rather than by anything the player chose.
   */
  it('leads with the haul, its price, and what it moved', async () => {
    await openSheet(report());
    expect(screen.getByText('Ships lost')).toBeVisible();
    expect(screen.getByText('Taken')).toBeVisible();
    expect(screen.getByText('Dominion')).toBeVisible();
    expect(screen.queryByText('Rounds')).not.toBeInTheDocument();
  });

  /** The lesson a raider could not learn: bring Haulers. */
  it('tells an attacker when their own holds capped the haul', async () => {
    await openSheet(report({ cargoLimited: true }));
    expect(screen.getByText(/Your holds were full/)).toBeVisible();
  });

  it('says nothing about holds when the defence was the limit', async () => {
    await openSheet(report({ cargoLimited: false }));
    expect(screen.queryByText(/Your holds were full/)).not.toBeInTheDocument();
  });

  /** Each consequence is stated only when it is true — never as a row of zeroes. */
  it('draws no consequence block at all when a battle had none', async () => {
    await openSheet(report({
      shieldAbsorbed: 0,
      wreckValue: 0,
      disruptedMinutes: 0,
      cargoLimited: false,
      defenceSalvage: {},
      rounds: [{ ...base.rounds[0]!, shieldAbsorbed: 0 }],
    }));
    expect(screen.queryByText('What it did')).not.toBeInTheDocument();
  });

  it('reads the works and the wreckage from the side the reader is on', async () => {
    await openSheet(report({ disruptedMinutes: 180, wreckValue: 3400 }));
    expect(screen.getByText(/Their works are offline/)).toBeVisible();
    expect(screen.getByText(/in wreckage is drifting over Grimhold/)).toBeVisible();
  });

  it('says it in the second person to the commander it happened to', async () => {
    await openSheet(report({ attacking: false, disruptedMinutes: 180 }));
    expect(screen.getByText(/Your works were knocked offline/)).toBeVisible();
  });

  /**
   * THE WRECKAGE IS OVER THE WORLD THAT WAS ATTACKED, which is the opponent's
   * world only when the reader is the attacker. Named with `opponentPlanet` on
   * both sides, a defender was told their own dead ships were drifting over the
   * raider's homeworld — and sent to the wrong end of the disc to collect them.
   */
  it('puts a defender\u2019s wreckage in their own orbit, not the raider\u2019s', async () => {
    await openSheet(report({ attacking: false, wreckValue: 3400 }));
    expect(screen.getByText(/drifting in your own orbit/)).toBeVisible();
    expect(screen.queryByText(/drifting over Grimhold/)).not.toBeInTheDocument();
  });

  /**
   * DECISIVE, PARTIAL and REPELLED are printed in caps at the top of every report
   * and nothing in the game had ever said what separates them — while the grade is
   * what sets the loot share and how long the works stay down.
   */
  it('explains the word stamped at the top, without a number to decode', async () => {
    await openSheet(report({ grade: 'PARTIAL' }));
    expect(screen.getByText(/You broke most of the defence but not all of it/)).toBeVisible();
    // No internal quantity and no threshold: `defenceValue` and "42%" are the
    // combat model talking to itself.
    expect(screen.queryByText(/defence value/)).not.toBeInTheDocument();
    expect(screen.queryByText(/42%/)).not.toBeInTheDocument();
  });

  it('explains a repelled raid differently from a decisive one', async () => {
    await openSheet(report({ grade: 'REPELLED' }));
    expect(screen.getByText(/Their defence held/)).toBeVisible();
    expect(screen.queryByText(/You destroyed everything/)).not.toBeInTheDocument();
  });

  /**
   * FROM THE READER'S SIDE. Written once for both, the commander who had just been
   * raided read a neutral description of their own losses — the same sentence the
   * raider read about somebody else's.
   */
  it('tells the defender what happened to THEM, not what happened to someone', async () => {
    await openSheet(report({ attacking: false, grade: 'PARTIAL' }));
    expect(screen.getByText(/Most of your defence fell but something held/)).toBeVisible();
    expect(screen.queryByText(/You broke most of the defence/)).not.toBeInTheDocument();
  });

  /**
   * Damage is an abstraction; a hull leaving the board is the event, and WHEN it
   * happened is the whole story of a fight that turned in round two. The payload
   * has carried this since combat existed and the surface drew two bars over it.
   */
  it('names who died in which round', async () => {
    await openSheet(report());
    // Round 2 is where the Bastion went.
    expect(screen.getByText('−1 Bastion')).toBeVisible();
    expect(screen.getByText('−6 Wasp')).toBeVisible();
  });

  /**
   * Both sides fly Wasps, so a round in which each lost some rendered as
   * "−11 Wasp −3 Wasp" — two identical phrases told apart by a colour, which on a
   * phone in daylight reads as a typo rather than as two facts.
   */
  it('says whose casualties they were, in words', async () => {
    await openSheet(report({
      rounds: [{
        round: 1,
        attackerDamage: 800,
        defenderDamage: 300,
        shieldAbsorbed: 0,
        breacherShieldDamage: 0,
        attackerLosses: { WASP: 3 },
        defenderLosses: { WASP: 3 },
      }],
    }));
    expect(screen.getByText('Them')).toBeVisible();
    expect(screen.getByText('You')).toBeVisible();
    expect(screen.getAllByText('−3 Wasp')).toHaveLength(2);
  });

  /**
   * A SWING OF ZERO IS NOT A FIGURE. Every raid on a caretaker world moves
   * nobody's score, and so does a raid repelled without losses, so the chip
   * printed "0" on exactly the rows where the ladder had nothing to say.
   */
  it('omits the Dominion figure when the ladder did not move', async () => {
    await openSheet(report({ dominion: 0 }));
    expect(screen.queryByText('Dominion')).not.toBeInTheDocument();
  });

  it('says so plainly in a round where nothing came off the board', async () => {
    await openSheet(report({
      rounds: [{
        round: 1,
        attackerDamage: 40,
        defenderDamage: 10,
        shieldAbsorbed: 0,
        breacherShieldDamage: 0,
        attackerLosses: {},
        defenderLosses: {},
      }],
    }));
    expect(screen.getByText('Nothing came off the board this round.')).toBeVisible();
  });

  /**
   * THE LINE NONE OF THIS WAS ALLOWED TO CROSS.
   *
   * `yourFleet` minus `yourLosses` is the caller's own survivors, which they are
   * entitled to. The same subtraction on the OPPONENT's roster is exactly the
   * disclosure the fog exists to refuse, so the opponent's roster never reaches
   * the client — the server sends one roster and it is always the reader's.
   */
  it('the fog holds: only ever one roster, and it is yours', async () => {
    const sheet = report({
      attacking: true,
      yourFleet: { WASP: 12, HAULER: 3 },
      theirLosses: { WASP: 6, BASTION: 1 },
    });
    await openSheet(sheet);

    const force = screen.getByText('Sent').closest('div')?.parentElement;
    expect(force).not.toBeNull();
    // The defender's Bastion appears as a LOSS below, and never as a holding in
    // the one table on this sheet that states how many of something there were.
    expect(within(force!).queryByText('Bastion')).not.toBeInTheDocument();
    expect(screen.getByText('What you destroyed')).toBeVisible();
  });

  /**
   * A report written before the roster was stored carries an empty one. The sheet
   * falls back to the loss list rather than drawing a table of nothing — the
   * defaults on the columns are what make the payload safe, and this is what makes
   * the surface safe.
   */
  it('falls back to the plain loss list on a report written before D121', async () => {
    await openSheet(report({ yourFleet: {} }));
    expect(screen.queryByText('Sent')).not.toBeInTheDocument();
    expect(screen.getByText('What it cost you')).toBeVisible();
    expect(screen.queryByText('Your force')).not.toBeInTheDocument();
    // The Wasps lost are still named, from the list that has always been there.
    expect(screen.getAllByText('Wasp').length).toBeGreaterThan(0);
  });

  /**
   * A caretaker world has no commander, so the server sends no name and the report
   * used to read "You raided someone" at "an unknown world" — about a world whose
   * name is printed on the disc.
   */
  it('names an unclaimed world instead of calling it someone', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const neutral = report({ neutral: true, opponentName: 'someone', opponentPlanet: 'Tarn-4' });
    client.setQueryData(['reports'], { reports: [neutral] });
    const api = { reports: () => Promise.resolve({ reports: [neutral] }) } as unknown as Api;
    render(
      <QueryClientProvider client={client}>
        <ApiProvider api={api}>
          <BattleReports />
        </ApiProvider>
      </QueryClientProvider>,
    );

    expect(screen.getByText('an unclaimed world')).toBeVisible();
    expect(screen.queryByText('someone')).not.toBeInTheDocument();
    expect(screen.getByText(/Tarn-4/)).toBeVisible();
  });

  /** The Turkish is written in Turkish, and the roster columns have to fit it. */
  it('says all of it in Turkish', async () => {
    const i18n = (await import('../src/i18n/index.js')).default;
    await i18n.changeLanguage('tr');
    await openSheet(report({ cargoLimited: true, disruptedMinutes: 180, wreckValue: 3400 }));

    expect(screen.getByText('Bu savaş ne yaptı')).toBeVisible();
    expect(screen.getByText(/Ambarların doldu/)).toBeVisible();
    expect(screen.getByText('Giden')).toBeVisible();
    expect(screen.getByText(/Savaşa 15 girdi/)).toBeVisible();
    await i18n.changeLanguage('en');
  });
});
