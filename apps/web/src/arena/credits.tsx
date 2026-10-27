import type { ArenaCopy } from './copy.js';

/** The CC BY 4.0 ship models (CREDITS.md): title, author and work, as the licence asks. */
const MODELS = [
  { title: 'Space Fighter', author: 'Comrade1280', url: 'https://sketchfab.com/3d-models/space-fighter-e766136d4871441289d37d44a4bbcd3b' },
  { title: 'Spaceship Concept', author: 'marum3s', url: 'https://sketchfab.com/3d-models/spaceship-concept-406349eef4814e60997b691dd71fb87a' },
  { title: 'SpaceShip', author: 'JazOone', url: 'https://sketchfab.com/3d-models/spaceship-6164a883f57f4f13938c3c5999bc0e1f' },
] as const;
const LICENCE = 'https://creativecommons.org/licenses/by/4.0/';

/** One tap deep in the arena menu: who made the ships, and that they were changed for the game. */
export function ModelCredits({ c }: { c: ArenaCopy }) {
  return <details className="ap-credits">
    <summary>{c.credits}</summary>
    <ul>{MODELS.map(model => <li key={model.url}>
      <a href={model.url} target="_blank" rel="noopener noreferrer">{model.title}</a> · {model.author}
    </li>)}</ul>
    <p><a href={LICENCE} target="_blank" rel="noopener noreferrer">CC BY 4.0</a> · {c.creditsChanged}</p>
  </details>;
}
