import { useMemo } from 'react';
import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
  'p', 'br', 'h2', 'h3', 'strong', 'em', 'u', 's', 'blockquote', 'ul', 'ol', 'li',
  'pre', 'code', 'hr', 'a', 'img', 'div', 'iframe',
];
const ALLOWED_ATTR = [
  'href', 'title', 'target', 'rel', 'src', 'alt', 'loading', 'referrerpolicy',
  'data-youtube-video', 'sandbox', 'allow', 'allowfullscreen',
];
const YOUTUBE_HOSTS = new Set([
  'www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com', 'youtube-nocookie.com',
]);

const isRelativePath = (value: string): boolean => value.startsWith('/') && !value.startsWith('//');

const safeImageSource = (value: string): boolean => {
  if (isRelativePath(value)) return true;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

const safeLinkTarget = (value: string): boolean => {
  if (isRelativePath(value)) return true;
  try {
    return ['https:', 'http:', 'mailto:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

const safeYoutubeEmbed = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && YOUTUBE_HOSTS.has(url.hostname)
      && url.pathname.startsWith('/embed/');
  } catch {
    return false;
  }
};

/** A second allow-list at the exact browser sink, even though the server stores only clean HTML. */
export function sanitizeRenderedHtml(raw: string): string {
  const clean = DOMPurify.sanitize(raw, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    FORBID_ATTR: ['style', 'srcdoc', 'id', 'class'],
  });
  const template = document.createElement('template');
  template.innerHTML = clean;
  for (const frame of template.content.querySelectorAll('iframe')) {
    if (!safeYoutubeEmbed(frame.getAttribute('src') ?? '')) {
      frame.remove();
      continue;
    }
    frame.setAttribute('loading', 'lazy');
    frame.setAttribute('referrerpolicy', 'no-referrer');
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
    frame.setAttribute('allow', 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture');
    frame.setAttribute('allowfullscreen', '');
  }
  for (const link of template.content.querySelectorAll('a')) {
    if (!safeLinkTarget(link.getAttribute('href') ?? '')) {
      link.removeAttribute('href');
      link.removeAttribute('target');
      link.removeAttribute('rel');
      continue;
    }
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer nofollow');
  }
  for (const image of template.content.querySelectorAll('img')) {
    if (!safeImageSource(image.getAttribute('src') ?? '')) {
      image.remove();
      continue;
    }
    image.setAttribute('loading', 'lazy');
    image.setAttribute('referrerpolicy', 'no-referrer');
  }
  return template.innerHTML;
}

export function RichContent({ html, className = '' }: { html: string; className?: string }) {
  const safe = useMemo(() => sanitizeRenderedHtml(html), [html]);
  return (
    <div
      className={`announcement-content ${className}`}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
