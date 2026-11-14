import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SectionTag } from '../../src/game-ui/index.js';

/**
 * THE KIT'S SECTION TAG: a group's name on a lit tab and a rule after it. Where the group is a
 * part of a landmark a reader walks by heading (the desk outline, G1-g2), the tag is that heading.
 */
describe('a section tag', () => {
  it('names its group, and is no heading unless asked', () => {
    const { container } = render(<SectionTag>Kuyruklar</SectionTag>);
    expect(container.querySelector('.gk-tag')).toHaveTextContent('Kuyruklar');
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('is the heading of its part when asked, at the level given', () => {
    render(<SectionTag as="h2" aside={<span>2</span>}>Dünyalar</SectionTag>);
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toHaveClass('gk-tag');
    expect(heading).toHaveTextContent('Dünyalar2');
  });
});
