import { Capacitor } from '@capacitor/core';
import { render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { ChatMediaAttachment } from '../src/screens/ChatMediaAttachment.js';
import { RichContent } from '../src/ui/RichContent.js';
import { resolveCapabilities } from '../src/platform/runtime.js';
import { nativeHtml } from '../nativeBundlePlugin.js';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
it.each(['android', 'ios', 'future-native'])('does not create YouTube frames or thumbnails in %s', platform => {
  vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true); vi.spyOn(Capacitor, 'getPlatform').mockReturnValue(platform);
  const api = new Api({ authTransport: null });
  render(<ApiProvider api={api}><ChatMediaAttachment media={{ kind: 'youtube', videoId: 'abcdefghijk' }} /></ApiProvider>);
  expect(document.querySelector('iframe,img')).toBeNull();
  expect(screen.getByRole('link', { name: 'Open on YouTube' })).toHaveAttribute('href', 'https://www.youtube.com/watch?v=abcdefghijk');
  expect(screen.getByText(/outside Astera Online/)).toBeInTheDocument();
});
it('fails closed for third-party embeds when a native bundle is opened in a web runtime', () => {
  expect(resolveCapabilities('web', 'native-production')).toHaveProperty('thirdPartyEmbeds', false);
  expect(resolveCapabilities('web', 'web')).toHaveProperty('thirdPartyEmbeds', true);
  vi.stubEnv('VITE_ASTERA_PLATFORM', 'native-production');
  render(<ApiProvider api={new Api({ authTransport: null })}><ChatMediaAttachment media={{ kind: 'youtube', videoId: 'abcdefghijk' }} /></ApiProvider>);
  expect(document.querySelector('iframe')).toBeNull(); expect(screen.getByRole('link', { name: 'Open on YouTube' })).toBeInTheDocument();
});
it('replaces native announcement embeds and remote images with safe explicit links while keeping local images', () => {
  vi.stubEnv('VITE_ASTERA_PLATFORM', 'native-production');
  render(<RichContent html={'<p>Announcement</p><iframe src="https://www.youtube-nocookie.com/embed/abcdefghijk?autoplay=1"></iframe><img src="https://cdn.example/shot.png" alt="Galaxy"><img src="/assets/planet.png" alt="Local world"><img src="javascript:alert(1)"><iframe src="https://evil.example/embed/x"></iframe>'} />);
  expect(document.querySelector('iframe')).toBeNull();
  expect(screen.getAllByRole('img')).toHaveLength(1); expect(screen.getByRole('img', { name: 'Local world' })).toHaveAttribute('src', '/assets/planet.png');
  expect(screen.getByRole('link', { name: 'Open on YouTube' })).toHaveAttribute('href', 'https://www.youtube.com/watch?v=abcdefghijk');
  const image = screen.getByRole('link', { name: /Open external image/ }); expect(image).toHaveAttribute('href', 'https://cdn.example/shot.png');
  expect(image).toHaveAttribute('rel', 'noopener noreferrer nofollow'); expect(document.body.innerHTML).not.toContain('javascript:');
});
it('does not grant native documents a third-party frame origin', () => {
  const html = nativeHtml('<html><head><meta charset="utf-8"></head><body></body></html>', 'https://api.example.test');
  expect(html).toContain("frame-src 'none'"); expect(html).not.toContain('frame-src https://www.youtube');
});

it('does not treat a backslash or network-path image URL as a local native asset', () => {
  vi.stubEnv('VITE_ASTERA_PLATFORM', 'native-production');
  render(<RichContent html={'<img src="/\\evil.example/track.png" alt="Backslash"><img src="//evil.example/track.png" alt="Network path">'} />);
  expect(document.querySelector('img')).toBeNull();
});
