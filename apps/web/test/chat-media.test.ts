import { describe, expect, it } from 'vitest';
import { youtubeVideoId } from '../src/lib/chatMedia.js';

describe('YouTube chat link parsing', () => {
  it.each(['https://youtu.be/dQw4w9WgXcQ?t=20', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://youtube.com/shorts/dQw4w9WgXcQ', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'])('normalizes %s', url => {
    expect(youtubeVideoId(url)).toBe('dQw4w9WgXcQ');
  });
  it.each(['javascript:alert(1)', 'https://youtube.com.evil.org/watch?v=dQw4w9WgXcQ', 'https://youtu.be.evil/dQw4w9WgXcQ', 'https://youtube.com/watch?v=bad', 'https://youtube.com@evil.com/watch?v=dQw4w9WgXcQ', 'http://youtube.com/watch?v=dQw4w9WgXcQ'])('rejects %s', url => {
    expect(youtubeVideoId(url)).toBeNull();
  });
});
