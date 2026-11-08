import { useEffect, useRef, useState } from 'react';
import './school.css';

interface Props {
  title: string; text: string;
  /** Where the line stands in its chapters; without it the card counts nothing. */
  progress?: number;
  actionLabel?: string; onAction?: () => void;
  /** Without one there is no way out: the starter tutorial cannot be skipped (owner 2026-11-06). */
  onExit?: () => void; exitLabel?: string;
  /** How many chapters the counter runs to. */
  total?: number;
  revealLabel?: string; dock?: 'top' | 'bottom'; busy?: boolean;
  onRevealed?: () => void;
}

/** Each message owns its timer. Revealing a line and doing its action are
 * separate controls, so a hurried tap never skips an unread result. */
export function SchoolCoach(props: Props) {
  return <Dialogue key={props.text} {...props} />;
}

function Dialogue({ title, text, progress, actionLabel, onAction, onExit, exitLabel, total = 11,
  revealLabel = 'Show full message', dock = 'top', busy = false, onRevealed }: Props) {
  const letters = Array.from(text);
  const [shown, setShown] = useState(0);
  const ref = useRef<HTMLElement>(null);
  const complete = shown >= letters.length;
  useEffect(() => { if (complete) onRevealed?.(); }, [complete]);
  useEffect(() => {
    const coach = ref.current;
    const root = coach?.closest<HTMLElement>('[data-school-scene]');
    if (!coach || !root || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      root.style.setProperty('--school-coach-space', `${String(Math.ceil(coach.getBoundingClientRect().height) + 30)}px`);
    });
    observer.observe(coach);
    return () => { observer.disconnect(); };
  }, []);
  useEffect(() => {
    if (complete) return;
    const timer = window.setInterval(() => { setShown(n => Math.min(letters.length, n + 2)); }, 45);
    return () => { window.clearInterval(timer); };
  }, [complete, text, letters.length]);
  return <aside ref={ref} data-beat-card data-school-coach data-dock={dock} className="school-coach" aria-label={title}>
    <div className="school-speech">
      <div className="school-heading"><span>{title}</span>{progress !== undefined && <span className="school-progress">{progress}/{total}</span>}</div>
      <div className="school-line" data-school-line={text} aria-live="off">
        <p aria-hidden={!complete}>{letters.slice(0, shown).join('')}<span aria-hidden="true" className={complete ? 'school-cursor school-cursor-done' : 'school-cursor'} /></p>
        {!complete && <><span className="sr-only">{text}</span><button type="button" className="school-reveal" aria-label={revealLabel} onClick={() => { setShown(letters.length); }} /></>}
      </div>
      <div className="school-actions">
        {onExit ? <button type="button" className="school-exit" onClick={onExit}>{exitLabel}</button> : <span />}
        {complete && actionLabel && onAction && <button type="button" data-school-next className="school-next" onClick={onAction} disabled={busy}>{actionLabel}<span aria-hidden="true"> →</span></button>}
        {busy && <span className="school-working" aria-label={title}><i /><i /><i /></span>}
      </div>
    </div>
    <div className="school-portrait" aria-hidden="true"><img src="/assets/images/general/tutorial-npc.png" alt="" draggable={false} /></div>
  </aside>;
}
