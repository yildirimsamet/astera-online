/**
 * Dev-only flight recorder: errors, GPU facts and load steps, shown on screen so a phone
 * that renders black can tell us why without a cable. Never part of production.
 */
export interface Diagnostics { lines: string[]; push(line: string): void; subscribe(listener: () => void): () => void; dispose(): void }

export function createDiagnostics(): Diagnostics {
  const lines: string[] = [];
  const listeners = new Set<() => void>();
  const push = (line: string): void => {
    const stamp = new Date().toISOString().slice(11, 19);
    lines.push(`${stamp} ${line}`);
    if (lines.length > 40) lines.shift();
    console.info('[arena]', line);
    for (const listener of listeners) listener();
  };
  const onError = (event: ErrorEvent): void => { push(`error: ${event.message} @ ${event.filename.split('/').pop() ?? ''}:${String(event.lineno)}`); };
  const onRejection = (event: PromiseRejectionEvent): void => {
    const reason: unknown = event.reason;
    push(`rejection: ${reason instanceof Error ? reason.message : String(reason)}`);
  };
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  return {
    lines, push,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    dispose() { window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onRejection); },
  };
}

/** One line about the GPU this page actually got. */
export function describeGpu(gl: WebGLRenderingContext | WebGL2RenderingContext): string {
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer: unknown = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  const webgl2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
  const samples: unknown = webgl2 ? gl.getParameter(gl.MAX_SAMPLES) : 0;
  const size: unknown = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  const half = webgl2 ? Boolean(gl.getExtension('EXT_color_buffer_float') ?? gl.getExtension('EXT_color_buffer_half_float')) : false;
  return `gpu ${String(renderer)} · webgl${webgl2 ? '2' : '1'} · msaa ${String(samples)} · tex ${String(size)} · float RT ${String(half)}`;
}
