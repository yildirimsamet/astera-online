import { expect, it } from 'vitest';
import { bottomCover } from '../src/lib/cover.js';
it('reserves the trial control area and dock while keeping an open sky', () => {
  expect(bottomCover({ top: 60, bottom: 760 }, [{ top: 520, bottom: 740 }])).toBe(240);
  expect(bottomCover({ top: 60, bottom: 760 }, [])).toBe(0);
  expect(bottomCover({ top: 60, bottom: 760 }, [{ top: 820, bottom: 900 }])).toBe(0);
  expect(bottomCover({ top: 60, bottom: 760 }, [{ top: 0, bottom: 20 }])).toBe(0);
});
