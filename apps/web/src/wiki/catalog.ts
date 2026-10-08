import {
  ALL_HULLS, BUILDING_IDS, INSTRUMENT_IDS, SATELLITE_IDS, RESEARCH_PROJECT_IDS,
  HULLS, RESEARCH_PROJECTS, DEUTERIUM, SALVAGE,
} from '@astera/rules';
import { vocabulary as en } from '../i18n/locales/en/data.js';
import { vocabulary as tr } from '../i18n/locales/tr/data.js';
import { BUILDING_ART, HULL_ART, SATELLITE_ART, RESEARCH_ART, instrumentArt } from '../ui/assets.js';
import { localized as l, type WikiArticle, type WikiLanguage, type WikiPage, type WikiSection, type WikiSubject } from './model.js';
import { projectCopy } from './project-copy.js';
import { wikiCategories } from './categories.js';
import { conceptArticles } from './concepts.js';
import { fleetAndIntelArticles } from './fleet-and-intel.js';
import { galaxyArticles } from './galaxy-content.js';
import { clanAndSeasonArticles } from './clan-and-season.js';
import { conceptReference, number, subjectReference } from './facts.js';
import { wikiLabels } from './labels.js';

export { wikiCategories } from './categories.js';
const vocabulary = { en, tr };
const subjects: readonly WikiSubject[] = [
  ...BUILDING_IDS.map(id => ({ kind: 'building' as const, id })),
  ...INSTRUMENT_IDS.map(id => ({ kind: 'instrument' as const, id })),
  ...SATELLITE_IDS.map(id => ({ kind: 'satellite' as const, id })),
  ...ALL_HULLS.map(id => ({ kind: 'hull' as const, id })),
  ...RESEARCH_PROJECT_IDS.map(id => ({ kind: 'research' as const, id })),
];

function copy(subject: WikiSubject, language: WikiLanguage): { name: string; role: string; detail: string } {
  const v = vocabulary[language];
  switch (subject.kind) {
    case 'hull': return v.hull[subject.id];
    case 'instrument': return v.instrument[subject.id];
    case 'satellite': return v.satellite[subject.id];
    case 'research': {
      const value = projectCopy[subject.id][language];
      return { ...value, role: value.role.replace('{{share}}', language === 'tr' ? `%${number(DEUTERIUM.graviticDiscoveryShieldShare * 100, language)}` : `${number(DEUTERIUM.graviticDiscoveryShieldShare * 100, language)}%`) };
    }
    case 'building': return v.building[subject.id];
  }
}

