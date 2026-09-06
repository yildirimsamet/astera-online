import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CRASH_KEY,
  CRASH_LIMIT,
  crashReportText,
  describeCrash,
  readCrashes,
  rememberCrash,
} from '../src/shell/crashReport.js';

/**
 * THE EVIDENCE A CRASH LEAVES BEHIND.
 *
 * Owner instruction: *"hem sorun veya sorunlar tam olarak ne ve neden
 * kaynaklanıyor önce bilelim."* A boundary that only stops the black screen
 * answers half of that — it keeps the player in the game and tells us nothing.
 * What turns one player's report into a diagnosis is the RECORD: what threw,
 * where, on which phone, at what size.
 *
 * So this file tests the record on its own, away from React, because every
 * awkward case here is an input nobody chooses: a thrown string, a thrown null,
 * an Error with no message, a browser that refuses storage. A reporter that
 * throws while describing a throw is worse than no reporter at all.
 */

const AT = new Date('2026-09-06T17:20:00.000Z');

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe('describeCrash', () => {
  it('names the error with its type, because the type is half the diagnosis', () => {
    const record = describeCrash(new TypeError("Cannot read properties of undefined (reading 'atk')"), null, AT);

    expect(record.message).toBe("TypeError: Cannot read properties of undefined (reading 'atk')");
    expect(record.at).toBe('2026-09-06T17:20:00.000Z');
  });

  it('keeps the stack and the component stack apart', () => {
    const error = new Error('boom');
    error.stack = 'Error: boom\n    at Reach (PlanetScreen.tsx:1876)';

    const record = describeCrash(error, '\n    at Reach\n    at PlanetScreen', AT);

    expect(record.stack).toContain('PlanetScreen.tsx:1876');
    expect(record.componentStack).toContain('at Reach');
  });

  /*
    A `throw 'something'` is legal JavaScript and a third-party library does it.
    The record has to survive one, because the crash we cannot describe is
    exactly the crash we will never fix.
  */
  it('describes a thrown string', () => {
    expect(describeCrash('lost the context', null, AT).message).toBe('lost the context');
  });

  it('describes a thrown null without inventing a message', () => {
    const record = describeCrash(null, null, AT);

    expect(record.message.length).toBeGreaterThan(0);
    expect(record.stack).toBeNull();
  });

  it('falls back to the error type when the message is empty', () => {
    expect(describeCrash(new RangeError(''), null, AT).message).toBe('RangeError');
  });

  /*
    WHICH PHONE, AND HOW BIG. The whole question behind this work is whether one
    device is failing or every device is, and neither the agent nor the viewport
    can be recovered after the fact.
  */
  it('records the device and the viewport', () => {
    const record = describeCrash(new Error('boom'), null, AT);

    expect(record.agent).toBe(window.navigator.userAgent);
    expect(record.viewport).toBe(`${String(window.innerWidth)}x${String(window.innerHeight)}`);
  });
});

describe('rememberCrash', () => {
  it('keeps the newest first', () => {
    rememberCrash(describeCrash(new Error('first'), null, AT));
    rememberCrash(describeCrash(new Error('second'), null, AT));

    expect(readCrashes().map((entry) => entry.message)).toEqual([
      'Error: second',
      'Error: first',
    ]);
  });

  it('never grows past the limit', () => {
    for (let i = 0; i < CRASH_LIMIT + 4; i++) {
      rememberCrash(describeCrash(new Error(`crash ${String(i)}`), null, AT));
    }

    const kept = readCrashes();
    expect(kept).toHaveLength(CRASH_LIMIT);
    expect(kept[0]?.message).toBe(`Error: crash ${String(CRASH_LIMIT + 3)}`);
  });

  /*
    A private window, or a browser set to block site data, throws on the ACCESS
    itself. `lib/accordion.ts` learned this for a chevron; a crash reporter that
    threw here would replace the fallback screen with the blank one it exists to
    prevent.
  */
  it('survives a browser that refuses to store anything', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(() => { rememberCrash(describeCrash(new Error('boom'), null, AT)); }).not.toThrow();
  });

  it('survives a browser that refuses to read anything', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    expect(readCrashes()).toEqual([]);
  });

  it('treats a corrupt or foreign value as no history at all', () => {
    window.localStorage.setItem(CRASH_KEY, '{ not json');
    expect(readCrashes()).toEqual([]);

    window.localStorage.setItem(CRASH_KEY, '{"crashes":"nope"}');
    expect(readCrashes()).toEqual([]);

    window.localStorage.setItem(CRASH_KEY, '[1, 2, 3]');
    expect(readCrashes()).toEqual([]);
  });
});

describe('crashReportText', () => {
  /*
    NOT TRANSLATED, ON PURPOSE. This block is pasted into a message to the person
    who will fix it, not read by the player. A Turkish label on a stack trace
    helps nobody and would have to be understood twice.
  */
  it('carries every part of the record in one pasteable block', () => {
    const error = new Error('boom');
    error.stack = 'Error: boom\n    at Reach';
    const text = crashReportText(describeCrash(error, '\n    at PlanetScreen', AT));

    expect(text).toContain('2026-09-06T17:20:00.000Z');
    expect(text).toContain('Error: boom');
    expect(text).toContain('at Reach');
    expect(text).toContain('at PlanetScreen');
    expect(text).toContain(window.navigator.userAgent);
  });

  it('omits a part it does not have rather than printing an empty heading', () => {
    const text = crashReportText(describeCrash('lost the context', null, AT));

    expect(text).toContain('lost the context');
    expect(text).not.toContain('Component stack');
  });
});
