import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SkinAssetBoundary } from '../src/galaxy/SkinAssetBoundary.jsx';

function FailedAsset(): never {
  throw new Error('model request failed');
}

describe('skin asset loading', () => {
  it('keeps the fallback visible if a model fails and recovers for a different look', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fallback = <span>Planet PNG</span>;
    const view = render(<SkinAssetBoundary key="broken" fallback={fallback}><FailedAsset /></SkinAssetBoundary>);
    expect(screen.getByText('Planet PNG')).toBeTruthy();
    view.rerender(<SkinAssetBoundary key="new-look" fallback={fallback}><span>Loaded model</span></SkinAssetBoundary>);
    expect(screen.getByText('Loaded model')).toBeTruthy();
  });
});