function requirements(subject: WikiSubject, language: WikiLanguage): { text: string[]; related: string[] } {
  const t = (english: string, turkish: string): string => language === 'en' ? english : turkish;
  const ref = (kind: WikiSubject['kind'], id: string, level?: number): string => {
    const target = subjects.find(s => s.kind === kind && s.id === id);
    if (!target) throw new Error(`Unknown Wiki subject ${kind}.${id}`);
    return `[[${kind}.${id}|${copy(target, language).name}${level === undefined ? '' : language === 'en' ? ` level ${level}` : ` ${level}. seviye`}]]`;
  };
  switch (subject.kind) {
    case 'hull': {
      const h = HULLS[subject.id];
      const research = h.requiredResearch.map(r => ref('research', r.project, r.level));
      const yardRequirement = h.minShipyard === 0
        ? t(`No Shipyard upgrade is required to build this unit. Upgrade the ${ref('building', 'SHIPYARD')} for faster production.`, `Bu birimi üretmek için Tersane yükseltmesi gerekmez. Daha hızlı üretim için ${ref('building', 'SHIPYARD')} binasını yükselt.`)
        : t(`Build at ${ref('building', 'SHIPYARD', h.minShipyard)}.`, `Üretim koşulu: ${ref('building', 'SHIPYARD', h.minShipyard)}.`);
      const text = [yardRequirement + ' ' + t(research.length ? `Completed research: ${research.join(', ')}.` : 'No completed research is required for this hull.', research.length ? `Tamamlanmış araştırmalar: ${research.join(', ')}.` : 'Bu birim için tamamlanmış araştırma gerekmez.')];
      if (h.ground) text.push(t('Ground defences use the Command Core’s ground capacity. They cannot fly, transfer or carry resources. They share the Yard queue with ships. Some destroyed defences are [[combat.loot|rebuilt free after combat]].', 'Yer savunmaları Komuta Çekirdeğinin yer kapasitesini kullanır. Uçamaz, transfer edilemez veya kaynak taşıyamazlar. Gemilerle aynı Tersane sırasını kullanırlar. Savaşta yok edilenlerin bir kısmı [[combat.loot|ücretsiz yeniden kurulur]].'));
      else if (h.id === 'PROSPECTOR') text.push(t('Prospector is a mining craft and cannot join raid fleets. Its craft limit and mining capacity are separate from ordinary fleet cargo. [[satellite.DERRICK|Derrick]] improves it, and it still uses Hangar room. Read [[galaxy.mining|mining]] before sending it.', 'Kazıcı, madencilik aracıdır; akın filosuna katılamaz. Araç sınırı ve maden kapasitesi, normal filo kargosundan ayrıdır. [[satellite.DERRICK|Matkap]] onu geliştirir; Hangar alanı kullanmaya devam eder. Göndermeden önce [[galaxy.mining|madencilik kurallarını]] oku.'));
      else text.push(t(`Class: ${vocabulary[language].combatClass[h.cls].name}. ${vocabulary[language].combatClass[h.cls].tag}. Ships away still use the origin’s [[building.HANGAR|Hangar]] room. The slowest selected ship sets fleet speed. Compare attack, hull strength, cargo and room before building.`, `Sınıf: ${vocabulary[language].combatClass[h.cls].name}. ${vocabulary[language].combatClass[h.cls].tag}. Görevdeki gemiler de çıkış gezegeninin [[building.HANGAR|Hangar]] alanında sayılır. En yavaş seçilen gemi filo hızını belirler. Üretmeden önce saldırıyı, dayanımı, kargoyu ve kullanılan alanı karşılaştır.`));
      return { text, related: [h.ground ? 'combat.model' : h.id === 'PROSPECTOR' ? 'galaxy.mining' : 'fleet.flights', 'combat.counters', ...h.requiredResearch.map(r => `research.${r.project}`)] };
    }
    case 'research': {
      const p = RESEARCH_PROJECTS[subject.id];
      const gates = [p.prerequisite ? ref('research', p.prerequisite, p.prerequisiteLevel ?? 1) : t('No prerequisite research', 'Ön koşul araştırma yok'), ...(p.requiredCore ? [ref('building', 'CORE', p.requiredCore) + t(' on the capital', " ana gezegende")] : [])];
      const opened = ALL_HULLS.filter(id => HULLS[id].requiredResearch.some(r => r.project === subject.id));
      const children = RESEARCH_PROJECT_IDS.filter(id => RESEARCH_PROJECTS[id].prerequisite === subject.id);
      return { text: [gates.join(' · ') + '.', t(`This project has ${p.maxLevel} paid level${p.maxLevel === 1 ? '' : 's'}. Completed research applies across your planets. Payment comes from the selected world’s Store. Funding from another world does not create another research queue. Started research cannot be cancelled.`, `Bu araştırmanın ${p.maxLevel} seviyesi vardır; her seviye ayrı ödenir. Tamamlanan seviyeler bütün gezegenlerinde geçerlidir. Bedel, ödeme için seçtiğin gezegenin Deposundan çıkar. Başka gezegenden ödeme yapmak yeni bir araştırma sırası oluşturmaz. Başlatılan araştırma iptal edilemez.`), ...(opened.length + children.length ? [t('Connections: ', 'Bağlantılar: ') + [...opened.map(id => ref('hull', id)), ...children.map(id => ref('research', id))].join(', ') + '.'] : [])], related: ['research.overview', 'economy.queues', ...opened.map(id => `hull.${id}`), ...children.map(id => `research.${id}`)] };
    }
    case 'building': return { text: [subject.id === 'HANGAR' || subject.id === 'CORE' ? t('This building has its own level limit. Check the capacity added by each upgrade in the table below.', 'Bu binanın kendi seviye sınırı vardır. Her yükseltmenin kapasiteye etkisini aşağıdaki tablodan kontrol et.') : t(`The local ${ref('building', 'CORE')} must reach at least the level you want to build. An earlier queued Core upgrade can meet this requirement.`, `Gezegenin ${ref('building', 'CORE')} seviyesi, kuracağın seviyeden düşük olamaz. Sırada önce tamamlanacak Çekirdek yükseltmesi bu koşulu karşılayabilir.`), ...(subject.id === 'DEUTERIUM_PLANT' ? [t(`${ref('research', 'DEUTERIUM_SYNTHESIS')} must also permit the new level.`, `${ref('research', 'DEUTERIUM_SYNTHESIS')} yeni seviyeye ayrıca izin vermelidir.`)] : []), t('Upgrades use this planet’s Construction queue and resources in its Store. Resources waiting in the Works cannot pay. Keep enough stock for fuel and defence. Read [[economy.queues|order queues]] for timing and cancellation losses.', 'Yükseltme, bu gezegenin İnşaat sırasını ve Deposundaki kaynakları kullanır. Havuzdaki kaynaklarla ödeme yapılmaz. Yakıt ve savunma için kaynak bırak. Süre ve iptal kayıpları için [[economy.queues|sipariş sıralarını]] incele.')], related: ['economy.resources', 'economy.queues', subject.id === 'HANGAR' || subject.id === 'SHIPYARD' ? 'fleet.flights' : 'economy.collectors'] };
    case 'instrument': return { text: [t(`Requires a local ${ref('building', 'CORE')} supporting the level being installed. ${subject.id === 'TELESCOPE' || subject.id === 'RADAR' ? `${ref('satellite', 'UPLINK')} must be installed first.` : 'It does not require Uplink.'}`, `Gezegendeki ${ref('building', 'CORE')}, kurulacak seviyeye en az eşit olmalıdır. ${subject.id === 'TELESCOPE' || subject.id === 'RADAR' ? `Önce ${ref('satellite', 'UPLINK')} kurulmalıdır.` : 'Anten gerektirmez.'}`), t('Installation uses this planet’s Construction queue and Store resources, but no orbit slot. Instruments provide different functions: warnings, remote observation, shielding or concealment. Choose the function you need; one does not replace the others.', 'Kurulum, bu gezegenin İnşaat sırasını ve Depo kaynaklarını kullanır; yörünge yuvası kullanmaz. Cihazlar uyarı, uzak gözlem, kalkan veya gizlenme sağlar. İhtiyacın olan işlevi seç; biri diğerlerinin yerine geçmez.')], related: [subject.id === 'AEGIS' ? 'combat.model' : 'intel.overview', 'hardware.orbit', 'intel.probes'] };
    case 'satellite': return { text: [t(`Requires a free orbit slot opened by this planet’s ${ref('building', 'CORE')}. It is installed through Construction and has no upgrade levels. Two different bonuses can coexist if you have enough slots.`, `Bu gezegenin ${ref('building', 'CORE')} seviyesinin açtığı boş yörünge yuvası gerekir. İnşaat sırasından kurulur; yükseltme seviyesi yoktur. Yeterli yuva varsa farklı uydu etkileri birlikte çalışır.`), t('Choose satellites for this planet’s purpose: production, mining, raids or intelligence. A satellite affects its own planet, unlike research shared across your planets. Read [[hardware.orbit|orbit slots]] to plan installations.', 'Uyduları gezegenin amacına göre seç: üretim, madencilik, akın veya istihbarat. Uydu, ortak araştırmalardan farklı olarak yalnız kurulduğu gezegeni etkiler. Kurulumu planlamak için [[hardware.orbit|yörünge yuvalarını]] incele.')], related: ['hardware.orbit', subject.id === 'DERRICK' ? 'galaxy.mining' : subject.id === 'UPLINK' ? 'intel.overview' : subject.id === 'BEACON' ? 'fleet.flights' : 'economy.resources'] };
  }
}

