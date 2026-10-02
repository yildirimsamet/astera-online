import { Children, isValidElement, type ReactNode } from 'react';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SkinPreview } from '../src/screens/SkinPreview.js';

let markRendered: (() => void) | undefined;

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: ReactNode }) =>
    <div>{Children.toArray(children).filter((child) => isValidElement(child) && typeof child.type !== 'string')}</div>,
}));
vi.mock('@react-three/drei', () => ({
  Html: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  OrbitControls: ({ autoRotate }: { autoRotate: boolean }) =>
    <div data-testid="orbit-controls" data-auto-rotate={String(autoRotate)} />,
}));
vi.mock('../src/galaxy/PlanetSkinModel.js', () => ({
  previewSkinNode: () => ({ id: 'shop-preview' }),
  PlanetSkinModel: ({ freezeRotation, onRendered }: { freezeRotation?: boolean; onRendered?: () => void }) => {
    markRendered = onRendered;
    return <div data-testid="planet-model" data-frozen={String(Boolean(freezeRotation))} />;
  },
}));
vi.mock('../src/galaxy/SkinAssetBoundary.js', () => ({
  SkinAssetBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

describe('skin card preview', () => {
  it('freezes both rotations and reports readiness only after the model renders', () => {
    render(<SkinPreview skinId="planet-spain" status="NORMAL" still />);
    expect(screen.getByTestId('planet-model')).toHaveAttribute('data-frozen', 'true');
    expect(screen.getByTestId('orbit-controls')).toHaveAttribute('data-auto-rotate', 'false');
    const stage = document.querySelector('[data-skin-stage]');
    expect(stage).toHaveAttribute('data-skin-ready', 'false');
    act(() => { markRendered?.(); });
    expect(stage).toHaveAttribute('data-skin-ready', 'true');
  });

  it('keeps the interactive shop preview rotating', () => {
    render(<SkinPreview skinId="planet-japan" status="NORMAL" />);
    expect(screen.getByTestId('planet-model')).toHaveAttribute('data-frozen', 'false');
    expect(screen.getByTestId('orbit-controls')).toHaveAttribute('data-auto-rotate', 'true');
    expect(document.querySelector('[data-skin-stage]')).not.toHaveAttribute('data-skin-ready');
  });
});
