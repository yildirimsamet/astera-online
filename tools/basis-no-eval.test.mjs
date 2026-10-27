import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { withoutEval } from './basis-no-eval.mjs';

const three = readFileSync(createRequire(new URL('../apps/web/package.json', import.meta.url)).resolve('three/examples/jsm/libs/basis/basis_transcoder.js'), 'utf8');

describe('the basis transcoder without eval (stage 2026-10-27: the CSP has no unsafe-eval)', () => {
  it('swaps the two wrappers built from strings for closures and leaves the rest as three ships it', () => {
    const out = withoutEval(three);
    expect(three.match(/newFunc\(Function,/g)).toHaveLength(2);
    expect(out).not.toContain('newFunc(Function,');
    const cut = (text, from, to) => text.slice(0, text.indexOf(from)) + text.slice(text.indexOf(to));
    const bare = text => cut(cut(text, 'function craftInvokerFunction(', 'var __embind_register_class_constructor='), 'var __emval_get_method_caller=', 'var __emval_get_module_property=');
    expect(bare(out)).toBe(bare(three));
  });

  it('refuses a transcoder it does not recognise instead of serving it unpatched', () => {
    expect(() => withoutEval('var BASIS = 1;')).toThrow(/craftInvokerFunction/);
  });
});
