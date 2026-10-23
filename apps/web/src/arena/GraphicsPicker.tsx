import { ARENA_GRAPHICS, type ArenaGraphicsChoice } from './graphics.js';
import type { ArenaCopy } from './copy.js';

/** The menu's graphics row: four choices on one line; the chosen one says what it costs. */
export function GraphicsPicker({ c, value, onPick }: { c: ArenaCopy; value: ArenaGraphicsChoice; onPick: (choice: ArenaGraphicsChoice) => void }) {
  return <div className="am-graphics">
    <span>{c.graphics}</span>
    <div className="ap-mode is-four" role="radiogroup" aria-label={c.graphics}>
      {ARENA_GRAPHICS.map(choice => <button key={choice} type="button" role="radio" aria-checked={choice === value}
        className={choice === value ? 'is-selected' : undefined} onClick={() => { onPick(choice); }}>{c.graphicsChoices[choice]}</button>)}
    </div>
    <small>{c.graphicsNotes[value]}</small>
  </div>;
}
