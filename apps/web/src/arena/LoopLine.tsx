import { useState } from 'react';
import type { ArenaCopy } from './copy.js';

/** The launch screen's loop: three steps on one line; one tap opens how each is done. */
export function LoopLine({ c }: { c: ArenaCopy }) {
  const [open, setOpen] = useState(false);
  return <div className={open ? 'ap-loop is-open' : 'ap-loop'}>
    <button type="button" aria-expanded={open} onClick={() => { setOpen(value => !value); }}>
      {c.goals.map(([title], i) => <span key={title}><b>{String(i + 1)}</b>{title}</span>)}
      <i aria-hidden>{open ? '−' : '?'}</i>
    </button>
    {open && <ol>{c.goals.map(([title, detail], i) => <li key={title}><b>{String(i + 1)}</b>{detail}</li>)}</ol>}
  </div>;
}
