import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { useState, type ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary, PanelBoundary } from '../src/shell/ErrorBoundary.js';
import { readCrashes } from '../src/shell/crashReport.js';
import i18n from '../src/i18n/index.js';

vi.mock('../src/lib/playerAnalytics/runtime.js', () => ({ observe: vi.fn() }));

/**
 * ONE PANEL'S FAULT IS ONE PANEL'S (owner, 2026-11-17, ek-3): "useToast called outside
 * ToastProvider" took the whole game down to the crash screen after the phone came back from the
 * background. Two fixes, each pinned here.
 *
 * 1. THE CAUSE. `ui/Toast.tsx` imports the kit and exports hooks beside its provider, so on the dev
 *    server every kit edit re-ran it and minted a NEW context; the provider at the root kept the
 *    old one, and the next consumer that re-rendered (the phone pulls the queued updates when it
 *    wakes) found none. The contexts now live in a module that imports React alone, which no edit
 *    to the game re-runs.
 * 2. THE BLAST RADIUS. A throw inside a sheet showed the full-screen crash floor; it now stays in
 *    the sheet — a short line and a retry — and the galaxy keeps running behind it.
 */

const source = (path: string): string => readFileSync(resolve(__dirname, '../src', path), 'utf8');

describe('the toast context outlives a hot reload', () => {
  it('lives in a module that imports React and nothing else', () => {
    const imports = [...source('ui/toastContext.ts').matchAll(/from '([^']+)'/g)].map((match) => match[1]);
    expect(imports).toEqual(['react']);
    expect(source('ui/Toast.tsx')).not.toMatch(/createContext\(/);
  });
});

function Boom(): ReactNode {
  throw new Error('panel exploded');
}

function Flaky() {
  const [broken, setBroken] = useState(true);
  return (
    <ErrorBoundary>
      <p>the galaxy</p>
      <PanelBoundary>{broken ? <Boom /> : <p>the panel</p>}</PanelBoundary>
      <button type="button" onClick={() => { setBroken(false); }}>mend</button>
    </ErrorBoundary>
  );
}

beforeEach(async () => {
  window.localStorage.clear();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  if (i18n.resolvedLanguage !== 'en') await i18n.changeLanguage('en');
});

describe('a panel that throws', () => {
  it('fails in place: the rest of the game stays up and the full crash floor never shows', () => {
    render(<Flaky />);
    expect(screen.getByText('the galaxy')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('crash.panelTitle'));
    expect(screen.queryByText(i18n.t('crash.title'))).toBeNull();
  });

  it('keeps the report, as the full floor does', () => {
    render(<Flaky />);
    expect(readCrashes().at(-1)?.message).toContain('panel exploded');
  });

  it('tries again on a press', async () => {
    render(<Flaky />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'mend' }));
    await user.click(screen.getByRole('button', { name: i18n.t('crash.retry') }));
    expect(screen.getByText('the panel')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
