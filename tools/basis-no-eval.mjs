#!/usr/bin/env node
/**
 * THREE'S BASIS TRANSCODER, WITHOUT EVAL.
 *
 * The Emscripten glue three ships builds its embind and emval call wrappers with `new Function`.
 * The page's CSP grants 'wasm-unsafe-eval' but not 'unsafe-eval', and the KTX2 worker (a blob)
 * inherits it: on stage the transcoder never started and every device fell back to the webp pack
 * (2026-10-27). This swaps both wrappers for closures that do what the generated code did, read
 * off this glue (not off a newer Emscripten). The wasm is untouched.
 *
 *   node tools/basis-no-eval.mjs    rewrite apps/web/public/basis/ from the installed three
 */
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const INVOKER = 'function craftInvokerFunction(humanName,argTypes,classType,cppInvokerFunc,cppTargetFunc,isAsync){'
  + 'var argCount=argTypes.length;if(argCount<2){throwBindingError("argTypes array size mismatch! Must at least get return value and \'this\' types!")}'
  + 'var isClassMethodFunc=argTypes[1]!==null&&classType!==null;var needsDestructorStack=usesDestructorStack(argTypes);'
  + 'var returns=argTypes[0].name!=="void";var expected=argCount-2;var offset=isClassMethodFunc?1:0;'
  + 'var invokerFn=function(...args){'
  + 'if(args.length!==expected){throwBindingError("function "+humanName+" called with "+args.length+" arguments, expected "+expected)}'
  + 'var destructors=needsDestructorStack?[]:null;var wired=[];'
  + 'if(isClassMethodFunc){wired.push(argTypes[1]["toWireType"](destructors,this))}'
  + 'for(var i=0;i<expected;++i){wired.push(argTypes[i+2]["toWireType"](destructors,args[i]))}'
  + 'var rv=cppInvokerFunc(cppTargetFunc,...wired);'
  + 'if(needsDestructorStack){runDestructors(destructors)}else{for(var i=isClassMethodFunc?1:2;i<argTypes.length;++i){'
  + 'if(argTypes[i].destructorFunction!==null){argTypes[i].destructorFunction(i===1?wired[0]:wired[i-2+offset])}}}'
  + 'if(returns){return argTypes[0]["fromWireType"](rv)}};'
  + 'return createNamedFunction(humanName,invokerFn)}';

// kind 0 calls func with obj as `this`; kind 1 constructs; any other kind calls func.call(arg0, …).
const METHOD_CALLER = 'var __emval_get_method_caller=(argCount,argTypes,kind)=>{var types=emval_lookupTypes(argCount,argTypes);'
  + 'var retType=types.shift();argCount--;'
  + 'var invokerFunction=(obj,func,destructorsRef,args)=>{var offset=0;var list=kind===0?[obj]:[];'
  + 'for(var i=0;i<argCount;++i){list.push(types[i].readValueFromPointer(args+offset));offset+=types[i]["argPackAdvance"]}'
  + 'var rv=kind===1?reflectConstruct(func,list):func.call(...list);'
  + 'if(!retType.isVoid){return emval_returnValue(retType,destructorsRef,rv)}};'
  + 'var functionName=`methodCaller<(${types.map(t=>t.name).join(", ")}) => ${retType.name}>`;'
  + 'return emval_addMethodCaller(createNamedFunction(functionName,invokerFunction))};';

const PATCHES = [
  { from: 'function craftInvokerFunction(', to: 'var __embind_register_class_constructor=', mark: 'newFunc(Function,args)', with: INVOKER },
  { from: 'var __emval_get_method_caller=', to: 'var __emval_get_module_property=', mark: 'newFunc(Function,params)', with: METHOD_CALLER },
];

/** Three's glue with both string-built wrappers replaced; throws on a glue it does not recognise. */
export function withoutEval(source) {
  let out = source;
  for (const patch of PATCHES) {
    const start = out.indexOf(patch.from); const end = out.indexOf(patch.to);
    if (start < 0 || end < start || !out.slice(start, end).includes(patch.mark)) {
      throw new Error(`basis_transcoder.js: ${patch.from} not where this patch expects it; re-check the patch against the new three`);
    }
    out = out.slice(0, start) + patch.with + out.slice(end);
  }
  if (out.includes('newFunc(Function,')) throw new Error('basis_transcoder.js: a wrapper is still built from a string');
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const basis = dirname(createRequire(join(root, 'apps/web/package.json')).resolve('three/examples/jsm/libs/basis/basis_transcoder.js'));
  const out = join(root, 'apps/web/public/basis');
  writeFileSync(join(out, 'basis_transcoder.js'), withoutEval(readFileSync(join(basis, 'basis_transcoder.js'), 'utf8')));
  copyFileSync(join(basis, 'basis_transcoder.wasm'), join(out, 'basis_transcoder.wasm'));
  console.log(`wrote ${out}`);
}
