import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WikiScreen } from '../src/screens/WikiScreen.js';

describe('the Wiki room shares public articles', () => {
  it('searches full article text and walks back one article without leaving the game', () => {
    render(<WikiScreen language="en" />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Dart' } });
    fireEvent.click(screen.getByRole('link', { name: /^Dart$/ }));
    expect(screen.getByRole('heading', { level: 1, name: 'Dart' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Wiki page' })).toHaveAttribute('href', '/wiki/fleet/dart');
    fireEvent.click(screen.getByRole('link', { name: /^Shipyard$/ }));
    expect(screen.getByRole('heading', { level: 1, name: 'Shipyard' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /back.*Dart/i }));
    expect(screen.getByRole('heading', { level: 1, name: 'Dart' })).toBeInTheDocument();
  });
  it('supports the Turkish edition and an accessible no-results state', () => {
    render(<WikiScreen language="tr" />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzzz-not-a-topic' } });
    expect(screen.getByRole('status')).toHaveTextContent('Sonuç bulunamadı');
    fireEvent.click(screen.getByRole('radio', { name: 'English' }));
    expect(screen.getByRole('searchbox')).toHaveAttribute('placeholder', 'Search the Wiki');
  });
  it('leads with the articles a word names, not the ones that mention it once (player test)', () => {
    // "savaş" matched 55 articles and Quick start stayed on top: the search looked like it did nothing.
    render(<WikiScreen language="tr" />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'savaş' } });
    const titles = screen.getAllByRole('link').map(link => link.textContent).filter(text => text.trim() !== '');
    expect(titles[0]).toMatch(/savaş/iu);
    expect(screen.getByRole('status')).toHaveTextContent('savaş');
  });
  it('finds a ship by its permanent catalogue name in the Turkish edition', () => {
    render(<WikiScreen language="tr" />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Dart' } });
    fireEvent.click(screen.getByRole('link', { name: 'Ok' }));
    expect(screen.getByRole('heading', { name: 'Ok', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Wiki sayfasını aç' })).toHaveAttribute('href', '/wiki/tr/fleet/dart');
  });
  it('names the actual previous category when returning from an article', () => {
    const view = render(<WikiScreen language="en" />);
    const category = view.container.querySelector('a[href="/wiki/fleet"]');
    if (!category) throw new Error('Missing fleet category');
    fireEvent.click(category);
    fireEvent.click(screen.getByRole('link', { name: 'Dart' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to Fleet & flights' }));
    expect(screen.getByRole('heading', { name: 'Fleet & flights', level: 1 })).toBeInTheDocument();
  });
  it('closes the category menu when navigating or changing language', () => {
    const view = render(<WikiScreen language="en" />);
    const menu = view.container.querySelector('details');
    if (!menu) throw new Error('Missing category menu');
    menu.open = true;
    const category = menu.querySelector('a[href="/wiki/fleet"]');
    if (!category) throw new Error('Missing fleet category');
    fireEvent.click(category);
    expect(menu.open).toBe(false);
    expect(screen.getByRole('heading', { level: 1, name: 'Fleet & flights' })).toHaveFocus();
    menu.open = true;
    fireEvent.click(screen.getByRole('radio', { name: 'Türkçe' }));
    expect(menu.open).toBe(false);
    expect(screen.getByRole('heading', { level: 1, name: 'Filo ve uçuşlar' })).toHaveFocus();
  });
  it('scrolls the new content into the drawer below its compact toolbar', () => {
    const view = render(<div data-sheet-body=""><WikiScreen language="en" /></div>);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Dart' } });
    fireEvent.click(screen.getByRole('link', { name: 'Dart' }));
    const scroll = view.container.querySelector<HTMLElement>('[data-sheet-body]');
    if (!scroll) throw new Error('Missing drawer');
    const content = view.container.querySelector<HTMLElement>('.wiki-room-content');
    const toolbar = view.container.querySelector<HTMLElement>('.wiki-room-tools');
    if (!content || !toolbar) throw new Error('Missing content or toolbar');
    vi.spyOn(scroll, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 60, 350, 700));
    vi.spyOn(content, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 360, 350, 1800));
    vi.spyOn(toolbar, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 60, 350, 48));
    scroll.scrollTop = 500;
    fireEvent.click(screen.getByRole('link', { name: /^Shipyard$/ }));
    expect(scroll.scrollTop).toBe(740);
    expect(screen.getByRole('heading', { name: 'Shipyard', level: 1 })).toHaveFocus();
  });
});

/**
 * G11-a (2026-11-16): THE WIKI ROOM ON THE GAME KIT. "Where is the rule I need?" The sheet's kit
 * head already says Wiki, so the room opens on its tools: the edition on the kit's choices, the
 * search in a kit field, the way back on a kit button naming where it goes. The articles keep the
 * public edition's markup; only the room dresses them.
 */
describe('the Wiki room on the kit', () => {
  it('speaks in the kit’s type and does not repeat the head’s name', () => {
    const view = render(<WikiScreen language="en" />);
    const room = view.container.querySelector('.wiki-room')!;
    expect(room).toHaveClass('gk');
    expect(screen.queryByText('ASTERA / WIKI')).toBeNull();
  });

  it('chooses the edition on the kit’s choices and searches in a kit field', () => {
    render(<WikiScreen language="en" />);
    const edition = screen.getByRole('radiogroup', { name: 'Language' });
    expect(within(edition).getByRole('radio', { name: 'English' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('searchbox')).toHaveClass('gk-field__input');
  });

  it('walks back on a kit button that names where it goes', () => {
    const view = render(<WikiScreen language="en" />);
    fireEvent.click(view.container.querySelector('a[href="/wiki/fleet"]')!);
    expect(screen.getByRole('button', { name: 'Back to Game Wiki' })).toHaveClass('gk-btn');
  });
});
