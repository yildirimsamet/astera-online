import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { galaxySchema } from '../src/api/schemas.js';
import { GalaxyCommanderName } from '../src/galaxy/GalaxyCanvas.js';
import { planetNodes } from '../src/galaxy/scene.js';

const input = { id: 'world', name: 'Kestrel', owner: 'Mira', country: 'JP',
  kind: 'CAPITAL', position: { x: 0, y: 0, z: 0 }, isSelf: false,
  intel: 'RESOLVED', state: { kind: 'NORMAL' } };
const node = (over: Record<string, unknown> = {}) =>
  planetNodes([galaxySchema.shape.planets.element.parse({ ...input, ...over })])[0]!;

describe('the known commander beside a planet name', () => {
  it('carries the server country through the schema and scene to a flag beside the name', () => {
    const known = node();
    expect(known.country).toBe('JP');
    render(<GalaxyCommanderName node={known} />);
    expect(screen.getByText('Mira')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Japan' })).toBeInTheDocument();
  });
  it('does not invent a flag on an older response without country', () => {
    render(<GalaxyCommanderName node={node({ country: undefined })} />);
    expect(screen.getByText('Mira')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });
  it('does not draw a forged unknown identity or flag', () => {
    const view = render(<GalaxyCommanderName node={node({ intel: 'UNKNOWN' })} />);
    expect(view.container).toBeEmptyDOMElement();
  });
  it('does not attach a country to a neutral world', () => {
    render(<GalaxyCommanderName node={node({ kind: 'NEUTRAL', owner: 'Neutral T1', country: undefined })} />);
    expect(screen.queryByRole('img')).toBeNull();
  });
});
