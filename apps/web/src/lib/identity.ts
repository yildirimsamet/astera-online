/** The one public spelling of an actively clan-affiliated commander. D114. */
export function commanderLabel(username: string, clanTag?: string | null): string {
  return clanTag ? `[${clanTag}] ${username}` : username;
}
