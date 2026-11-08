import { render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { expect, it, vi } from 'vitest';
import { ProfileHost } from '../src/shell/ProfileHost.js';

// The chunk that has not arrived yet: a phone on a slow line waits here.
vi.mock('../src/shell/ProfilePage.js', () => new Promise(() => undefined));

it('keeps the galaxy on screen while the profile page is still downloading', async () => {
  render(
    <Suspense fallback={<p>loading the whole game</p>}>
      <p>galaxy</p>
      <ProfileHost name="Me" onSignOut={() => undefined} onBack={() => undefined} />
    </Suspense>,
  );
  await new Promise(resolve => setTimeout(resolve, 20));
  expect(screen.queryByText('loading the whole game')).toBeNull();
  expect(screen.getByText('galaxy')).toBeVisible();
});
