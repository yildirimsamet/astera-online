import { render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { tolerateForeignDomEdits } from '../src/lib/foreignDomEdits.js';

/*
  Sentry WEB-4 (2026-11-19, live d637eabf, Zurich): starting a research swapped the queue lane's idle
  line for the running one, React removed the idle line's bare text node — and the node was not
  there. A page translator (Chrome Translate) swaps text nodes for its own <font> wrappers, so the
  node React holds is detached. The panel fell into its error boundary mid-action.
  Same shape as `ResearchPanel`'s lane: a text node that becomes an element.
*/
function Lane({ running }: { running: boolean }) {
  return (
    <section>
      <p data-lane>
        <span>Research</span>
        {' · '}
        {running ? <span>finishes 18:30</span> : 'start one from the map'}
      </p>
    </section>
  );
}

/** What Chrome Translate does to a text node: replace it with its own wrapper (a <font>; any element will do here). */
function translate(root: HTMLElement): void {
  const line = root.querySelector('[data-lane]');
  const text = [...(line?.childNodes ?? [])].find(node => node.textContent === 'start one from the map');
  if (!line || !text) throw new Error('Missing idle text');
  const font = document.createElement('span');
  font.textContent = 'commencez-en une depuis la carte';
  line.replaceChild(font, text);
}

let undo: (() => void) | null = null;
afterEach(() => { undo?.(); undo = null; });

describe('a translated page survives React updates', () => {
  it('reproduces the crash without the guard', () => {
    const view = render(<Lane running={false} />);
    translate(view.container);
    expect(() => { view.rerender(<Lane running />); }).toThrow(/not a child/u);
  });

  it('lets React carry on when a translator moved the node it removes', () => {
    undo = tolerateForeignDomEdits();
    const view = render(<Lane running={false} />);
    translate(view.container);
    view.rerender(<Lane running />);
    expect(view.container.textContent).toContain('finishes 18:30');
  });

  it('inserts at the end when the reference node was moved away', () => {
    undo = tolerateForeignDomEdits();
    const parent = document.createElement('div');
    const stray = document.createElement('i');
    const added = document.createElement('b');
    expect(parent.insertBefore(added, stray)).toBe(added);
    expect(parent.lastChild).toBe(added);
  });

  it('changes nothing for an ordinary page', () => {
    undo = tolerateForeignDomEdits();
    const parent = document.createElement('div');
    const first = parent.appendChild(document.createElement('i'));
    const added = parent.insertBefore(document.createElement('b'), first);
    expect(parent.firstChild).toBe(added);
    expect(parent.removeChild(first)).toBe(first);
    expect(parent.childNodes).toHaveLength(1);
  });
});
