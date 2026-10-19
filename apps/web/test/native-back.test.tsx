import { MonumentFocus } from '../src/galaxy/FocusPanel.js';
import { GalaxyReadout } from '../src/v2/hud/GalaxyCorners.js';
import { monumentsSchema } from '../src/api/schemas.js';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Sheet as LegacySheet } from '../src/ui/kit/Sheet.js';
import { Sheet as V2Sheet } from '../src/v2/kit/Sheet.js';
import { CountryPicker } from '../src/v2/identity/CountryPicker.js';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { ChatMediaAttachment } from '../src/screens/ChatMediaAttachment.js';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClaimDialog } from '../src/onboarding/ClaimDialog.js';
import { ChatReactionRoster } from '../src/screens/ChatReactionRoster.js';
const nativeBack = (target: Element) => fireEvent(target, new Event('astera:native-back', { bubbles: true, cancelable: true }));

describe.each([['legacy', LegacySheet], ['v2', V2Sheet]] as const)('%s sheet Android back', (_name, Sheet) => {
  it('returns to the previous surface while Escape keeps its close behavior', () => {
    const onBack = vi.fn(); const onClose = vi.fn();
    const view = render(<Sheet title="Panel" onBack={onBack} onClose={onClose}>Body</Sheet>);
    const dialog = view.getByRole('dialog');
    expect(nativeBack(dialog)).toBe(false);
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when there is no previous surface', () => {
    const onClose = vi.fn();
    const view = render(<Sheet title="Panel" onClose={onClose}>Body</Sheet>);
    nativeBack(view.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close the parent when the event bubbles out of a nested modal', () => {
    const onClose = vi.fn();
    const view = render(<Sheet title="Parent" onClose={onClose}><div role="dialog" aria-label="Child">Child</div></Sheet>);
    nativeBack(view.getByRole('dialog', { name: 'Child' }));
    expect(onClose).not.toHaveBeenCalled();
  });
});


it('closes the country picker without choosing or saving a country', () => {
  const onClose = vi.fn(); const onSelect = vi.fn();
  const view = render(<CountryPicker value="TR" onClose={onClose} onSelect={onSelect} />);
  nativeBack(view.getByRole('dialog'));
  expect(onClose).toHaveBeenCalledOnce();
  expect(onSelect).not.toHaveBeenCalled();
});

it('closes an expanded photo without closing its conversation underneath', () => {
  const onClose = vi.fn();
  const view = render(<ApiProvider api={new Api({ authTransport: null })}>
    <V2Sheet title="Conversation" onClose={onClose}>
      <ChatMediaAttachment media={{ kind: 'image', assetId: 'photo', mimeType: 'image/png' }} channel="general" messageId="message" />
    </V2Sheet>
  </ApiProvider>);
  fireEvent.click(view.getByRole('button', { name: 'Open photo' }));
  const photo = view.getByRole('dialog', { name: 'Photo' });
  nativeBack(photo);
  expect(view.queryByRole('dialog', { name: 'Photo' })).not.toBeInTheDocument();
  expect(view.getByRole('dialog', { name: 'Conversation' })).toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();
});


it('returns from the claim password step without creating or switching accounts', async () => {
  const onClaim = vi.fn(); const onSignIn = vi.fn();
  const view = render(<ClaimDialog planetName="Kestrel" onClaim={onClaim} onSignIn={onSignIn} />);
  const user = userEvent.setup();
  await user.type(view.getByLabelText('Commander name'), 'NewPilot');
  await user.click(view.getByRole('button', { name: 'Continue' }));
  expect(view.getByLabelText('Password')).toBeInTheDocument();
  nativeBack(view.getByRole('dialog'));
  expect(view.queryByLabelText('Password')).not.toBeInTheDocument();
  expect(view.getByLabelText('Commander name')).toHaveValue('NewPilot');
  expect(onClaim).not.toHaveBeenCalled(); expect(onSignIn).not.toHaveBeenCalled();
});

it('consumes Back while a claim is pending without replaying the submission', async () => {
  const onClaim = vi.fn(() => new Promise<void>(() => undefined));
  const view = render(<ClaimDialog planetName="Kestrel" onClaim={onClaim} onSignIn={vi.fn()} />);
  const user = userEvent.setup();
  await user.type(view.getByLabelText('Commander name'), 'NewPilot');
  await user.click(view.getByRole('button', { name: 'Continue' }));
  await user.type(view.getByLabelText('Password'), 'test-password-only');
  await user.click(view.getByRole('checkbox', { name: /I agree/ }));
  fireEvent.submit(view.getByLabelText('Password').closest('form')!);
  expect(onClaim).toHaveBeenCalledOnce();
  expect(nativeBack(view.getByRole('dialog'))).toBe(false);
  expect(view.getByLabelText('Password')).toBeInTheDocument();
  expect(onClaim).toHaveBeenCalledOnce();
});

it('closes the reaction roster without closing the conversation or sending a reaction', () => {
  const api = new Api({ authTransport: null });
  vi.spyOn(api, 'messageReactionDetails').mockResolvedValue({ participants: [] });
  const onClose = vi.fn(); const parentClose = vi.fn();
  const anchor = document.createElement('button');
  const view = render(<QueryClientProvider client={new QueryClient()}><ApiProvider api={api}>
    <V2Sheet title="Conversation" onClose={parentClose}>
      <ChatReactionRoster channel="general" messageId="message" anchor={anchor} onClose={onClose} />
    </V2Sheet>
  </ApiProvider></QueryClientProvider>);
  const dialogs = view.getAllByRole('dialog');
  const roster = dialogs.find(d => d.getAttribute('aria-label') !== 'Conversation');
  if (!roster) throw new Error('No reaction roster');
  nativeBack(roster);
  expect(onClose).toHaveBeenCalledOnce(); expect(parentClose).not.toHaveBeenCalled();
});

it('closes a focused monument context without opening its dossier', () => {
  const onClose = vi.fn(); const onInspect = vi.fn();
  const monument = monumentsSchema.parse({ serverNow: new Date().toISOString(), monuments: [{
    id: '00000000-0000-4000-8000-000000000001', ordinal: 1, position: { x: 6000, y: 0, z: 0 },
    controller: { kind: 'NEUTRAL' }, capacity: 100, used: 0, reserved: 0, productionPerMinute: 60, emptySince: null,
  }], waves: [], probes: [], probeReports: [] }).monuments[0];
  if (!monument) throw new Error('No monument');
  const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error('No live galaxy in this fixture'));
  const view = render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <ApiProvider api={new Api({ fetch: fetcher, authTransport: null })}>
      <MonumentFocus monument={monument} onClose={onClose} onInspect={onInspect} />
    </ApiProvider>
  </QueryClientProvider>);
  const rail = view.container.querySelector('[data-focus-rail]');
  if (!rail) throw new Error('No focus rail');
  nativeBack(rail);
  expect(onClose).toHaveBeenCalledOnce(); expect(onInspect).not.toHaveBeenCalled();
});

it('dismisses a galaxy target list without selecting or attacking a target', () => {
  const onFocusTarget = vi.fn();
  const view = render(<GalaxyReadout counts={{ worlds: 1, fleetsAway: 0, rocks: 1, pirates: 0, wrecks: 0 }}
    targets={[{ kind: 'asteroid', id: 'rock', label: 'Rock', detail: 'Ore' }]} onFocusTarget={onFocusTarget} />);
  fireEvent.click(view.getByRole('button'));
  expect(view.getByRole('list')).toBeInTheDocument();
  const readout = view.container.querySelector('[data-galaxy-readout]');
  if (!readout) throw new Error('No galaxy readout');
  nativeBack(readout);
  expect(view.queryByRole('list')).not.toBeInTheDocument(); expect(onFocusTarget).not.toHaveBeenCalled();
});
