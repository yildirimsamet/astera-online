/**
 * WHAT A STORE BUNDLE HOLDS, so a release cannot silently lose what the last one had.
 *
 * Play v16 (2026-11-26) was built in a checkout without the gitignored google-services.json: the
 * build passed, the Firebase resources (google_app_id …) were simply absent, and the app closed on
 * start. Comparing the new AAB with the previous Play release names that loss before upload.
 *
 * Listed: resource names (type/name), manifest components and permissions, native libraries,
 * root files, assets outside the game bundle, and Capacitor plugins. The game files
 * (assets/public) change every release and are not listed. Values are not compared: a resource
 * or a permission that is there with another value is a change, not a loss.
 */
import { execFileSync } from 'node:child_process';

/** One protobuf field: a nested message or string (wire type 2) is kept as bytes; others are skipped. */
function* fields(bytes: Buffer): Generator<{ number: number; bytes: Buffer }> {
  let at = 0;
  const varint = (): number => {
    let value = 0; let scale = 1;
    for (;;) {
      const byte = bytes[at++];
      if (byte === undefined) throw new Error('Truncated protobuf');
      value += (byte & 0x7f) * scale; scale *= 128;
      if (byte < 0x80) return value;
    }
  };
  while (at < bytes.length) {
    const key = varint();
    const wire = key % 8;
    if (wire === 0) varint();
    else if (wire === 1) at += 8;
    else if (wire === 5) at += 4;
    else if (wire === 2) {
      const length = varint();
      if (at + length > bytes.length) throw new Error('Truncated protobuf');
      yield { number: Math.floor(key / 8), bytes: bytes.subarray(at, at + length) };
      at += length;
    } else throw new Error(`Unsupported protobuf wire type ${wire}`);
  }
}
const children = (bytes: Buffer, number: number): Buffer[] => [...fields(bytes)].filter(item => item.number === number).map(item => item.bytes);
const text = (bytes: Buffer, number: number): string => children(bytes, number)[0]?.toString('utf8') ?? '';

/** aapt2 ResourceTable: package(2) → type(3){name(2), entry(3){name(2)}}. */
function resourceNames(table: Buffer): string[] {
  return children(table, 2).flatMap(pkg => children(pkg, 3).flatMap(type =>
    children(type, 3).map(entry => `resource ${text(type, 2)}/${text(entry, 2)}`)));
}

const ANDROID = 'http://schemas.android.com/apk/res/android';
const COMPONENTS = new Set(['uses-permission', 'uses-permission-sdk-23', 'uses-feature', 'uses-library',
  'activity', 'activity-alias', 'service', 'receiver', 'provider', 'meta-data']);

/** aapt2 XmlNode: element(1){name(3), attribute(4){namespace_uri(1), name(2), value(3)}, child(5) XmlNode}. */
function manifestComponents(node: Buffer): string[] {
  return children(node, 1).flatMap(element => {
    const name = text(element, 3);
    const androidName = children(element, 4).find(attribute => text(attribute, 1) === ANDROID && text(attribute, 2) === 'name');
    const own = COMPONENTS.has(name) && androidName ? [`manifest ${name} ${text(androidName, 3)}`] : [];
    return [...own, ...children(element, 5).flatMap(manifestComponents)];
  });
}

const RESOURCES = 'base/resources.pb';
const MANIFEST = 'base/manifest/AndroidManifest.xml';
const PLUGINS = 'base/assets/capacitor.plugins.json';

/** Everything the bundle holds that a later release must not lose, sorted. */
export function bundleInventory(entries: string[], read: (entry: string) => Buffer): string[] {
  for (const required of [RESOURCES, MANIFEST]) if (!entries.includes(required)) throw new Error(`Not an app bundle: no ${required}`);
  const files = entries.filter(entry => (entry.startsWith('base/lib/') || entry.startsWith('base/root/')
    || entry.startsWith('base/assets/') && !entry.startsWith('base/assets/public/')) && !entry.endsWith('/'));
  const plugins = entries.includes(PLUGINS)
    ? (JSON.parse(read(PLUGINS).toString('utf8')) as { classpath?: unknown }[]).map(plugin => `plugin ${String(plugin.classpath)}`)
    : [];
  return [...new Set([...resourceNames(read(RESOURCES)), ...manifestComponents(read(MANIFEST)),
    ...files.filter(entry => entry !== PLUGINS).map(entry => `file ${entry}`), ...plugins])].sort();
}

/** What the previous release held and the next one lacks. */
export function removedFromBundle(previous: string[], next: string[]): string[] {
  const kept = new Set(next);
  return previous.filter(item => !kept.has(item));
}

/** The inventory of an .aab on disk, read with `unzip`. */
export function readBundleInventory(path: string): string[] {
  const entries = execFileSync('unzip', ['-Z1', path], { encoding: 'utf8' }).split('\n').filter(Boolean);
  return bundleInventory(entries, entry => execFileSync('unzip', ['-p', path, entry], { maxBuffer: 512 * 1024 * 1024 }));
}
