import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { haptic } from '../../lib/haptics.js';
import { playSound } from '../../lib/sound.js';
import { skipBeat, useDirector } from './director.js';
import './director.css';

/**
 * THE LETTERBOX (plan 2026-11-18 §4 İ3). Black bands close in from the top and the foot, which every
 * player reads as "watch this"; the line is spoken on the lower band; the screen between them is the
 * scene. A tap anywhere ends the shot, and goes no further: nothing under the bands is pressed by it.
 */
export function DirectorStage() {
  const { t } = useTranslation();
  const now = useDirector();
  const key = now?.key;
  const ms = now?.beat.ms;
  const cue = now?.beat.sound;
  useEffect(() => {
    if (key === undefined || ms === undefined) return undefined;
    if (cue) playSound(cue);
    haptic('tap');
    const timer = window.setTimeout(() => { skipBeat(); }, ms);
    return () => { window.clearTimeout(timer); };
  }, [key, ms, cue]);
  // The galaxy's own buttons step off the screen while a scene plays (director.css).
  const live = now !== null;
  useEffect(() => {
    if (!live) return undefined;
    document.documentElement.dataset.directing = '';
    return () => { delete document.documentElement.dataset.directing; };
  }, [live]);
  if (!now) return null;
  const line = now.beat.line;
  return (
    <div data-testid="director-stage" data-scene={now.scene.id} data-beat={now.beat.id} className="director-stage"
      onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); skipBeat(); }}
      onClick={(event) => { event.stopPropagation(); }}>
      <div data-letterbox="top" className="director-band director-band--top">
        <span className="director-skip">{t('starter.director.skip')}</span>
      </div>
      <div data-letterbox="bottom" className="director-band director-band--bottom">
        <p role="status" aria-live="polite" key={now.key} className="director-line gk-display">{line ? t(line, { ...now.beat.vars }) : ''}</p>
      </div>
    </div>
  );
}
