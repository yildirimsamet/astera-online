/**
 * THE REWARD PANEL.
 *
 * Every sentence here answers one of two questions and nothing else: *what do I
 * have to do*, and *what do I get*. Nothing congratulates the player, nothing
 * urges them, and nothing counts down — this is a list of standing offers, not a
 * campaign to be nagged through.
 *
 * The names are the GOALS rather than the prizes ("Probes sent", never "Scout
 * Bonus I"), because the panel's real job is to point at parts of the loop a new
 * commander has not tried yet. A player reading this list should come away
 * knowing that probing, raiding, mining and salvaging exist.
 */
export const rewards = {
  empty: 'Keine Belohnungsziele verfügbar',
  emptyHint: 'Lade die Belohnungsliste erneut, um nachzusehen.',
  summaryReady: "Bereit zum Abholen",
  summaryClaimed: "Abgeholte Stufen",
  allMilestones: "Alle Stufen",
  eyebrow: 'Dauerhafte Belohnungen',
  title: 'Belohnungen',
  intro:
    "Kein Ablauf, keine Serie. Alles geht ins Lager; Ungeschütztes kann geplündert werden.",

  waiting: '{{count}} zum Abholen bereit',
  allTaken: 'Du hast alle verfügbaren Belohnungen abgeholt. Mit deinem Fortschritt kommen weitere dazu.',

  claim: 'Abholen',
  /** The supply pod over the list: the next ready payout, opened by a tap (C34). */
  welcome: {
    board: 'Neuer Kommandant · 7 Kisten',
    rule: 'Jede Kiste gewährt steigende feste Ressourcen; Tag 3 bringt den Helios-Planetenring, ab Tag 4 Deuterium und Tag 7 den Titan-Antrieb. Die nächste ist {{gap}} Stunden nach dem Öffnen bereit und wartet auf dich.',
    title: 'Kommandantenkiste {{box}}/{{of}}',
    opened: 'Geöffnet',
    ready: 'Bereit',
    hold: 'Halten',
    wait: 'in {{time}}',
    big: 'Große Kiste',
    later: 'Feste Belohnung',
    poured: 'In dein Lager: {{purse}}',
    skinRingHelios: 'Helios-Ring',
    skinEngineTitan: 'Titan-Antrieb',
  },
  takeAll: 'Alle nehmen · {{count}}',
  go: 'Los',
  next: 'Als Nächstes: {{name}} · noch {{count}}',
  openPod: 'Kapsel öffnen',
  podTask: 'Aufgabe',
  podPrize: 'Belohnung',
  claimed: 'Abgeholt',
  /** What is still between the player and this tier. Never a scolding. */
  toGo: 'Noch {{count}}',
  locked: 'Gesperrt',

  /** The target on a tier row. `×3` and `L5` — never "3 probes", which reads wrong at 1. */
  goalCount: '×{{n}}',
  goalLevel: 'L{{n}}',
  /** The chain's standing, beside its name. */
  progressCount: '{{have}} / {{need}}',
  progressLevel: 'L{{have}}',
  progressDone: 'Abgeschlossen',

  granted: '+{{alloy}} Legierung · +{{crystal}} Kristall',
  overCap:
    'Über dem Lagerlimit: nichts geht verloren, aber Abholen erst nach dem Ausgeben.',

  /**
   * ONE ENTRY PER CHAIN, `name` + `tag`, the same shape every card in the game
   * uses (`docs/interface.md`): the name says what the goal IS, the tag says why
   * anybody would want it. A player scanning eleven of these needs both.
   */
  chains: {
    VAULT: { name: 'Tresor ausgebaut', tag: 'Schütze einen Teil deiner gelagerten Ressourcen' },
    PIRATE: { name: 'Piraten besiegt', tag: 'Besiege verschiedene Piraten und bring deine Schiffe zurück' },
    PROBE: { name: 'Sonden entsandt', tag: 'Erkunde dein Ziel, bevor du angreifst' },
    RAID: { name: 'Welten überfallen', tag: 'Greif verschiedene Welten an' },
    CORE: { name: 'Kommandokern ausgebaut', tag: "Erhöhe Gebäudestufengrenzen, außer beim Hangar" },
    SHIPYARD: { name: 'Werft', tag: 'Öffnet schwerere Rümpfe' },
    REFINERY: { name: 'Legierungsraffinerie', tag: 'Mehr Legierung pro Stunde' },
    EXTRACTOR: { name: 'Kristallextraktor', tag: 'Mehr Kristall pro Stunde' },
    SHIPS: { name: 'Dart gebaut', tag: 'Zählt über die gesamte Saison hinweg' },
    AEGIS: { name: 'Aegis', tag: 'Ein Schild über deiner Welt' },
    MINE: { name: 'Asteroid abgebaut', tag: 'Erreiche einen vorbeiziehenden Asteroiden' },
    SALVAGE: { name: 'Wrack geborgen', tag: 'Sammle ein, was nach einer Schlacht zurückbleibt' },
    SOCIAL: { name: '@JoinAstera folgen', tag: 'Einmalig pro Konto' },
  },

  /**
   * The one reward the game cannot see, so the card has to be an instruction
   * rather than a progress bar. Three steps, stated plainly, with the handle as a
   * real link — a player is not going to retype it.
   */
  /**
   * THE COMMUNITY BONUS, and it is written as an INSTRUCTION rather than as a
   * description, because it is the only thing in the game a player has to do
   * somewhere else. Three steps, in the order they have to happen, each one short
   * enough to be read on a phone with the app already open in another tab.
   */
  social: {
    how: 'So verdienst du es',
    howFact: 'Drei Schritte auf X.',
    eyebrow: 'Community-Bonus',
    handle: '@JoinAstera',
    url: 'https://x.com/JoinAstera',
    alloy: '-Legierung',
    crystal: 'Kristall',
    open: '@JoinAstera auf X öffnen',
    step1: 'Folge @JoinAstera – der Button unten öffnet es in einem neuen Tab.',
    step2: 'Schick uns eine Direktnachricht mit deinem Kommandantennamen:',
    step3: 'Wir prüfen es von Hand. Danach wartet die Belohnung hier auf dich.',
    pending: 'Wir warten auf deine Nachricht',
    ready: 'Bestätigt – hol dir deinen Bonus',
    /**
     * WHAT A PLAYER WHO ALREADY HAS IT READS, and it has to say more than "Taken"
     * — every other card in this panel says that about THIS season, and a new
     * galaxy brings all of them back. This one does not come back, so the card
     * says so plainly rather than leaving somebody following an account they
     * already follow and waiting for a reply that will never pay.
     */
    forever: 'Bereits bezahlt. Dieser Bonus gilt einmal pro Konto – eine neue Galaxie bringt ihn nicht zurück.',
  },
} as const;
