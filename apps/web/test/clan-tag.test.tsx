import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '../src/i18n/index.js';
import { ClanTag } from '../src/ui/ClanTag.js';
import { CommanderCard } from '../src/v2/hud/CommanderCard.js';

/**
 * THE CLAN TAG'S METAL (owner 2026-11-10): bronze from level 3, silver from 6, gold at 10 — read
 * wherever the tag is drawn, so a rival's rung is visible across the galaxy without opening it.
 */
describe('the clan tag', () => {
  beforeEach(async () => { await i18n.changeLanguage('en'); });

  it('wears its tier as a metal, and says so to a screen reader', () => {
    render(<ClanTag tag="ORB" tier="GOLD" />);
    const tag = screen.getByText('[ORB]');
    expect(tag).toHaveAttribute('data-tier', 'GOLD');
    expect(tag).toHaveClass('text-rank-gold');
    expect(tag).toHaveAccessibleName('[ORB] · golden banner clan');
  });

  it('keeps the plain colour it was given below level 3', () => {
    render(<ClanTag tag="N7" tier={null} className="text-crystal" />);
    const tag = screen.getByText('[N7]');
    expect(tag).not.toHaveAttribute('data-tier');
    expect(tag).toHaveClass('text-crystal');
  });

  it('turns bronze and silver on the way up', () => {
    render(<><ClanTag tag="AA" tier="BRONZE" /><ClanTag tag="BB" tier="SILVER" /></>);
    expect(screen.getByText('[AA]')).toHaveClass('text-rank-copper');
    expect(screen.getByText('[BB]')).toHaveClass('text-rank-silver');
  });

  it('colours the commander card chip by the same tier', () => {
    render(<CommanderCard name="Vantage" country="TR" clan={{ tag: 'ORB', name: 'Orbit Wardens', tier: 'SILVER' }}
      galaxy="Vega" seasonDay={3} rank={null} worlds={{ held: 1, max: 4 }} shield={null} now={Date.now()} />);
    expect(document.querySelector('[data-tier="SILVER"]')).toHaveTextContent('ORB');
  });
});
