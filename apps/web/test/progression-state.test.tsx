import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UpgradeRow } from '../src/ui/UpgradeRow.js';

const base = {
  art: '/owned.png',
  name: 'Owned system',
  role: 'A system already installed.',
  cost: { alloy: 100, crystal: 20 },
  held: { alloy: 1_000, crystal: 1_000 },
  verb: 'raise' as const,
  onAct: vi.fn(),
};

describe('shared progression presentation', () => {
  it('keeps owned art open when only its next action is locked', () => {
    const view = render(
      <UpgradeRow {...base} level={3} blocked={{ reason: 'Needs Core L4' }} />,
    );
    const art = view.container.querySelector<HTMLImageElement>('[data-art] > img');
    expect(art).not.toHaveClass('grayscale');
    expect(view.container.querySelector('[data-lock-state="closed"]')).toBeInTheDocument();
    expect(view.container.querySelector('[data-art] svg')).toBeNull();
  });

  it('uses open completed state instead of a lock at the real maximum', () => {
    const view = render(
      <UpgradeRow {...base} level={5} completed="Completed" blocked={{ reason: 'Needs Core L6' }} />,
    );
    expect(view.container.querySelector('[data-progression-state="complete"]')).toBeInTheDocument();
    expect(view.container.querySelector('[data-lock-state="open"]')).toHaveTextContent('Completed');
    expect(view.container.querySelector('[data-art] > img')).not.toHaveClass('grayscale');
  });

  it('acknowledges a successful queued tap before showing the next refusal', () => {
    const view = render(
      <UpgradeRow
        {...base}
        queued="1 order queued"
        queuedActionable
        pending
        blocked={{ reason: 'that build queue is full' }}
      />,
    );
    expect(view.container.querySelector('[data-lock-state="open"]'))
      .toHaveTextContent('1 order queued');
    expect(view.container.querySelector('[data-lock-state="closed"]')).toBeNull();
  });

  it('keeps the acknowledgement through the success flash after pending ends', () => {
    const view = render(
      <UpgradeRow
        {...base}
        queued="1 order queued"
        queuedActionable
        flash
        blocked={{ reason: 'that build queue is full' }}
      />,
    );
    expect(view.container.querySelector('[data-lock-state="open"]'))
      .toHaveTextContent('1 order queued');
    expect(view.container.querySelector('[data-lock-state="closed"]')).toBeNull();
  });

  it('shows the next real refusal after acknowledgement has ended', () => {
    const view = render(
      <UpgradeRow
        {...base}
        queued="1 order queued"
        queuedActionable
        blocked={{ reason: 'that build queue is full' }}
      />,
    );
    expect(view.container.querySelector('[data-lock-state="closed"]'))
      .toHaveTextContent('that build queue is full');
  });

  it('locks and desaturates only an unmet, never-owned item', () => {
    const view = render(
      <UpgradeRow {...base} unowned blocked={{ reason: 'Needs Shipyard L4' }} />,
    );
    expect(view.container.querySelector('[data-art] > img')).toHaveClass('grayscale');
    expect(view.container.querySelector('[data-art] svg')).toBeInTheDocument();
  });
});
