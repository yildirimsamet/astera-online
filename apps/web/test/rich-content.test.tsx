import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RichContent, sanitizeRenderedHtml } from '../src/ui/RichContent.js';

describe('announcement browser sink', () => {
  it('removes scripts, handlers, inline CSS and hostile embeds before rendering', () => {
    const clean = sanitizeRenderedHtml(`
      <script>alert(1)</script>
      <p style="position:fixed" onclick="alert(1)">Safe words</p>
      <img src="x" onerror="alert(1)">
      <a href="ftp://evil.example/file">hostile link</a>
      <iframe src="https://evil.example/embed/1"></iframe>
    `);
    expect(clean).not.toMatch(/script|onclick|onerror|style=/i);
    expect(clean).not.toContain('<iframe');
    expect(clean).not.toContain('ftp://');
    render(<RichContent html={clean} />);
    expect(screen.getByText('Safe words')).toBeInTheDocument();
  });

  it('keeps responsive authored media and hardens links at the sink', () => {
    render(
      <RichContent html={`
        <p><a href="https://example.com">Read more</a></p>
        <img src="https://cdn.example/shot.png" alt="Galaxy shot">
        <iframe src="https://www.youtube-nocookie.com/embed/abc"></iframe>
      `} />,
    );
    expect(screen.getByRole('link', { name: 'Read more' })).toHaveAttribute(
      'rel', 'noopener noreferrer nofollow',
    );
    expect(screen.getByRole('img', { name: 'Galaxy shot' })).toBeInTheDocument();
    expect(document.querySelector('iframe')).toHaveAttribute(
      'src', 'https://www.youtube-nocookie.com/embed/abc',
    );
  });
});
