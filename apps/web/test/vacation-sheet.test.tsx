import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { VacationSheet } from '../src/screens/VacationSheet.js';
import { vacationSchema } from '../src/api/schemas.js';

const start = vi.fn<(input: { days: number; fingerprint: string; requestId: string }, callbacks?: { onSuccess?: () => void; onError?: () => void }) => void>();
const end = vi.fn();
const quote = {
  active: null as { id: string; endsAt: Date; startedAt: Date; days: number; cost: number } | null,
  days: 1, maxDays: 2, store: 100, buffer: 200, blocker: null as string | null, reasons: [] as string[], fingerprint: 'quote', seasonEndsAt: new Date('2026-10-30'),
  worlds: [{ id: 'home', name: 'Earth', kind: 'CAPITAL', coreLevel: 17 }],
  price: { total: 250, worlds: [{ id: 'home', capital: true, coreLevel: 17, referenceLevel: 18, hours: 12, rate: 20.8, cost: 250 }] },
};
const queryState = { isFetching: false, isError: false };
const startState = { isPending: false };
vi.mock('../src/api/vacation.js', () => ({
  useVacation: () => ({ data: quote, isPending: false, ...queryState, refetch: vi.fn() }),
  useStartVacation: () => ({ mutate: start, ...startState, error: null }),
  useEndVacation: () => ({ mutate: end, isPending: false, error: null }),
}));
afterEach(() => {
  start.mockClear(); end.mockClear(); quote.active = null; quote.days = 1;
  quote.blocker = null; quote.reasons = []; quote.store = 100; quote.buffer = 200;
  queryState.isFetching = false; queryState.isError = false;
  startState.isPending = false;
});
it('lists every current obstacle together, including the precise deuterium shortfall', () => {
  quote.blocker = 'VACATION_FLIGHTS';
  quote.reasons = ['VACATION_FLEET', 'VACATION_PROBES', 'VACATION_MINING', 'VACATION_MONUMENT_FLEET',
    'VACATION_SUPPORT_SENT', 'VACATION_SUPPORT_HOSTED', 'VACATION_CLAN_FLEET', 'VACATION_FUNDS'];
  quote.store = 10; quote.buffer = 20;
  render(<VacationSheet onClose={vi.fn()} />);
  const section = screen.getByRole('region', { name: 'Before you can start vacation' });
  expect(section.querySelectorAll('li')).toHaveLength(8);
  expect(section).toHaveTextContent('220 more deuterium needed');
  expect(section).toHaveTextContent('Your fleets are in flight');
  expect(section).toHaveTextContent('Your probes are in flight');
  expect(section).toHaveTextContent('Your mining or salvage craft are away');
  expect(section).toHaveTextContent('Your ships are at a monument or travelling there or back');
  expect(section).toHaveTextContent('Your clan support ships are away');
  expect(section).toHaveTextContent('Clan support ships are assigned to your planets');
  expect(section).toHaveTextContent('Your ships are committed to the joint clan fleet');
  expect(screen.getByRole('button', { name: 'Start 1-day vacation' })).toBeDisabled();
  expect(screen.queryByText('Vacation details could not be loaded.')).not.toBeInTheDocument();
});
it('removes the obstacles section and enables starting when refreshed conditions clear', () => {
  quote.blocker = 'VACATION_FLIGHTS'; quote.reasons = ['VACATION_MINING'];
  const { rerender } = render(<VacationSheet onClose={vi.fn()} />);
  expect(screen.getByRole('region', { name: 'Before you can start vacation' })).toBeInTheDocument();
  quote.blocker = null; quote.reasons = [];
  rerender(<VacationSheet onClose={vi.fn()} />);
  expect(screen.queryByRole('region', { name: 'Before you can start vacation' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Start 1-day vacation' })).toBeEnabled();
});
it('never rounds a real deuterium shortfall down to zero', () => {
  quote.blocker = 'VACATION_FUNDS'; quote.reasons = ['VACATION_FUNDS'];
  quote.store = 249.8; quote.buffer = 0;
  render(<VacationSheet onClose={vi.fn()} />);
  expect(screen.getByRole('region', { name: 'Before you can start vacation' })).toHaveTextContent('1 more deuterium needed');
  expect(screen.getByRole('button', { name: 'Start 1-day vacation' })).toBeDisabled();
});
it('explains a legacy single blocker using vacation translations', () => {
  quote.blocker = 'VACATION_MAIN_ONLY';
  render(<VacationSheet onClose={vi.fn()} />);
  expect(screen.getByText('Vacation mode is available in your main galaxy.')).toBeInTheDocument();
});
it('explains a quote refresh and refuses stale day quotes even before fetching is reported', () => {
  const { rerender } = render(<VacationSheet onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: '2 days' }));
  expect(screen.getByRole('button', { name: 'Start 2-day vacation' })).toBeDisabled();
  expect(screen.getByText('Checking vacation conditions…')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Start 2-day vacation' }));
  expect(start).not.toHaveBeenCalled();
  quote.days = 2; queryState.isFetching = true;
  rerender(<VacationSheet onClose={vi.fn()} />);
  expect(screen.getByRole('button', { name: 'Start 2-day vacation' })).toBeDisabled();
  queryState.isFetching = false;
  rerender(<VacationSheet onClose={vi.fn()} />);
  expect(screen.getByRole('button', { name: 'Start 2-day vacation' })).toBeEnabled();
});
it('does not allow starting from cached data when the eligibility refresh failed', () => {
  queryState.isError = true;
  render(<VacationSheet onClose={vi.fn()} />);
  expect(screen.getByRole('button', { name: 'Start 1-day vacation' })).toBeDisabled();
  expect(screen.getByText('Vacation details could not be loaded.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
});
it('explains why starting remains disabled while payment is being submitted', () => {
  startState.isPending = true;
  render(<VacationSheet onClose={vi.fn()} />);
  expect(screen.getByRole('region', { name: 'Before you can start vacation' })).toHaveTextContent('Starting vacation…');
  expect(screen.getByRole('button', { name: 'Start 1-day vacation' })).toBeDisabled();
});
it('validates detailed reasons at the API boundary and supports the previous server response', () => {
  expect(vacationSchema.parse({ ...quote, reasons: ['VACATION_MINING', 'VACATION_FUNDS'] })).toHaveProperty('reasons', ['VACATION_MINING', 'VACATION_FUNDS']);
  expect(vacationSchema.safeParse({ ...quote, reasons: ['SECRET_ENEMY_INFORMATION'] }).success).toBe(false);
  const { reasons: _reasons, ...legacy } = quote;
  expect(vacationSchema.parse(legacy)).toHaveProperty('reasons', []);
});
it('shows every world, the cost rule and both balances before payment', () => {
  render(<VacationSheet onClose={vi.fn()} />);
  expect(screen.getByText('Earth')).toBeInTheDocument();
  expect(screen.getByText(/Core 17 → refinery L18/)).toBeInTheDocument();
  expect(screen.getByText('Capital store')).toBeInTheDocument();
  expect(screen.getByText('Capital buffer')).toBeInTheDocument();
  expect(screen.getByText(/24 hours before/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '3 days' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Start 1-day vacation' }));
  expect(start).toHaveBeenCalledOnce();
});
it('requires explicit early return acknowledgement and states no refund', () => {
  quote.active = { id: 'vacation-1', startedAt: new Date(), endsAt: new Date(Date.now() + 86_400_000), days: 1, cost: 250 };
  quote.blocker = 'VACATION_ACTIVE'; quote.reasons = ['VACATION_ACTIVE'];
  render(<VacationSheet onClose={vi.fn()} />);
  expect(screen.queryByRole('region', { name: 'Before you can start vacation' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'End vacation' }));
  expect(end).not.toHaveBeenCalled();
  expect(screen.getByText(/Protection ends immediately/)).toBeInTheDocument();
  fireEvent.click(screen.getByTestId('confirm-commit'));
  expect(end).toHaveBeenCalledWith('vacation-1', expect.anything());
});
it('uses a new payment request after a successful purchase, retaining retries only until success', () => {
  render(<VacationSheet onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Start 1-day vacation' }));
  const first = start.mock.calls[0];
  expect(first).toBeDefined();
  first?.[1]?.onSuccess?.();
  fireEvent.click(screen.getByRole('button', { name: 'Start 1-day vacation' }));
  expect(start.mock.calls[1]?.[0].requestId).not.toBe(first?.[0].requestId);
});
