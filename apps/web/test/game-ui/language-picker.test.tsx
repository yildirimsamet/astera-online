import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LANGUAGE_FLAG, LanguagePicker } from '../../src/game-ui/controls.js';
import { LANGUAGES, LANGUAGE_LABEL } from '../../src/i18n/languages.js';

/**
 * THE LANGUAGE CHOICE. Every language the game speaks, each named in itself beside its
 * flag, so a player lost in a language they cannot read still finds their own.
 */

const tap = (element: HTMLElement): void => {
  fireEvent.pointerDown(element, { button: 0 });
  fireEvent.pointerUp(element);
  fireEvent.click(element, { detail: 1 });
};

describe('the language picker', () => {
  it('offers every language the game speaks, named in itself, with its flag', () => {
    render(<LanguagePicker label="Dil" value="tr" onChange={() => undefined} />);
    const group = screen.getByRole('radiogroup', { name: 'Dil' });
    expect(group).toBeInTheDocument();
    for (const language of LANGUAGES) {
      expect(screen.getByRole('radio', { name: LANGUAGE_LABEL[language] })).toBeInTheDocument();
      expect(existsSync(join('public', LANGUAGE_FLAG[language])), language).toBe(true);
    }
  });

  it('marks the chosen language and switches on a tap', () => {
    const onChange = vi.fn();
    render(<LanguagePicker label="Dil" value="tr" onChange={onChange} />);
    expect(screen.getByRole('radio', { name: 'Türkçe' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: '日本語' })).toHaveAttribute('aria-checked', 'false');
    tap(screen.getByRole('radio', { name: '日本語' }));
    expect(onChange).toHaveBeenCalledWith('ja');
  });

  it('is one stop for the Tab key, and the arrows walk the languages', () => {
    const onChange = vi.fn();
    render(<LanguagePicker label="Dil" value="tr" onChange={onChange} />);
    const radios = screen.getAllByRole('radio');
    expect(radios.filter((radio) => radio.tabIndex === 0)).toEqual([screen.getByRole('radio', { name: 'Türkçe' })]);
    const at = LANGUAGES.indexOf('tr');
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Türkçe' }), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith(LANGUAGES[(at + 1) % LANGUAGES.length]);
  });

  it('does nothing when the chosen language is tapped again', () => {
    const onChange = vi.fn();
    render(<LanguagePicker label="Dil" value="tr" onChange={onChange} />);
    tap(screen.getByRole('radio', { name: 'Türkçe' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
