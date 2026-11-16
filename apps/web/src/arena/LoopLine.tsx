import { useState } from 'react';
import { Glyph } from '../game-ui/index.js';
import type { ArenaCopy } from './copy.js';

/** The launch screen's loop: three steps on one line; one tap opens how each is done. */
export function LoopLine({ c }: { c: ArenaCopy }) {
  const [open, setOpen] = useState(false);
  return <div className="gk-loop" {...(open ? { 'data-open': '' } : {})}>
    <button type="button" className="gk-loop__line" aria-expanded={open} onClick={() => { setOpen(value => !value); }}>
      {c.goals.map(([title], i) => <span key={title} className="gk-loop__step"><b className="gk-num">{String(i + 1)}</b>{title}</span>)}
      <span className="gk-loop__help" aria-hidden><Glyph id={open ? 'minus' : 'help'} /></span>
    </button>
    {open && <ol className="gk-well gk-loop__steps">{c.goals.map(([title, detail], i) => <li key={title}><b className="gk-num">{String(i + 1)}</b>{detail}</li>)}</ol>}
  </div>;
}
