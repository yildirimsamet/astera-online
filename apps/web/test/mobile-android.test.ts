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

  it('allows temporary OS bars by edge swipe while preserving Capacitor inset handling', () => {
    const host = readAndroid('app/src/main/java/space/asteraonline/app/debug/MainActivity.java');
    expect(host).toContain('WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE');
    expect(host).not.toContain('setOnApplyWindowInsetsListener');
    expect(host).not.toContain('setDecorFitsSystemWindows');
  });
});
