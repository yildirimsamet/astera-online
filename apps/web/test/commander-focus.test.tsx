import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ContactFocus, ThreadFocus } from '../src/galaxy/FocusPanel.js';
import { trafficSchema } from '../src/api/schemas.js';

const escort = { ship: 'akinci' as const, level: 20 };
const props = { open: true, onToggle: vi.fn(), onClose: vi.fn() };
const flight = { id: 'flight', kind: 'fleet' as const, targetName: 'Test', leg: 'outbound' as const,
  arriveAt: new Date(Date.now() + 60_000), minutesRemaining: 1, fleet: { DART: 10 } };
const base = { id: 'foreign', kind: 'fleet', from: { x: 0, y: 0, z: 0 }, to: { x: 1, y: 0, z: 0 },
  startAt: new Date(), endAt: new Date(Date.now() + 60_000), fleet: { DART: 10 }, admiral: escort };

describe('the escort bonus in the selected fleet', () => {
  it('shows the owning commander the escort and its damage bonus', () => {
    render(<ThreadFocus {...props} thread={{ ...flight, admiral: escort }} minutesRemaining={1} />);
    expect(screen.getByText(/damage \+5%/i)).toBeInTheDocument();
    expect(document.querySelector('[data-flight-escort]')).toHaveTextContent(/Akıncı/);
  });
  it('keeps the escort through API parsing and shows the same bonus to an observer', () => {
    const contact = trafficSchema.parse({ contacts: [base] }).contacts[0]!;
    render(<ContactFocus {...props} contact={contact} />);
    expect(screen.getByText(/damage \+5%/i)).toBeInTheDocument();
  });
  it.each([
    { ship: 'muhafiz' as const, level: 20, expected: /hull and shields \+5%/i },
    { ship: 'kilavuz' as const, level: 20, expected: /travel −6% · fuel −10%/i },
  ])('shows the actual class bonus for $ship', ({ ship, level, expected }) => {
    render(<ThreadFocus {...props} thread={{ ...flight, admiral: { ship, level } }} minutesRemaining={1} />);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });
  it('does not claim an escort when the fleet has none', () => {
    render(<ThreadFocus {...props} thread={flight} minutesRemaining={1} />);
    expect(document.querySelector('[data-flight-escort]')).toBeNull();
  });
});

it('shows the bonus on the first collapsed focus without another tap', () => {
  render(<ThreadFocus {...props} open={false} thread={{ ...flight, admiral: escort }} minutesRemaining={1} />);
  expect(screen.getByText(/damage \+5%/i)).toBeInTheDocument();
});
