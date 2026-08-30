import sanitizeHtml from 'sanitize-html';

const ACTIVE_TAGS = new Set([
  'script', 'style', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select',
  'option', 'svg', 'math', 'template', 'base', 'meta', 'link', 'audio', 'video', 'source',
]);
const ACTIVE_ATTRIBUTES = new Set(['style', 'srcdoc', 'formaction', 'action', 'ping']);
const YOUTUBE_HOSTS = new Set([
  'www.youtube.com',
  'youtube.com',
  'www.youtube-nocookie.com',
  'youtube-nocookie.com',
]);

const isRelativePath = (value: string): boolean => value.startsWith('/') && !value.startsWith('//');

const safeUrl = (value: string, kind: 'link' | 'image' | 'youtube'): boolean => {
  if (isRelativePath(value)) return kind !== 'youtube';
  try {
    const url = new URL(value);
    if (kind === 'link') return ['https:', 'http:', 'mailto:'].includes(url.protocol);
    if (kind === 'image') return url.protocol === 'https:';
    return url.protocol === 'https:'
      && YOUTUBE_HOSTS.has(url.hostname)
      && url.pathname.startsWith('/embed/');
  } catch {
    return false;
  }
};

export interface SanitizedAnnouncement {
  html: string;
  rejected: readonly string[];
}

/**
 * Parse rich text, reject active payloads, then keep only the authored formatting surface.
 *
 * Rejection is separate from stripping on purpose. An unsupported harmless tag may lose its
 * formatting; a script, event handler or executable URL tells the operator the draft is unsafe
 * and nothing is persisted.
 */
export function sanitizeAnnouncementHtml(raw: string): SanitizedAnnouncement {
  const rejected = new Set<string>();
  const html = sanitizeHtml(raw, {
    allowedTags: [
      'p', 'br', 'h2', 'h3', 'strong', 'em', 'u', 's', 'blockquote', 'ul', 'ol', 'li',
      'pre', 'code', 'hr', 'a', 'img', 'div', 'iframe',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'loading', 'referrerpolicy'],
      div: ['data-youtube-video'],
      iframe: [
        'src', 'title', 'allow', 'allowfullscreen', 'loading', 'referrerpolicy', 'sandbox',
      ],
    },
    allowedSchemes: ['https', 'http', 'mailto'],
    allowedSchemesByTag: { img: ['https'], iframe: ['https'] },
    allowedIframeHostnames: [...YOUTUBE_HOSTS],
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    nestingLimit: 20,
    parseStyleAttributes: false,
    onOpenTag: (tagName, attributes) => {
      if (ACTIVE_TAGS.has(tagName)) rejected.add(`tag:${tagName}`);
      for (const [name, value] of Object.entries(attributes)) {
        const lowerName = name.toLowerCase();
        if (lowerName.startsWith('on') || ACTIVE_ATTRIBUTES.has(lowerName)) {
          rejected.add(`attribute:${lowerName}`);
        }
        if (lowerName === 'href' && !safeUrl(value, 'link')) rejected.add('url:link');
        if (tagName === 'img' && lowerName === 'src' && !safeUrl(value, 'image')) {
          rejected.add('url:image');
        }
        if (tagName === 'iframe' && lowerName === 'src' && !safeUrl(value, 'youtube')) {
          rejected.add('url:video');
        }
      }
    },
    transformTags: {
      a: (_tagName, attributes) => ({
        tagName: 'a',
        attribs: {
          ...attributes,
          target: '_blank',
          rel: 'noopener noreferrer nofollow',
        },
      }),
      img: (_tagName, attributes) => ({
        tagName: 'img',
        attribs: {
          ...attributes,
          loading: 'lazy',
          referrerpolicy: 'no-referrer',
        },
      }),
      iframe: (_tagName, attributes) => ({
        tagName: 'iframe',
        attribs: {
          ...attributes,
          loading: 'lazy',
          referrerpolicy: 'no-referrer',
          sandbox: 'allow-scripts allow-same-origin allow-presentation',
          allow: 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture',
          allowfullscreen: '',
        },
      }),
    },
  });

  return { html, rejected: [...rejected] };
}
