import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { BuildingLevels } from '@astera/rules';
import i18n from '../src/i18n/index.js';
import { buildingGain } from '../src/lib/gains.js';
import { UpgradeRow } from '../src/ui/UpgradeRow.js';

beforeEach(async () => {
  await i18n.changeLanguage('tr');
});

describe('Vault depth after protection reaches its cap', () => {
  it.each([
    [12, '84', '95'],
    [13, '95', '105'],
    [14, '105', '116'],
  ])('shows the storage change for level %i even when protected amounts stay flat', (level, now, next) => {
    const levels: BuildingLevels = {
      CORE: 15,
      REFINERY: 13,
      EXTRACTOR: 13,
      VAULT: level,
      SHIPYARD: 0,
      DEUTERIUM_PLANT: 13,
      HANGAR: 0,
    };
    const gain = buildingGain('VAULT', level, 0, levels);
    const view = render(
      <UpgradeRow
        name="Depo"
        role="Kaynak depolar"
        level={level}
        gain={gain}
        cost={{ alloy: 1, crystal: 1 }}
        held={{ alloy: 1, crystal: 1 }}
        verb="raise"
        onAct={() => undefined}
      />,
    );

    expect(view.container).toHaveTextContent(`${now} sa depo · 8 sa korumalı`);
    expect(view.container).toHaveTextContent(`${next} sa depo · 8 sa korumalı`);
    const gainLine = [...view.container.querySelectorAll('p')]
      .find((line) => line.textContent.includes(gain.label));
    expect(gainLine).not.toHaveClass('truncate');
  });
});
