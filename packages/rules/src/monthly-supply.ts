import { MONTHLY_REFERENCE } from './economy-profile.js';
import { PIRATE } from './constants.js';
import type { Resources } from './types.js';

/** Frozen day weights from the paid monthly isolated route. No live income feedback. */
const dailyReference: readonly Resources[] = [
  {
    "alloy": 2393.3333333333303,
    "crystal": 1194.9999999999986,
    "deuterium": 44.8
  },
  {
    "alloy": 5878.718097123905,
    "crystal": 2936.044527221455,
    "deuterium": 96.00000000000033
  },
  {
    "alloy": 7824.294028271468,
    "crystal": 2954.7465920277828,
    "deuterium": 157.8045195395574
  },
  {
    "alloy": 13667.891365482954,
    "crystal": 6820.746971077987,
    "deuterium": 357.35021893837245
  },
  {
    "alloy": 19394.542393087686,
    "crystal": 9685.637352002006,
    "deuterium": 358.77051060926715
  },
  {
    "alloy": 19447.879160313118,
    "crystal": 9723.939580156555,
    "deuterium": 358.77051060926635
  },
  {
    "alloy": 19343.281202544604,
    "crystal": 9723.93958015681,
    "deuterium": 358.7705106092667
  },
  {
    "alloy": 19420.868217035342,
    "crystal": 9723.93958015678,
    "deuterium": 505.9688042581565
  },
  {
    "alloy": 24557.546166307686,
    "crystal": 11820.286147145933,
    "deuterium": 506.69103773679944
  },
  {
    "alloy": 24649.485975499876,
    "crystal": 12324.742987749938,
    "deuterium": 506.69103773679944
  },
  {
    "alloy": 24649.485975499905,
    "crystal": 12324.742987749953,
    "deuterium": 506.69103773680035
  },
  {
    "alloy": 27280.44997267978,
    "crystal": 13616.191903429237,
    "deuterium": 506.69103773679944
  },
  {
    "alloy": 38509.57826134903,
    "crystal": 18611.592658292197,
    "deuterium": 506.69103773679944
  },
  {
    "alloy": 41756.732170527655,
    "crystal": 20878.36608526387,
    "deuterium": 506.69103773680126
  },
  {
    "alloy": 41756.732170527685,
    "crystal": 20878.366085263842,
    "deuterium": 506.69103773680035
  },
  {
    "alloy": 41756.732170527685,
    "crystal": 20878.366085263842,
    "deuterium": 609.6712826091834
  },
  {
    "alloy": 36666.81542515941,
    "crystal": 20878.366085263842,
    "deuterium": 662.2702375013623
  },
  {
    "alloy": 36475.12391474587,
    "crystal": 20878.36608526387,
    "deuterium": 792.5976189132334
  },
  {
    "alloy": 51907.39567502495,
    "crystal": 25332.637143332802,
    "deuterium": 990.2477013184998
  },
  {
    "alloy": 58941.13407130411,
    "crystal": 28591.529707039677,
    "deuterium": 991.719564591489
  },
  {
    "alloy": 65454.58605431346,
    "crystal": 31825.980541917786,
    "deuterium": 991.7195645914908
  },
  {
    "alloy": 67349.99994595675,
    "crystal": 33674.999972978374,
    "deuterium": 991.7195645914944
  },
  {
    "alloy": 71375.78840973298,
    "crystal": 34954.726928634045,
    "deuterium": 991.7195645914962
  },
  {
    "alloy": 74161.36044773075,
    "crystal": 37080.680223865376,
    "deuterium": 991.7195645914944
  },
  {
    "alloy": 74161.36044773075,
    "crystal": 37080.680223865376,
    "deuterium": 991.7195645914944
  },
  {
    "alloy": 80404.61537012749,
    "crystal": 38462.55736941227,
    "deuterium": 991.7195645914962
  },
  {
    "alloy": 81120.36171033792,
    "crystal": 40560.1808551689,
    "deuterium": 991.719564591489
  },
  {
    "alloy": 81120.36171033792,
    "crystal": 40560.18085516896,
    "deuterium": 991.7195645916181
  },
  {
    "alloy": 81120.36171033769,
    "crystal": 40560.180855168845,
    "deuterium": 991.7195645916072
  },
  {
    "alloy": 87226.94182848535,
    "crystal": 41838.5529258867,
    "deuterium": 991.7195645916072
  }
];
const totals = dailyReference.reduce((sum, r) => ({ alloy: sum.alloy + r.alloy,
  crystal: sum.crystal + r.crystal, deuterium: sum.deuterium + r.deuterium }),
{ alloy: 0, crystal: 0, deuterium: 0 });

export function monthlySupply(kind: 'mining' | 'pirates', day: number, seats: number): Resources {
  if (!Number.isInteger(seats) || seats < 1 || !Number.isInteger(day) || day < 0) throw new Error('Invalid supply period');
  const r = dailyReference[day];
  if (!r) return { alloy: 0, crystal: 0, deuterium: 0 };
  // D204 raises every pirate hoard resource by 30%; lift the matching allowance
  // with it so the same deterministic field remains inside its supply ceiling.
  const share = kind === 'mining' ? 0.1 : 0.05 * PIRATE.hoardRewardScale;
  return { alloy: MONTHLY_REFERENCE.alloy * share * seats * r.alloy / totals.alloy,
    crystal: MONTHLY_REFERENCE.crystal * share * seats * r.crystal / totals.crystal,
    deuterium: MONTHLY_REFERENCE.deuterium * share * seats * r.deuterium / totals.deuterium };
}
