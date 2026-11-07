import { act, cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { TrainingDoor } from '../src/onboarding/TrainingDoor.js';

vi.mock('../src/onboarding/prologue/Prologue.js', () => ({ Prologue: () => <p>the prologue</p> }));
vi.mock('../src/onboarding/prologue/Handbook.js', () => ({ Handbook: () => <p>the handbook</p> }));
vi.mock('../src/onboarding/flightSchool/FlightSchool.js', () => ({ FlightSchool: () => <p>the old school</p> }));

afterEach(() => { cleanup(); vi.useRealTimers(); });
beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); });

const show = (answer: () => Promise<Response>, replay = false) => {
  const api = new Api({ fetch: vi.fn(answer) });
  render(<QueryClientProvider client={new QueryClient()}><ApiProvider api={api}>
    <TrainingDoor onClaim={() => Promise.resolve()} onSignIn={vi.fn()} onLeave={vi.fn()} replay={replay} />
  </ApiProvider></QueryClientProvider>);
};
const json = (body: unknown) => () => Promise.resolve(Response.json(body));

describe('which tutorial a newcomer gets', () => {
  it('opens the prologue when the server says ships are open', async () => {
    show(json({ email: false, recovery: false, starterGalaxy: true }));
    expect(await screen.findByText('the prologue')).toBeTruthy();
  });

  it('opens the old school when it says they are not', async () => {
    show(json({ email: false, recovery: false, starterGalaxy: false }));
    expect(await screen.findByText('the old school')).toBeTruthy();
  });

  it('opens the old school when an old server does not mention them', async () => {
    show(json({ email: false, recovery: false }));
    expect(await screen.findByText('the old school')).toBeTruthy();
  });

  it('opens the old school when the server cannot be reached', async () => {
    show(() => Promise.reject(new TypeError('offline')));
    expect(await screen.findByText('the old school')).toBeTruthy();
  });

  it('from the menu, opens the handbook rather than the road to an account', async () => {
    show(json({ email: false, recovery: false, starterGalaxy: true }), true);
    expect(await screen.findByText('the handbook')).toBeTruthy();
  });

  it('does not wait on a server that never answers', async () => {
    show(() => new Promise<Response>(() => undefined));
    expect(screen.getByTestId('training-door')).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(3_000); });
    expect(await screen.findByText('the old school')).toBeTruthy();
  });
});
