import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MISSION_PACES } from '@astera/rules';
import { describe, expect, it, vi } from 'vitest';
import { durationPrecise } from '../src/lib/time.js';
import { PaceRow } from '../src/ui/PaceRow.js';

describe('personal-flight speed decision', () => {
  const comparison = { fuel: 750, fullFuel: 1_000, minutes: 40, fullMinutes: 20 };

  it('places exact fuel savings and extra travel time at the speed control', () => {
    const view = render(<PaceRow paces={MISSION_PACES} pace={0.5} onChange={vi.fn()} comparison={comparison} />);
    expect(view.container.querySelector('[data-pace-fuel]')).toHaveTextContent('750');
    expect(view.container.querySelector('[data-pace-saving]')).toHaveTextContent('250 deuterium saved');
    expect(view.container.querySelector('[data-pace-saving]')).toHaveTextContent('1,000');
    expect(view.container.querySelector('[data-pace-time]')).toHaveTextContent('40m');
    expect(view.container.querySelector('[data-pace-delay]')).toHaveTextContent(`${durationPrecise(20)} later`);
    expect(view.container.querySelector('[data-pace-delay]')).toHaveTextContent(`Full speed: ${durationPrecise(20)}`);
  });

  it('teaches the benefit at full speed and lets the player choose a slower rung', async () => {
    const onChange = vi.fn();
    render(<PaceRow paces={MISSION_PACES} pace={1} onChange={onChange}
      comparison={{ fuel: 1_000, fullFuel: 1_000, minutes: 20, fullMinutes: 20 }} />);
    expect(screen.getByText(/choose a slower speed to spend less fuel/i)).toBeVisible();
    await userEvent.setup().click(screen.getByRole('radio', { name: '50%' }));
    expect(onChange).toHaveBeenCalledWith(0.5);
  });

  it('keeps the extra time consistent with the displayed arrival seconds', () => {
    const view = render(<PaceRow paces={MISSION_PACES} pace={0.5} onChange={vi.fn()}
      comparison={{ fuel: 4, fullFuel: 6, minutes: 137 / 60, fullMinutes: 68.5 / 60 }} />);
    // Displayed times are 2m17s and 1m09s: their visible difference is 1m08s.
    expect(view.container.querySelector('[data-pace-delay]')).toHaveTextContent(`${durationPrecise(68 / 60)} later`);
  });

  it('explains zero savings caused by rounding instead of promising a percentage gain', () => {
    const view = render(<PaceRow paces={MISSION_PACES} pace={0.5} onChange={vi.fn()}
      comparison={{ fuel: 2, fullFuel: 2, minutes: 40, fullMinutes: 20 }} />);
    expect(view.container.querySelector('[data-pace-zero-saving]')).toHaveTextContent(/rounding.*no fuel savings/i);
    expect(view.container.querySelector('[data-pace-saving]')).toHaveTextContent('0 deuterium saved');
    expect(view.container).not.toHaveTextContent('25% saved');
  });

  it('recomputes the full-speed comparison when the selection changes', () => {
    const view = render(<PaceRow paces={MISSION_PACES} pace={0.5} onChange={vi.fn()} comparison={comparison} />);
    view.rerender(<PaceRow paces={MISSION_PACES} pace={0.5} onChange={vi.fn()}
      comparison={{ fuel: 1_500, fullFuel: 2_000, minutes: 80, fullMinutes: 40 }} />);
    expect(view.container.querySelector('[data-pace-saving]')).toHaveTextContent('500 deuterium saved');
    expect(view.container.querySelector('[data-pace-delay]')).toHaveTextContent(`${durationPrecise(40)} later`);
  });

  it('keeps the shared clan control free of personal-flight discounts', () => {
    const view = render(<PaceRow paces={MISSION_PACES} pace={0.5} onChange={vi.fn()} hint="Fuel cost stays unchanged." />);
    expect(view.container.querySelector('[data-pace-comparison]')).toBeNull();
    expect(within(view.container).getByText('Fuel cost stays unchanged.')).toBeVisible();
    expect(view.container).not.toHaveTextContent(/saved|less fuel/i);
  });

  it('hides the control when only full speed is allowed', () => {
    const view = render(<PaceRow paces={[1]} pace={1} onChange={vi.fn()} comparison={comparison} />);
    expect(view.container).toBeEmptyDOMElement();
  });

  it('explains a forced fallback without asking for a speed that is unavailable', () => {
    const view = render(<PaceRow paces={[1]} pace={1} reset onChange={vi.fn()}
      comparison={{ fuel: 1_000, fullFuel: 1_000, minutes: 20, fullMinutes: 20 }} />);
    expect(view.container.querySelector('[data-pace-reset]')).toBeVisible();
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(screen.queryByText(/choose a slower speed/i)).not.toBeInTheDocument();
  });
});
