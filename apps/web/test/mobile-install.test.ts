// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { installCommands } from '../mobileInstall.js';

describe('install the requested Android artifact only', () => {
  it('refuses a bundled APK left in the live-reload Gradle output before running ADB', () => {
    expect(() => installCommands('live-reload', 'space.asteraonline.app.local', '/tmp/app.apk')).toThrow(/applicationId/i);
  });
  it('reverses the backend port, not Vite, for bundled local testing', () => {
    const commands = installCommands('native-local', 'space.asteraonline.app.local', '/tmp/with space/app.apk');
    expect(commands[0]).toEqual(['reverse', 'tcp:3100', 'tcp:3100']);
    expect(commands[1]).toEqual(['install', '-r', '/tmp/with space/app.apk']);
    expect(commands[2]).toEqual(['shell', 'am', 'start', '-n', 'space.asteraonline.app.local/space.asteraonline.app.debug.MainActivity']);
    expect(commands.flat()).not.toContain('tcp:5173');
  });
  it('retains the Vite reverse for live-reload and never reverses a remote API', () => {
    expect(installCommands('live-reload', 'space.asteraonline.app.debug', '/tmp/app.apk')[0]).toEqual(['reverse', 'tcp:5173', 'tcp:5173']);
    expect(installCommands('native-staging', 'space.asteraonline.app.staging', '/tmp/app.apk')).toHaveLength(2);
  });
  it('rejects unknown targets and another target’s applicationId', () => {
    expect(() => installCommands('android', 'space.asteraonline.app', '/tmp/app.apk')).toThrow();
    expect(() => installCommands('native-staging', 'space.asteraonline.app', '/tmp/app.apk')).toThrow(/applicationId/i);
  });
});
