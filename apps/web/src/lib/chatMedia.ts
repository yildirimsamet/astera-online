/** Reject lookalike hosts and retain only the video identity, never arbitrary embed HTML. */
export function youtubeVideoId(input: string): string | null {
  try {
    const url = new URL(input.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    const hosts = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'];
    const segments = url.pathname.split('/').filter(Boolean);
    const id = url.hostname === 'youtu.be' && segments.length === 1 ? segments[0]
      : hosts.includes(url.hostname) && url.pathname === '/watch' ? url.searchParams.get('v')
      : hosts.includes(url.hostname) && ['embed', 'shorts', 'live'].includes(segments[0] ?? '') && segments.length === 2 ? segments[1] : null;
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}