function catalogueArticle(subject: WikiSubject): WikiArticle {
  const section = (language: WikiLanguage): WikiSection[] => {
    const words = wikiLabels[language]; const value = copy(subject, language); const connection = requirements(subject, language);
    const interpolate = (text: string): string => text.replace('{{salvage}}', number(SALVAGE.perCollector, language));
    return [
      { id: 'use', title: words.use, blocks: [{ kind: 'text', text: interpolate(value.role) }, { kind: 'text', text: interpolate(value.detail) }] },
      { id: 'requirements', title: words.requires, blocks: connection.text.map(text => ({ kind: 'text', text })) },
      subjectReference(subject, language),
    ];
  };
  const image = subject.kind === 'building' ? BUILDING_ART[subject.id] : subject.kind === 'hull' ? HULL_ART[subject.id] : subject.kind === 'satellite' ? SATELLITE_ART[subject.id] : subject.kind === 'research' ? RESEARCH_ART[subject.id] : instrumentArt(subject.id, 1);
  const description = (language: WikiLanguage): string => {
    const value = copy(subject, language);
    if (subject.kind === 'research' && subject.id === 'GRAVITIC_CHARGES' && language === 'en') {
      return `${value.name}: Attack a defended world whose active Aegis absorbs at least ${number(DEUTERIUM.graviticDiscoveryShieldShare * 100, language)}% of your damage to unlock this research. The Nullifier hits shields five times harder.`;
    }
    const result = `${value.name}: ${value.role.replace(/[.!]+$/, '')}.`;
    return result.length > 50 ? result : result + (language === 'en' ? ' Requirements, costs and practical use.' : ' Şartları, bedelleri ve kullanımı öğren.');
  };
  return { id: `${subject.kind}.${subject.id}`, slug: subject.id.toLowerCase().replaceAll('_', '-'), category: subject.kind === 'building' ? 'buildings' : subject.kind === 'hull' ? 'fleet' : subject.kind === 'research' ? 'research' : 'hardware', subject, title: l(copy(subject, 'en').name, copy(subject, 'tr').name), description: l(description('en'), description('tr')), sections: l(section('en'), section('tr')), related: requirements(subject, 'en').related, ...(image ? { image } : {}) };
}

