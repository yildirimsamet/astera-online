import { describe, expect, it } from 'vitest';
import { shortcutOf, type KeyPress } from '../../src/lib/shortcuts.js';

/**
 * E11 · K10: THE KEYBOARD ON A DESK. 1–5 are the five tabs in the dock's order,
 * Space brings the camera to what is selected, Esc lets go of it. A key typed into
 * a field is the field's, a key a page or a control already answers is theirs.
 */

const press = (key: string, extra: Partial<KeyPress> = {}): KeyPress => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  repeat: false,
  defaultPrevented: false,
  target: document.body,
  ...extra,
});

const inside = (html: string, selector: string): Element => {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.append(host);
  const found = host.querySelector(selector);
  if (!found) throw new Error(`no ${selector}`);
  return found;
};

describe('the desk keyboard', () => {
  it('reads 1–5 as the five tabs, in the dock order', () => {
    expect(['1', '2', '3', '4', '5'].map((key) => shortcutOf(press(key), false))).toEqual([
      { kind: 'tab', tab: 'galaxy' },
      { kind: 'tab', tab: 'base' },
      { kind: 'tab', tab: 'fleet' },
      { kind: 'tab', tab: 'intel' },
      { kind: 'tab', tab: 'clan' },
    ]);
  });

  it('switches tabs from over a page too — a tab is one press from any page', () => {
    expect(shortcutOf(press('4'), true)).toEqual({ kind: 'tab', tab: 'intel' });
  });

  it('ignores 0, 6 and every other key', () => {
    for (const key of ['0', '6', 'a', 'Enter', 'Tab', 'ArrowUp']) expect(shortcutOf(press(key), false)).toBeNull();
  });

  it('leaves a key held down alone: one press, one tab', () => {
    expect(shortcutOf(press('2', { repeat: true }), false)).toBeNull();
    expect(shortcutOf(press(' ', { repeat: true }), false)).toBeNull();
  });

  it('leaves the browser’s and the system’s own combinations alone', () => {
    expect(shortcutOf(press('1', { ctrlKey: true }), false)).toBeNull();
    expect(shortcutOf(press('1', { metaKey: true }), false)).toBeNull();
    expect(shortcutOf(press('1', { altKey: true }), false)).toBeNull();
  });

  it('never takes a key typed into a field', () => {
    for (const [html, selector] of [
      ['<input />', 'input'],
      ['<textarea></textarea>', 'textarea'],
      ['<select><option>a</option></select>', 'select'],
      ['<div contenteditable="true"><span>x</span></div>', 'span'],
    ] as const) {
      const target = inside(html, selector);
      expect(shortcutOf(press('3', { target }), false)).toBeNull();
      expect(shortcutOf(press(' ', { target }), false)).toBeNull();
      expect(shortcutOf(press('Escape', { target }), false)).toBeNull();
    }
  });

  it('leaves a key another handler already answered', () => {
    expect(shortcutOf(press('Escape', { defaultPrevented: true }), false)).toBeNull();
    expect(shortcutOf(press('1', { defaultPrevented: true }), false)).toBeNull();
  });

  it('reads Space as "bring the camera to the selection" on the galaxy', () => {
    expect(shortcutOf(press(' '), false)).toEqual({ kind: 'center' });
  });

  it('leaves Space to a focused control, which it presses, and to an open page, which it scrolls', () => {
    for (const [html, selector] of [
      ['<button type="button"><span>go</span></button>', 'span'],
      ['<a href="#x">x</a>', 'a'],
      ['<div role="tab">x</div>', 'div'],
      ['<div role="slider" aria-valuenow="1">x</div>', 'div'],
    ] as const) {
      expect(shortcutOf(press(' ', { target: inside(html, selector) }), false)).toBeNull();
    }
    expect(shortcutOf(press(' '), true)).toBeNull();
  });

  it('reads Esc as "let go of the selection" only when no page is open to close', () => {
    expect(shortcutOf(press('Escape'), false)).toEqual({ kind: 'clear' });
    expect(shortcutOf(press('Escape'), true)).toBeNull();
  });
});
