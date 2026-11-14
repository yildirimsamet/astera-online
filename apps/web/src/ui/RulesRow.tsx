import type { ReactNode } from 'react';
import { Glyph, type GlyphId } from '../game-ui/icons.js';
import { haptic } from '../lib/haptics.js';
import { OWN_SOUND, playSound } from '../lib/sound.js';

/**
 * A rule a reader opens when they want the arithmetic: the kit's rules row, closed until
 * pressed. Shared by the battle, strategic and monument reports (C15b, C17).
 */
export function RulesRow({ glyph, title, children }: { glyph: GlyphId; title: string; children: ReactNode }) {
  return (
    <details className="gk-rules">
      <summary className="gk-rules__head" {...OWN_SOUND} onClick={() => { playSound('tap'); haptic('tap'); }}>
        <Glyph id={glyph} />
        <span className="flex-1">{title}</span>
        <span className="gk-rules__chev"><Glyph id="down" /></span>
      </summary>
      <div className="gk-rules__body">{children}</div>
    </details>
  );
}
