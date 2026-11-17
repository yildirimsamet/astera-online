import { Choices } from '../game-ui/index.js';
import { ARENA_GRAPHICS, type ArenaGraphicsChoice } from './graphics.js';
import type { ArenaCopy } from './copy.js';

/** The menu's graphics row: four choices on one line; the chosen one says what it costs. */
export function GraphicsPicker({ c, value, onPick }: { c: ArenaCopy; value: ArenaGraphicsChoice; onPick: (choice: ArenaGraphicsChoice) => void }) {
  return <div className="gk-arenaset">
    <p className="gk-label">{c.graphics}</p>
    <Choices label={c.graphics} value={value} onChange={onPick} options={ARENA_GRAPHICS.map(choice => ({ id: choice, label: c.graphicsChoices[choice] }))} />
    <p className="gk-sub">{c.graphicsNotes[value]}</p>
  </div>;
}
