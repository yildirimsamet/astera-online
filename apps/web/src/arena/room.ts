/**
 * 1 GB, untouched: nothing for a 64-bit renderer, more than a 32-bit one ever has in one block
 * (Chrome itself holds ~2.8 GB of its 4). 256 MB was not enough: a fresh S22 tab had 512 free.
 */
const ROOM_BYTES = 1024 * 1048576;
const WASM_PAGE = 65536;
const reserveWasm = (bytes: number): void => { void new WebAssembly.Memory({ initial: bytes / WASM_PAGE, maximum: bytes / WASM_PAGE }); };

/**
 * WHETHER THIS RENDERER HAS ROOM (S22, 2026-10-26). That phone's Chrome is a 32-bit build: a blank
 * page had 192 MB of free address space in one block, the galaxy left 64, and the 3D hangar
 * beside it killed the tab (termination status OOM) on its second visit. A 64-bit renderer
 * reserves 1 GB it never touches without a thought; a 32-bit one cannot. Without room the page
 * starts no transcoder and the hangar stands its ship flat.
 */
let roomy: boolean | null = null;
export function roomyRenderer(reserve: (bytes: number) => void = reserveWasm): boolean {
  const ask = (): boolean => { try { reserve(ROOM_BYTES); return true; } catch { return false; } };
  return reserve === reserveWasm ? (roomy ??= ask()) : ask();
}
