export function analyticsRevision(readRevision: () => string, readChanges: () => string, declaredRevision?: string): string {
  const revision = (declaredRevision ?? readRevision()).trim();
  if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error('Analytics attribution requires the Git revision');
  return `${revision}${!declaredRevision && readChanges().trim() ? '.dirty' : ''}`;
}
