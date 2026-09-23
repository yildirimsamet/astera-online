import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ToastProvider } from '../../src/ui/Toast.js';
import { Gallery } from '../../src/v2/gallery/Gallery.js';

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
});
