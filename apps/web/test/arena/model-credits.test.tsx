import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { arenaCopy } from '../../src/arena/copy.js';
import { ModelCredits } from '../../src/arena/credits.js';

/**
 * The three class ships are CC BY 4.0 models (CREDITS.md). The licence asks for the title, the
 * author, a link to the work and the licence, and a note that it was changed: the pilot finds
 * them one tap deep in the arena menu.
 */
describe('the model credits in the arena menu', () => {
  it('names each ship model with its author, links the work and the licence, and says it was changed', () => {
    const view = render(<ModelCredits c={arenaCopy()} />);
    const links = Array.from(view.container.querySelectorAll('a')).map(link => [link.textContent, link.getAttribute('href')]);
    expect(links).toEqual(expect.arrayContaining([
      ['Space Fighter', 'https://sketchfab.com/3d-models/space-fighter-e766136d4871441289d37d44a4bbcd3b'],
      ['Spaceship Concept', 'https://sketchfab.com/3d-models/spaceship-concept-406349eef4814e60997b691dd71fb87a'],
      ['SpaceShip', 'https://sketchfab.com/3d-models/spaceship-6164a883f57f4f13938c3c5999bc0e1f'],
      ['CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/'],
    ]));
    for (const author of ['Comrade1280', 'marum3s', 'JazOone']) expect(view.container.textContent).toContain(author);
    expect(view.container.textContent).toContain(arenaCopy().creditsChanged);
  });

  it('opens a link outside the game without handing it the page', () => {
    const view = render(<ModelCredits c={arenaCopy()} />);
    for (const link of view.container.querySelectorAll('a')) {
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toContain('noopener');
    }
  });
});
