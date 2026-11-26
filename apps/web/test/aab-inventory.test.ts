// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { bundleInventory, removedFromBundle } from '../aabInventory.js';

/**
 * Play v16 (2026-11-26) lost the Firebase resources (google_app_id …) because it was built in a checkout
 * without the gitignored file, and closed on start. Every store AAB is compared with the previous Play
 * release; anything the old one had and the new one lacks stops the build.
 */
const varint = (value: number): number[] => {
  const out: number[] = [];
  while (value > 0x7f) { out.push((value & 0x7f) | 0x80); value = Math.floor(value / 128); }
  out.push(value);
  return out;
};
const field = (number: number, payload: Buffer | string): Buffer => {
  const bytes = typeof payload === 'string' ? Buffer.from(payload) : payload;
  return Buffer.from([...varint((number << 3) | 2), ...varint(bytes.length), ...bytes]);
};
const number = (fieldNumber: number, value: number) => Buffer.from([...varint(fieldNumber << 3), ...varint(value)]);
const message = (...parts: Buffer[]) => Buffer.concat(parts);

/** aapt2's ResourceTable: package(2) → type(3){name(2), entry(3){name(2)}}. */
const resources = (types: Record<string, string[]>) => message(
  field(1, 'string pool'),
  field(2, message(field(2, 'space.asteraonline.app'), ...Object.entries(types).map(([type, names]) =>
    field(3, message(field(1, number(1, 7)), field(2, type), ...names.map(name => field(3, message(field(1, number(1, 3)), field(2, name)))))))),
  ),
);
const ANDROID = 'http://schemas.android.com/apk/res/android';
/** aapt2's XmlNode: element(1){namespace_uri(2), name(3), attribute(4){namespace_uri(1), name(2), value(3)}, child(5)}. */
const element = (name: string, androidName: string | null, ...children: Buffer[]) => field(1, message(
  field(3, name),
  ...(androidName ? [field(4, message(field(1, ANDROID), field(2, 'name'), field(3, androidName), number(5, 16842755)))] : []),
  ...children.map(child => field(5, child)),
));
const manifest = (...children: Buffer[]) => element('manifest', null, element('application', null, ...children));

function bundle(over: { types?: Record<string, string[]>; manifest?: Buffer; files?: string[]; plugins?: string[] } = {}) {
  const contents: Record<string, Buffer> = {
    'base/resources.pb': resources(over.types ?? { string: ['app_name', 'google_app_id'], drawable: ['ic_stat_astera'] }),
    'base/manifest/AndroidManifest.xml': over.manifest ?? manifest(
      element('uses-permission', 'android.permission.POST_NOTIFICATIONS'),
      element('service', 'com.google.firebase.messaging.FirebaseMessagingService'),
      element('meta-data', 'com.google.firebase.components:com.google.firebase.messaging.FirebaseMessagingRegistrar'),
    ),
    'base/assets/capacitor.plugins.json': Buffer.from(JSON.stringify((over.plugins ?? ['ee.forgr.capacitor_updater.CapacitorUpdaterPlugin']).map(classpath => ({ pkg: 'x', classpath })))),
  };
  const files = over.files ?? ['base/lib/arm64-v8a/libsqlite.so', 'base/root/firebase-messaging.properties', 'base/assets/public/index.html', 'base/assets/public/assets/index-1.js'];
  const entries = [...Object.keys(contents), ...files, 'base/dex/classes.dex'];
  return bundleInventory(entries, name => {
    const content = contents[name];
    if (!content) throw new Error(`not in bundle: ${name}`);
    return content;
  });
}

describe('what a store bundle holds', () => {
  it('lists resources, manifest components, native libraries, root files and plugins, and not the game files', () => {
    expect(bundle()).toEqual([
      'file base/lib/arm64-v8a/libsqlite.so',
      'file base/root/firebase-messaging.properties',
      'manifest meta-data com.google.firebase.components:com.google.firebase.messaging.FirebaseMessagingRegistrar',
      'manifest service com.google.firebase.messaging.FirebaseMessagingService',
      'manifest uses-permission android.permission.POST_NOTIFICATIONS',
      'plugin ee.forgr.capacitor_updater.CapacitorUpdaterPlugin',
      'resource drawable/ic_stat_astera',
      'resource string/app_name',
      'resource string/google_app_id',
    ]);
  });

  it('refuses a bundle it cannot read rather than comparing nothing', () => {
    expect(() => bundleInventory(['base/dex/classes.dex'], () => Buffer.alloc(0))).toThrow(/resources\.pb/);
  });
});

describe('comparing with the previous Play release', () => {
  it('names the Firebase resources a build without google-services.json lost (Play v16)', () => {
    expect(removedFromBundle(bundle(), bundle({ types: { string: ['app_name'], drawable: ['ic_stat_astera'] } }))).toEqual(['resource string/google_app_id']);
  });

  it('names a lost permission, component, library and plugin', () => {
    const next = bundle({ manifest: manifest(element('service', 'com.google.firebase.messaging.FirebaseMessagingService')), files: [], plugins: [] });
    expect(removedFromBundle(bundle(), next)).toEqual([
      'file base/lib/arm64-v8a/libsqlite.so',
      'file base/root/firebase-messaging.properties',
      'manifest meta-data com.google.firebase.components:com.google.firebase.messaging.FirebaseMessagingRegistrar',
      'manifest uses-permission android.permission.POST_NOTIFICATIONS',
      'plugin ee.forgr.capacitor_updater.CapacitorUpdaterPlugin',
    ]);
  });

  it('lets a release add things and change the game files', () => {
    const next = bundle({ types: { string: ['app_name', 'google_app_id', 'new_text'], drawable: ['ic_stat_astera'] },
      files: ['base/lib/arm64-v8a/libsqlite.so', 'base/root/firebase-messaging.properties', 'base/assets/public/index.html', 'base/assets/public/assets/index-2.js'] });
    expect(removedFromBundle(bundle(), next)).toEqual([]);
  });
});
