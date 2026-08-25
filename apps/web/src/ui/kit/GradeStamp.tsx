import type { Grade } from '@astera/rules';

/**
 * The verdict on a battle, stamped rather than typed.
 *
 * `docs/visual-design.md` lists battle-outcome imagery as missing art and calls the
 * return moment "the most important screen in the game", which currently has no
 * imagery at all. This is the interim: a struck plate rather than a coloured word,
 * drawn in code so it costs nothing and can be replaced by a real mark later without
 * touching a caller.
 *
 * The tone is NOT derived from the grade, and that is the whole subtlety. A report is
 * signed from the reader's side: DECISIVE is the best outcome in the game when you
 * attacked and the worst when you were the one at home. So the caller states whether
 * this went their way, and the stamp obeys.
 */
export function GradeStamp({
  grade,
  favourable,
  size = 'md',
}: {
  grade: Grade;
  /** True when this outcome was good for the reader. Attacker DECISIVE, defender REPELLED. */
  favourable: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const tone = favourable
    ? { text: 'text-opportunity', edge: 'rgb(111 245 182 / 55%)', wash: 'rgb(90 211 155 / 12%)' }
    : { text: 'text-threat-ink', edge: 'rgb(255 106 77 / 55%)', wash: 'rgb(226 65 44 / 14%)' };

  /*
    THE WEIGHT COMES FROM THE PLATE, NOT FROM A HEAVIER FACE. This was the one
    `font-extrabold` in the interface — a fourth weight beside 400, 600 and 700 —
    and the struck corner, the lit edge and the wash were already doing the work
    it was there for.
  */
  const box =
    size === 'sm'
      ? 'text-micro px-2 py-1'
      : size === 'lg'
        ? 'text-body px-4 py-2'
        : 'text-label px-3 py-2';

  return (
    <span
      className={`headline inline-flex items-center ${tone.text} ${box}`}
      style={{
        // A struck corner on the leading edge only — a stamp pressed at an angle,
        // not a symmetrical badge.
        clipPath: 'polygon(7px 0, 100% 0, calc(100% - 7px) 100%, 0 100%)',
        background: tone.wash,
        boxShadow: `inset 0 0 0 1px ${tone.edge}, inset 0 0 14px -4px ${tone.edge}`,
        textShadow: '0 1px 0 rgb(0 0 0 / 60%)',
      }}
    >
      {grade}
    </span>
  );
}

/**
 * Whether a report's grade was good news for the person reading it.
 *
 * DECISIVE and PARTIAL are gains for the attacker and losses for the defender;
 * REPELLED is the reverse. One function so no screen can get the polarity wrong.
 */
export const wentYourWay = (grade: Grade, attacking: boolean): boolean =>
  attacking ? grade !== 'REPELLED' : grade === 'REPELLED';
