import { existsSync, readFileSync } from 'node:fs';
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

  it('stays upright on phones: the 350px layout has no landscape form', () => {
    const manifest = new DOMParser().parseFromString(readAndroid('app/src/main/AndroidManifest.xml'), 'text/xml');
    expect(manifest.querySelector('activity')?.getAttribute('android:screenOrientation')).toBe('portrait');
  });

  it('shares only the camera capture folder through its file provider', () => {
    const paths = new DOMParser().parseFromString(readAndroid('app/src/main/res/xml/file_paths.xml'), 'text/xml');
    expect([...paths.documentElement.children].map(node => `${node.tagName}:${node.getAttribute('path') ?? ''}`))
      .toEqual(['external-files-path:Pictures/']);
  });

  it('marks raid alerts in the status bar with a white-on-transparent emblem, not the full-colour icon', () => {
    const manifest = new DOMParser().parseFromString(readAndroid('app/src/main/AndroidManifest.xml'), 'text/xml');
    const meta = (name: string) => [...manifest.querySelectorAll('application > meta-data')]
      .find(node => node.getAttribute('android:name') === name)?.getAttribute('android:resource');
    expect(meta('com.google.firebase.messaging.default_notification_icon')).toBe('@drawable/ic_stat_astera');
    expect(meta('com.google.firebase.messaging.default_notification_color')).toBe('@color/astera_alert');
    const icon = readAndroid('app/src/main/res/drawable/ic_stat_astera.xml');
    expect(icon.match(/android:(?:fill|stroke)Color="([^"]+)"/g)?.every(colour => colour.includes('#FFFFFFFF'))).toBe(true);
    expect(readAndroid('app/src/main/res/values/colors.xml')).toContain('<color name="astera_alert">#2EE6C8</color>');
    // Android's resource compiler refuses malformed XML (a `--` inside a comment, for one) that a browser would shrug off.
    for (const resource of ['res/values/colors.xml', 'res/drawable/ic_stat_astera.xml']) {
      expect(readAndroid(`app/src/main/${resource}`).match(/<!--([\s\S]*?)-->/g)?.every(comment => !comment.slice(4, -3).includes('--')) ?? true, resource).toBe(true);
    }
  });

  it('keeps the whole emblem inside launcher and splash masks', () => {
    for (const icon of ['ic_launcher', 'ic_launcher_round']) {
      expect(readAndroid(`app/src/main/res/mipmap-anydpi-v26/${icon}.xml`)).toContain('android:drawable="@drawable/astera_icon_adaptive"');
    }
    expect(readAndroid('app/src/main/res/drawable/astera_icon_adaptive.xml')).toMatch(/<inset[^>]+android:drawable="@drawable\/astera_icon"[^>]+android:inset="15%"/);
    expect(readAndroid('app/src/main/res/values/styles.xml')).toContain('<item name="windowSplashScreenAnimatedIcon">@drawable/astera_icon_adaptive</item>');
  });

  it('ships the store name and none of the Capacitor template art', () => {
    expect(readAndroid('app/src/main/res/values/strings.xml')).toContain('<string name="app_name">Astera Online</string>');
    for (const density of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
      for (const orientation of ['port', 'land']) expect(existsSync(resolve('android', `app/src/main/res/drawable-${orientation}-${density}/splash.png`))).toBe(false);
      expect(existsSync(resolve('android', `app/src/main/res/mipmap-${density}/ic_launcher_foreground.png`))).toBe(false);
    }
    expect(existsSync(resolve('android', 'app/src/main/res/drawable/splash.png'))).toBe(false);
    expect(existsSync(resolve('android', 'app/src/main/res/drawable-v24/ic_launcher_foreground.xml'))).toBe(false);
  });
});
