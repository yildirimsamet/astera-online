import type { BuildingId, HullId, InstrumentId, ResearchProjectId, SatelliteId } from '@astera/rules';

export type WikiLanguage = 'en' | 'tr';
export type Localized<T> = Readonly<Record<WikiLanguage, T>>;
export const localized = <T>(en: T, tr: T): Localized<T> => ({ en, tr });
// Block content and explicit [[article.id|words]] links retain the useful stash model.
export type WikiBlock =
  | { kind: 'text' | 'note'; text: string }
  | { kind: 'stats'; items: readonly { key: string; label: string; value: string }[] }
  | { kind: 'list'; items: readonly string[] }
  | { kind: 'table'; caption: string; columns: readonly string[]; rows: readonly (readonly string[])[] };
export interface WikiSection { id: string; title: string; blocks: readonly WikiBlock[] }
export type WikiSubject =
  | { kind: 'building'; id: BuildingId }
  | { kind: 'hull'; id: HullId }
  | { kind: 'instrument'; id: InstrumentId }
  | { kind: 'satellite'; id: SatelliteId }
  | { kind: 'research'; id: ResearchProjectId };
export interface WikiArticle {
  id: string;
  slug: string;
  category: string;
  title: Localized<string>;
  description: Localized<string>;
  sections: Localized<readonly WikiSection[]>;
  subject?: WikiSubject;
  image?: string;
  related: readonly string[];
}
export interface WikiCategory {
  id: string;
  title: Localized<string>;
  description: Localized<string>;
  icon: 'guide' | 'planet' | 'alloy' | 'core' | 'telescope' | 'research' | 'fleet' | 'attack' | 'galaxy' | 'clan' | 'leaderboard' | 'commander';
}
export interface WikiPage {
  path: string;
  fileName: string;
  language: WikiLanguage;
  categoryId?: string;
  articleId?: string;
}
