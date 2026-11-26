import { strictLists } from '../../web/src/api/tolerantList.js';

// OTA F4 (§5.3): a phone skips a list row it cannot read; these tests exist to see that row fail.
strictLists(true);
