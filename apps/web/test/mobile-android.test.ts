import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readAndroid = (path: string): string => readFileSync(resolve('android', path), 'utf8');

describe('the local Android host', () => {
  it('resizes the web viewport for the soft keyboard and uses GPU rendering', () => {
    const manifest = new DOMParser().parseFromString(readAndroid('app/src/main/AndroidManifest.xml'), 'text/xml');
    const activity = manifest.querySelector('activity');
    expect(activity?.getAttribute('android:windowSoftInputMode')).toBe('adjustResize');
    expect(manifest.querySelector('application')?.getAttribute('android:hardwareAccelerated')).toBe('true');
  });
});
