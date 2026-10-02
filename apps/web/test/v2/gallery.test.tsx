import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../src/ui/Toast.js';
import { Gallery } from '../../src/v2/gallery/Gallery.js';

vi.mock('../../src/screens/SkinPreview.js', () => ({
  SkinPreview: () => <div data-testid="skin-preview" />,
}));

/**
 * THE v2 GALLERY STILL DRAWS. It is how every piece of the redesign is looked at
 * before it ships (owner instruction: nothing is built blind), so a gallery that
 * throws is a camera that stopped working.
 */

describe('the v2 gallery', () => {
  it('draws every section', () => {
    render(<ToastProvider><Gallery view={null} /></ToastProvider>);
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(11);
  });

  it.each(['peek', 'queue', 'bell', 'view'])('draws the %s view', (view) => {
    render(<ToastProvider><Gallery view={view} /></ToastProvider>);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it.each(['skin-shop', 'skin-shop-live'])('quotes every non-Turkey country skin in EUR in %s', (view) => {
    render(<ToastProvider><Gallery view={view} /></ToastProvider>);
    fireEvent.click(screen.getByRole('tab', { name: /country worlds/i }));
    for (const name of ['Germany', 'France', 'Spain', 'Japan']) {
      expect(screen.getByRole('button', { name: new RegExp(`${name}.*€2\\.99`, 'i') })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: /Turkey.*(?:₺99|TRY\s*99)/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Germany.*€2\.99/i }));
    expect(screen.queryByRole('link', { name: /shopier/i })).toBeNull();
  });
});
