"""Generate gozlemevi.md from gozlemevi.html — the reading copy of the spec.

The HTML is the single source (it carries the mockups the owner looks at); the
Markdown is what a working session reads, because it is a third of the size and
greps by line. Never edit the .md by hand: edit the .html and run

    python3 docs/ui-v2/to_markdown.py

Mockups (anything with role="img"), SVG, canvas, scripts and styles are dropped;
headings, paragraphs, lists, tables and the component cards (<dl>) are kept.
"""
import os
import re
from html.parser import HTMLParser

HERE = os.path.dirname(os.path.abspath(__file__))
SKIP = {'script', 'style', 'svg', 'canvas', 'head', 'title', 'link', 'meta'}
VOID = {'br', 'img', 'hr', 'meta', 'link', 'input', 'use', 'path', 'circle', 'source'}
BLOCK = {'p', 'div', 'section', 'article', 'header', 'footer', 'figure', 'figcaption', 'li', 'dt', 'dd',
         'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'ul', 'ol', 'dl', 'tr', 'nav', 'main', 'aside'}


class Node:
    def __init__(self, tag, attrs, parent):
        self.tag, self.attrs, self.parent, self.children = tag, dict(attrs), parent, []


class Tree(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node('root', [], None)
        self.cur = self.root

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs, self.cur)
        self.cur.children.append(node)
        if tag not in VOID:
            self.cur = node

    def handle_endtag(self, tag):
        n = self.cur
        while n is not None and n.tag != tag:
            n = n.parent
        if n is not None and n.parent is not None:
            self.cur = n.parent

    def handle_data(self, data):
        self.cur.children.append(data)


def skipped(n):
    return n.tag in SKIP or n.attrs.get('role') == 'img' or n.attrs.get('aria-hidden') == 'true'


def inline(n):
    """Inline text of a node, with bold, italics, code and links."""
    if isinstance(n, str):
        return re.sub(r'\s+', ' ', n)
    if skipped(n):
        return ''
    if n.tag == 'br':
        return ' '
    inner = ''.join(inline(c) for c in n.children)
    if n.tag in ('b', 'strong') and inner.strip():
        return f'**{inner.strip()}** '
    if n.tag == 'em' and inner.strip():
        return f'*{inner.strip()}* '
    if n.tag == 'code' and inner.strip():
        return f'`{inner.strip()}`'
    if n.tag == 'a' and inner.strip():
        href = n.attrs.get('href', '')
        return f'[{inner.strip()}]({href})' if href.startswith('#') or href.startswith('http') else inner
    return inner


def clean(text):
    text = re.sub(r'[ \t]+', ' ', text).strip()
    return re.sub(r'\s+([,.;:!?)])', r'\1', text)


def has_block(n):
    return any(not isinstance(c, str) and (c.tag in BLOCK) and not skipped(c) for c in n.children)


def table(n):
    rows = []
    for tr in walk(n, 'tr'):
        cells = [clean(inline(c)).replace('|', '\\|') for c in tr.children
                 if not isinstance(c, str) and c.tag in ('th', 'td')]
        if cells:
            rows.append(cells)
    if not rows:
        return ''
    width = max(len(r) for r in rows)
    rows = [r + [''] * (width - len(r)) for r in rows]
    out = ['| ' + ' | '.join(rows[0]) + ' |', '|' + '---|' * width]
    out += ['| ' + ' | '.join(r) + ' |' for r in rows[1:]]
    return '\n'.join(out)


def walk(n, tag):
    for c in n.children:
        if isinstance(c, str) or skipped(c):
            continue
        if c.tag == tag:
            yield c
        else:
            yield from walk(c, tag)


def block(n, out, depth=0):
    for c in n.children:
        if isinstance(c, str):
            t = clean(c)
            if t:
                out.append(t)
            continue
        if skipped(c):
            continue
        tag = c.tag
        if tag in ('h1', 'h2', 'h3', 'h4', 'h5', 'h6'):
            t = clean(inline(c))
            if t:
                out.append('#' * int(tag[1]) + ' ' + t)
        elif tag == 'table':
            t = table(c)
            if t:
                out.append(t)
        elif tag in ('ul', 'ol'):
            items = [li for li in c.children if not isinstance(li, str) and li.tag == 'li']
            lines = []
            for i, li in enumerate(items, 1):
                t = clean(inline(li))
                if t:
                    lines.append(('  ' * depth) + (f'{i}. ' if tag == 'ol' else '- ') + t)
            if lines:
                out.append('\n'.join(lines))
        elif tag == 'dl':
            lines = []
            kids = [k for k in c.children if not isinstance(k, str)]
            for i, k in enumerate(kids):
                if k.tag == 'dt':
                    dd = kids[i + 1] if i + 1 < len(kids) and kids[i + 1].tag == 'dd' else None
                    lines.append(f'- **{clean(inline(k))}:** {clean(inline(dd)) if dd else ""}')
            if lines:
                out.append('\n'.join(lines))
        elif tag == 'figcaption':
            parts = [clean(inline(k)) for k in c.children if not isinstance(k, str) and not skipped(k)]
            if len(parts) >= 3:
                out.append(f'#### {parts[1]}\n\n*{parts[0]}* — ' + ' '.join(parts[2:]))
            elif parts:
                out.append(' '.join(p for p in parts if p))
        elif tag in BLOCK and has_block(c):
            block(c, out, depth)
        elif tag in BLOCK or tag in ('span',):
            t = clean(inline(c))
            if t:
                out.append(t)
        else:
            block(c, out, depth)


def main():
    html = open(os.path.join(HERE, 'gozlemevi.html'), encoding='utf-8').read()
    tree = Tree()
    tree.feed(html)
    out = []
    block(tree.root, out)
    md = '\n\n'.join(out)
    md = re.sub(r'\n{3,}', '\n\n', md).strip() + '\n'
    header = ('<!-- ÜRETİLMİŞ DOSYA. Elle düzenleme: gozlemevi.html düzenlenir, sonra '
              '`python3 docs/ui-v2/to_markdown.py` çalıştırılır. -->\n\n')
    open(os.path.join(HERE, 'gozlemevi.md'), 'w', encoding='utf-8').write(header + md)
    print(f'{len(md.encode())} bytes, {md.count(chr(10))} lines')


if __name__ == '__main__':
    main()
