import { expect, it } from 'vitest';
import { readsForPrivateEvent } from '../src/session/shardEvents.js';

it('refreshes all social safety views on another device without refreshing fleets or the galaxy', () => {
  expect(readsForPrivateEvent('private:community-block')).toEqual([
    ['community', 'blocks'], ['chat', 'messages'], ['chat', 'unread'], ['clan', 'chat'], ['clan', 'badge'], ['dm', 'conversations'], ['dm', 'unread'], ['dm', 'messages'], ['dm', 'contacts'],
  ]);
});
