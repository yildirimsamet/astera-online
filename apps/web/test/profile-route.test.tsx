import { act, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { openProfile, leaveProfile, useProfileRoute } from '../src/shell/profileRoute.js';

function Probe() {
  return <p>{useProfileRoute() ? 'profile' : 'galaxy'}</p>;
}

afterEach(() => { window.history.replaceState(null, '', '/'); });

it('serves direct profile visits through the HTTPS game entry and preserves unknown-path 404s', () => {
  const source = readFileSync(resolve(process.cwd(), '../../deploy/nginx/astera.conf'), 'utf8');
  const game = source.slice(source.indexOf('# ── the game'));
  const profile = /location = \/profile \{([\s\S]*?)\}/u.exec(game)?.[1];
  expect(profile).toContain('rewrite ^ /index.html last;');
  expect(game).toContain('try_files $uri $uri/ =404;');
});

it('opens a dedicated profile URL without reloading and responds to browser navigation', () => {
  render(<Probe />);
  expect(screen.getByText('galaxy')).toBeVisible();
  act(() => { openProfile(); });
  expect(window.location.pathname).toBe('/profile');
  expect(screen.getByText('profile')).toBeVisible();
  act(() => {
    window.history.replaceState(null, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  expect(screen.getByText('galaxy')).toBeVisible();
});

it('supports direct profile URLs and a safe return when there is no in-app history', () => {
  window.history.replaceState(null, '', '/profile?lng=tr');
  render(<Probe />);
  expect(screen.getByText('profile')).toBeVisible();
  act(() => { leaveProfile(); });
  expect(window.location.pathname).toBe('/');
  expect(window.location.search).toBe('?lng=tr');
  expect(screen.getByText('galaxy')).toBeVisible();
});
