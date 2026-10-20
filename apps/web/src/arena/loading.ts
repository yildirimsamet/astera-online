/** One bounded retry for a briefly interrupted chunk download. */
export async function retryArenaImport<T>(load: () => Promise<T>): Promise<T> {
  try { return await load(); }
  catch { await new Promise<void>(resolve => { setTimeout(resolve, 500); }); return load(); }
}
