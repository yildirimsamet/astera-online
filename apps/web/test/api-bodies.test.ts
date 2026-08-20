import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';

/**
 * WHAT THE CLIENT ACTUALLY PUTS ON THE WIRE.
 *
 * Every other test in this repo checks what comes BACK — the contract suite parses
 * real responses with these very schemas, and it is thorough. Nothing checked what
 * goes OUT, and that is where a real bug lived: `send()` serialises the body, and
 * two call sites passed `JSON.stringify(...)` as well. The result was a body
 * double-encoded to a JSON string literal, so Fastify handed the route a STRING and
 * `z.object(...).parse` answered "expected object, received string".
 *
 * It typechecked, it linted, both suites were green, and neither asteroid mining
 * nor wreck harvesting worked at all. The response side was contract-tested; the
 * REQUEST side had no test of any kind. These are that test.
 */

const ok = (): Promise<Response> =>
  Promise.resolve(
    // Deliberately not a valid payload for any route: these assertions are about
    // the REQUEST, and every call below is expected to reject on the way back.
    new Response(JSON.stringify({}), { status: 200, headers: { 'content-type': 'application/json' } }),
  );

/** Fire one call and hand back what fetch was given as its body. */
async function bodyOf(call: (api: Api) => Promise<unknown>): Promise<{
  raw: BodyInit | null | undefined;
  contentType: string | undefined;
}> {
  let init: RequestInit | undefined;
  const fetchMock = vi.fn((_url: string | URL | Request, opts?: RequestInit) => {
    init = opts;
    return ok();
  });
  const api = new Api({ fetch: fetchMock as unknown as typeof globalThis.fetch });
  // Every one of these rejects on the empty response above. That is fine and
  // expected — the request has already been made by then, which is all we want.
  await call(api).catch(() => undefined);
  expect(fetchMock, 'the method never called fetch at all').toHaveBeenCalled();
  return {
    raw: init?.body,
    contentType: (init?.headers as Record<string, string> | undefined)?.['content-type'],
  };
}

/**
 * Every call that carries a payload, with the arguments a screen would pass.
 *
 * A new mutating method belongs in this table. The structural test at the bottom
 * is the backstop for the day somebody forgets.
 */
const WITH_BODY: [name: string, call: (api: Api) => Promise<unknown>, expected: unknown][] = [
  ['register', (a) => a.register('vantage', 'a-long-enough-password'), { username: 'vantage', password: 'a-long-enough-password' }],
  ['login', (a) => a.login('vantage', 'a-long-enough-password'), { username: 'vantage', password: 'a-long-enough-password' }],
  ['upgrade', (a) => a.upgrade('CORE'), { type: 'CORE' }],
  ['build', (a) => a.build('WASP', 4), { hull: 'WASP', count: 4 }],
  ['raiseInstrument', (a) => a.raiseInstrument('TELESCOPE'), { type: 'TELESCOPE' }],
  ['installSatellite', (a) => a.installSatellite('UPLINK'), { type: 'UPLINK' }],
  ['launch', (a) => a.launch('p-1', { WASP: 3 }), { targetPlanetId: 'p-1', fleet: { WASP: 3 } }],
  ['watch', (a) => a.watch('p-1', 2), { targetPlanetId: 'p-1', slot: 2 }],
  ['probe', (a) => a.probe('p-1'), { targetPlanetId: 'p-1' }],
  // The two that were broken.
  ['mine', (a) => a.mine(7, 3), { asteroidIndex: 7, craft: 3 }],
  ['harvest', (a) => a.harvest('field-1', 3), { fieldId: 'field-1', craft: 3 }],
];

describe('what the client sends', () => {
  it.each(WITH_BODY)('%s sends a JSON object, not a string', async (_name, call, expected) => {
    const { raw, contentType } = await bodyOf(call);

    expect(typeof raw, 'fetch was not given a serialised body').toBe('string');
    expect(contentType).toBe('application/json');

    const decoded: unknown = JSON.parse(raw as string);
    /**
     * THE ASSERTION THAT WOULD HAVE CAUGHT IT.
     *
     * A double-encoded body parses to a STRING — `JSON.parse('"{\\"a\\":1}"')` is
     * `'{"a":1}'`, not an object — and every server route parses `req.body` with
     * `z.object(...)`. So this one line is the whole class of bug.
     */
    expect(typeof decoded, 'body double-encoded: JSON.parse returned a string').toBe('object');
    expect(decoded).not.toBeNull();
    expect(Array.isArray(decoded)).toBe(false);
    expect(decoded).toEqual(expected);
  });

  /** A call with nothing to say must not invent an empty body or a content type. */
  it('sends no body and no content type when there is nothing to send', async () => {
    const { raw, contentType } = await bodyOf((a) => a.collect());
    expect(raw).toBeUndefined();
    expect(contentType).toBeUndefined();
  });

  it('sends no body on a plain read', async () => {
    const { raw } = await bodyOf((a) => a.planet());
    expect(raw).toBeUndefined();
  });

  /**
   * THE STRUCTURAL BACKSTOP.
   *
   * The table above only covers methods somebody remembered to add. This covers
   * every method there will ever be: serialisation happens in exactly ONE place —
   * inside `send` — so a call site that stringifies its own body is a test failure
   * whether or not anybody wrote a case for it.
   */
  it('serialises in exactly one place', () => {
    // Resolved from the package root: the jsdom environment does not give this
    // module a file:// `import.meta.url` to walk from.
    const source = readFileSync(resolve(process.cwd(), 'src/api/client.ts'), 'utf8');
    // Comments stripped first — the docblock explaining this very bug names
    // `JSON.stringify`, and a test that counts prose is a test that lies.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const occurrences = code.match(/JSON\.stringify/g) ?? [];
    expect(
      occurrences.length,
      'a call site is serialising its own body — `send` already does it',
    ).toBe(1);
    expect(source).toContain('body: JSON.stringify(opts.body)');
  });
});
