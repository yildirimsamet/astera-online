import { Suspense } from 'react';
import { act, render, screen } from '@testing-library/react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { useGltfPair } from '../src/galaxy/useGltfPair.js';
import { SkinAssetBoundary } from '../src/galaxy/SkinAssetBoundary.js';

interface Model { scene: THREE.Group }
const jobs = vi.hoisted(() => ({
  urls: [] as string[],
  pending: new Map<string, (model: Model) => void>(),
  failed: new Map<string, (error: Error) => void>(),
}));
// Use Fiber's real Suspense cache; substitute only the model's file loader.
vi.mock('@react-three/drei', async () => {
  const { useLoader } = await import('@react-three/fiber');
  const { Loader } = await import('three');
  class ModelLoader extends Loader<Model> {
    override load(url: string, onLoad?: (model: Model) => void, _onProgress?: (event: ProgressEvent) => void, onError?: (error: unknown) => void) {
      jobs.urls.push(url);
      if (onLoad) jobs.pending.set(url, onLoad);
      if (onError) jobs.failed.set(url, onError);
    }
  }
  return { useGLTF: Object.assign((input: string | string[]) => useLoader(ModelLoader, input), {
    preload: (input: string | string[]) => { useLoader.preload(ModelLoader, input); },
  }) };
});

function Pair({ full, low }: { full: string; low: string }) {
  const [model, lod] = useGltfPair(full, low);
  return <div data-testid="models" data-full={model.scene.uuid} data-low={lod.scene.uuid} />;
}
async function finish(url: string) {
  const model = { scene: new THREE.Group() };
  const loaded = jobs.pending.get(url);
  if (!loaded) throw new Error(`Missing model request ${url}`);
  await act(async () => { loaded(model); await Promise.resolve(); });
  return model;
}
const pair = (full: string, low: string) => <Suspense fallback={<div>loading</div>}><Pair full={full} low={low} /></Suspense>;

it('starts both uncached tiers together and waits for both models', async () => {
  const full = 'parallel-full.glb', low = 'parallel-low.glb';
  render(pair(full, low));
  expect(jobs.urls.slice(-2)).toEqual([full, low]);
  const model = await finish(full);
  expect(screen.queryByTestId('models')).not.toBeInTheDocument();
  const lod = await finish(low);
  expect(screen.getByTestId('models')).toHaveAttribute('data-full', model.scene.uuid);
  expect(screen.getByTestId('models')).toHaveAttribute('data-low', lod.scene.uuid);
});

it('reuses previously parsed individual URLs and retains an unchanged tier on replacement', async () => {
  const full = 'cached-full.glb', low = 'cached-low.glb';
  useGLTF.preload(full, false);
  useGLTF.preload(low, false);
  const model = await finish(full), lod = await finish(low);
  const loadedCount = jobs.urls.length;
  const view = render(pair(full, low));
  expect(jobs.urls).toHaveLength(loadedCount);
  expect(screen.getByTestId('models')).toHaveAttribute('data-full', model.scene.uuid);
  expect(screen.getByTestId('models')).toHaveAttribute('data-low', lod.scene.uuid);
  view.rerender(pair('replacement-full.glb', low));
  expect(jobs.urls.slice(loadedCount)).toEqual(['replacement-full.glb']);
  const replacement = await finish('replacement-full.glb');
  expect(screen.getByTestId('models')).toHaveAttribute('data-full', replacement.scene.uuid);
  expect(screen.getByTestId('models')).toHaveAttribute('data-low', lod.scene.uuid);
});

it('uses one parsed asset when both tiers have the same URL', async () => {
  const url = 'one-tier.glb';
  const loadedCount = jobs.urls.length;
  render(pair(url, url));
  expect(jobs.urls.slice(loadedCount)).toEqual([url]);
  const model = await finish(url);
  expect(screen.getByTestId('models')).toHaveAttribute('data-full', model.scene.uuid);
  expect(screen.getByTestId('models')).toHaveAttribute('data-low', model.scene.uuid);
});

it('deduplicates in-flight requests across overlapping consumers', async () => {
  const full = 'concurrent-full.glb', low = 'concurrent-low.glb';
  const loadedCount = jobs.urls.length;
  render(<><Suspense fallback={null}><Pair full={full} low={low} /></Suspense>
    <Suspense fallback={null}><Pair full={full} low={low} /></Suspense></>);
  expect(jobs.urls.slice(loadedCount)).toEqual([full, low]);
  await finish(full);
  await finish(low);
  expect(screen.getAllByTestId('models')).toHaveLength(2);
});

it.each(['full', 'low'] as const)('preserves the existing asset fallback if the %s tier fails', async failedTier => {
  const full = `failed-${failedTier}-full.glb`, low = `failed-${failedTier}-low.glb`;
  const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    render(<SkinAssetBoundary fallback={<div>asset unavailable</div>}>{pair(full, low)}</SkinAssetBoundary>);
    if (failedTier === 'low') await finish(full);
    const failed = jobs.failed.get(failedTier === 'full' ? full : low);
    if (!failed) throw new Error('Missing rejection callback');
    await act(async () => { failed(new Error('404')); await Promise.resolve(); });
    expect(screen.getByText('asset unavailable')).toBeInTheDocument();
    expect(screen.queryByTestId('models')).not.toBeInTheDocument();
    if (failedTier === 'full') await finish(low);
  } finally { error.mockRestore(); }
});
