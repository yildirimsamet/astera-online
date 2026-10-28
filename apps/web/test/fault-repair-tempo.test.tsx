import { render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import i18n from '../src/i18n/index.js';
import { FaultSheet } from '../src/screens/FaultSheet.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { planetView } from './fixtures.js';

vi.mock('../src/api/queries.js', () => ({
  useRepairFault: () => ({ mutate: vi.fn(), isPending: false }),
}));

afterEach(async () => { await i18n.changeLanguage('en'); });

it.each([
  ['en', '7.19–21.56'], ['tr', '7,19–21,56'], ['de', '7,19–21,56'],
  ['es', '7,19–21,56'], ['fr', '7,19–21,56'], ['ja', '7.19～21.56'],
] as const)('shows the slowed repair range in %s before hiring the crew', async (language, range) => {
  await i18n.changeLanguage(language);
  const fault = {
    id: 'tempo-fault', kind: 'REFINERY_OUTAGE' as const, startedAt: new Date(0),
    cost: { alloy: 10, crystal: 0, deuterium: 0 }, repair: null,
  };
  render(
    <ToastProvider>
      <FaultSheet fault={fault} planet={planetView({ faults: [fault] })} onClose={vi.fn()} />
    </ToastProvider>,
  );
  expect(screen.getByText(text => text.includes(range))).toBeInTheDocument();
});
