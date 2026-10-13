import { renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useFrame } from '@react-three/fiber';
import { GalaxyVisualPhase, useGalaxyCulling, useVisualFrame } from '../src/galaxy/visualFrame.js';
vi.mock('@react-three/fiber', () => ({ useFrame: vi.fn() }));
it('runs visual buffers after movement/camera and before the galaxy render, without taking over previews', () => {
  const callback = vi.fn();
  const preview = renderHook(() => { useVisualFrame(callback); return useGalaxyCulling(); });
  expect(preview.result.current).toBe(false);
  expect(useFrame).toHaveBeenLastCalledWith(callback, 0);
  const galaxy = renderHook(() => { useVisualFrame(callback); return useGalaxyCulling(); }, { wrapper: GalaxyVisualPhase });
  expect(galaxy.result.current).toBe(true);
  expect(useFrame).toHaveBeenLastCalledWith(callback, 0.5);
});
