import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CLAN_LEVEL_MAX, CLAN_LEVEL_MIN, EFFECT_SKIN_IDS, HONOR_BENEFIT_RATES, type HonorBenefitTier } from '@astera/rules';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CLAN_LEVEL_ART, ClanEmblem, ClanLevelBadge, FLAG_IDS, HONOR_ART, HonorBadge, flagTileSrc } from '../../src/game-ui/ranks.js';
import { GameKitGallery } from '../../src/v2/gallery/GameKitGallery.js';

/**
 * WHO SOMEONE IS, AT A GLANCE. Three shapes, one meaning each (docs/ui-kit-varlik-secimi):
 * the shield is a commander's Honor, the stripe is the clan's level, the flag tile is the
 * clan itself. Each is a picture composed once, so a list row never builds it layer by layer.
 */

/** Width and height of an extended (VP8X) or plain lossy (VP8) WebP. */
function webpSize(file: string): [number, number] {
  const b = readFileSync(join('public', file));
  const kind = b.toString('ascii', 12, 16);
  if (kind === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  expect(kind).toBe('VP8 ');
  return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
}

const tiers = Object.keys(HONOR_BENEFIT_RATES).map(Number).filter((n): n is HonorBenefitTier => n in HONOR_BENEFIT_RATES);

describe('the rank pictures', () => {
  it('has a badge for every Honor tier, all one height so the shield never changes size', () => {
    expect([...tiers].sort((a, b) => a - b)).toEqual([-2, -1, 0, 1, 2]);
    const heights = new Set<number>();
    for (const tier of tiers) {
      const art = HONOR_ART[tier];
      expect(webpSize(art.src), String(tier)).toEqual([art.width, art.height]);
      heights.add(art.height);
    }
    expect(heights.size).toBe(1);
  });

  it('has a stripe for every clan level, all one height', () => {
    expect(CLAN_LEVEL_ART).toHaveLength(CLAN_LEVEL_MAX - CLAN_LEVEL_MIN + 1);
    for (const art of CLAN_LEVEL_ART) expect(webpSize(art.src), art.src).toEqual([art.width, art.height]);
    expect(new Set(CLAN_LEVEL_ART.map((art) => art.height)).size).toBe(1);
  });

  it('has a square emblem tile for every flag a clan can fly', () => {
    const flags = EFFECT_SKIN_IDS.filter((id) => id.startsWith('flag-'));
    expect([...FLAG_IDS].sort()).toEqual([...flags].sort());
    for (const id of FLAG_IDS) {
      const [w, h] = webpSize(flagTileSrc(id));
      expect(w, id).toBe(h);
    }
  });
});

describe('the rank parts', () => {
  it('draws an Honor tier at the asked height, named for a screen reader', () => {
    render(<HonorBadge tier={-2} label="Şeref −2" height={32} />);
    const img = screen.getByRole('img', { name: 'Şeref −2' });
    expect(img).toHaveAttribute('src', HONOR_ART[-2].src);
    expect(img).toHaveAttribute('height', '32');
    expect(img).toHaveAttribute('width', String(Math.round((HONOR_ART[-2].width * 32) / HONOR_ART[-2].height)));
  });

  it('draws a clan level, and nothing for a level outside the ladder', () => {
    const { container, rerender } = render(<ClanLevelBadge level={10} label="Klan seviyesi 10" height={28} />);
    expect(screen.getByRole('img', { name: 'Klan seviyesi 10' })).toHaveAttribute('src', CLAN_LEVEL_ART[9]?.src);
    rerender(<ClanLevelBadge level={0} label="Klan seviyesi 0" height={28} />);
    expect(container.querySelector('img')).toBeNull();
  });

  it('shows the clan flag as its emblem, and the tag on a plain banner when it flies none', () => {
    const { rerender } = render(<ClanEmblem flag="flag-voideye" tag="KZL" label="Kızıl Kanat" />);
    const tile = screen.getByRole('img', { name: 'Kızıl Kanat' });
    expect(tile.querySelector('img')).toHaveAttribute('src', flagTileSrc('flag-voideye'));
    rerender(<ClanEmblem flag={null} tag="KZL" label="Kızıl Kanat" />);
    const plain = screen.getByRole('img', { name: 'Kızıl Kanat' });
    expect(plain.querySelector('img')).toBeNull();
    expect(plain).toHaveTextContent('KZL');
    expect(plain.querySelector('svg')).not.toBeNull();
  });

  it('shows every tier, level and flag in the catalogue', () => {
    render(<GameKitGallery view="ui-kit" />);
    const sheet = screen.getByRole('group', { name: 'Şeref ve klan' });
    expect(within(sheet).getAllByRole('img').length).toBeGreaterThanOrEqual(tiers.length + CLAN_LEVEL_ART.length + FLAG_IDS.length + 1);
  });
});
