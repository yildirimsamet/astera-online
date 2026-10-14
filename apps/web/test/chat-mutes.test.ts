import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addChatMute, chatMuteStorageKey, isChatMessageVisible, readChatMutes, writeChatMutes,
} from '../src/lib/chatMutes.js';

const author = { authorPlayerId: 'other', username: 'Scout', self: false };
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

describe('personal chat mutes', () => {
  it('stores a named author once and refreshes the remembered name', () => {
    const first = addChatMute([], author);
    expect(first).toEqual([{ playerId: 'other', username: 'Scout' }]);
    expect(addChatMute(first, { ...author, username: 'Renamed' })).toEqual([{ playerId: 'other', username: 'Renamed' }]);
  });
  it.each([{ self: true }, { admin: true }])('refuses a protected author: %j', protection => {
    expect(addChatMute([], { ...author, ...protection })).toEqual([]);
  });
  it('hides a muted author while protecting self and admin messages', () => {
    const muted = new Set(['other']);
    expect(isChatMessageVisible(author, muted)).toBe(false);
    expect(isChatMessageVisible({ ...author, self: true }, muted)).toBe(true);
    expect(isChatMessageVisible({ ...author, admin: true }, muted)).toBe(true);
    expect(isChatMessageVisible({ ...author, authorPlayerId: 'third' }, muted)).toBe(true);
  });
  it('persists independently for each signed-in account and clears on unmute', () => {
    writeChatMutes('account-a', addChatMute([], author));
    expect(readChatMutes('account-a')).toEqual([{ playerId: 'other', username: 'Scout' }]);
    expect(readChatMutes('account-b')).toEqual([]);
    writeChatMutes('account-b', [{ playerId: 'third', username: 'Third' }]);
    writeChatMutes('account-a', []);
    expect(readChatMutes('account-a')).toEqual([]);
    expect(readChatMutes('account-b')).toEqual([{ playerId: 'third', username: 'Third' }]);
  });
  it.each(['broken-json', '{}', '[{"playerId":4,"username":"Bad"}]', '[{"playerId":"","username":"Bad"}]'])('recovers from corrupt preference %s', stored => {
    localStorage.setItem(chatMuteStorageKey('account-a'), stored);
    expect(readChatMutes('account-a')).toEqual([]);
  });
  it('deduplicates stored authors by stable ID', () => {
    localStorage.setItem(chatMuteStorageKey('account-a'), JSON.stringify([
      { playerId: 'other', username: 'Old name' }, { playerId: 'other', username: 'New name' },
    ]));
    expect(readChatMutes('account-a')).toEqual([{ playerId: 'other', username: 'New name' }]);
  });
  it('keeps the preference usable in memory when the browser denies storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Denied'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota'); });
    expect(readChatMutes('account-a')).toEqual([]);
    expect(() => { writeChatMutes('account-a', addChatMute([], author)); }).not.toThrow();
  });
});