export const wikiArticles: readonly WikiArticle[] = [
  ...[...conceptArticles, ...fleetAndIntelArticles, ...galaxyArticles, ...clanAndSeasonArticles].map(article => {
    const addReference = (language: WikiLanguage): readonly WikiSection[] => { const ref = conceptReference(article.id, language); return ref ? [...article.sections[language], ref] : article.sections[language]; };
    return { ...article, sections: l(addReference('en'), addReference('tr')) };
  }),
  ...subjects.map(catalogueArticle),
];
const articlesById = new Map(wikiArticles.map(article => [article.id, article]));
export const getWikiArticle = (id: string): WikiArticle | undefined => articlesById.get(id);
export const wikiRoot = (language: WikiLanguage): string => language === 'en' ? '/wiki' : '/wiki/tr';
export const wikiCategoryPath = (id: string, language: WikiLanguage): string => `${wikiRoot(language)}/${id}`;
export function wikiPath(id: string, language: WikiLanguage): string {
  const article = getWikiArticle(id);
  if (!article) throw new Error(`Unknown Wiki article ${id}`);
  return `${wikiCategoryPath(article.category, language)}/${article.slug}`;
}
export const wikiPages: readonly WikiPage[] = (['en', 'tr'] as const).flatMap(language => [
  { path: wikiRoot(language), fileName: `${wikiRoot(language).slice(1)}/index.html`, language },
  ...wikiCategories.map(category => ({ path: wikiCategoryPath(category.id, language), fileName: `${wikiCategoryPath(category.id, language).slice(1)}.html`, language, categoryId: category.id })),
  ...wikiArticles.map(article => ({ path: wikiPath(article.id, language), fileName: `${wikiPath(article.id, language).slice(1)}.html`, language, categoryId: article.category, articleId: article.id })),
]);
export const getWikiPage = (path: string): WikiPage | undefined => wikiPages.find(page => page.path === path);
export function translatedWikiPath(page: WikiPage, language: WikiLanguage): string {
  return page.articleId ? wikiPath(page.articleId, language) : page.categoryId ? wikiCategoryPath(page.categoryId, language) : wikiRoot(language);
}
