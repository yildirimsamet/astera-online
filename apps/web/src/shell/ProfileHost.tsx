import { lazy, Suspense, type ComponentProps } from 'react';

const ProfilePage = lazy(() => import('./ProfilePage.js').then(module => ({ default: module.ProfilePage })));

/**
 * The page opens over the live galaxy, and its code arrives only when first asked for. Its own boundary
 * keeps that wait here: without one React hid the whole game under the session's loading screen.
 */
export function ProfileHost(props: ComponentProps<typeof ProfilePage>) {
  return <Suspense fallback={null}><ProfilePage {...props} /></Suspense>;
}
