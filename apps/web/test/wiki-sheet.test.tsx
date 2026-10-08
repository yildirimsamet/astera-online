import { fireEvent, render, screen } from '@testing-library/react';
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
    fireEvent.click(screen.getByRole('button', { name: /English/ }));
    expect(screen.getByRole('searchbox')).toHaveAttribute('placeholder', 'Search the Wiki');
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
    fireEvent.click(screen.getByRole('button', { name: '← Back to Fleet & flights' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Türkçe' }));
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
