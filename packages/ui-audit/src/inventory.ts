/**
 * EVERY SURFACE A PLAYER CAN SEE, AND HOW THE AUDIT GETS THERE.
 *
 * Owner rule for the UI/UX work (2026-11-11): nothing is skipped silently. Every `.tsx`
 * file under LISTED_DIRECTORIES belongs to a surface here or to OUT_OF_SCOPE with a
 * reason; `test/inventory.test.ts` keeps it that way. Shared building blocks (`ui/`,
 * `v2/kit/`, `galaxy/`) are measured wherever a surface draws them.
 *
 * Ways in, cheapest first:
 *   gallery:<view>     apps/web/v2-gallery.html?view=<view>, fixture data, no account
 *   client:<scenario>  the real client on a local server with a seeded commander
 *   training:<step>    the pre-account prologue and flight school
 *   starter:<step>     the starter galaxy (server with STARTER_GALAXY_ENABLED)
 *   arena:<step>       ?arena=sandbox, the commander-ship arena
 *   simulator          ?simulator=1
 *   landing:<step>     the public front door and its dialogs
 *   wiki:<page>        the published wiki
 *   special:<how>      a state the app only shows on a fault or a server flag
 */

export type Reach =
  | `gallery:${string}`
  | `client:${string}`
  | `training:${string}`
  | `starter:${string}`
  | `arena:${string}`
  | 'simulator'
  | `landing:${string}`
  | `wiki:${string}`
  | `special:${string}`;

export interface Surface {
  id: string;
  /** What the player sees, in a few words. */
  what: string;
  /** The files under LISTED_DIRECTORIES that draw it, relative to apps/web/src. */
  files: string[];
  reach: Reach[];
}

/**
 * The stage-4 redesign groups (plan §4.B), worked in this order; G14 is the admin panel,
 * which has no player surface, and G15 the starter journey the owner put last (2026-11-13).
 */
export const GROUPS = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12', 'G13', 'G14', 'G15'] as const;
export type Group = (typeof GROUPS)[number];

/** A game surface: measured like any other, and rebuilt on the kit in its group. */
export interface GameSurface extends Surface {
  group: Group;
  /**
   * States the code draws that no way in reaches yet (stage 4.A, 2026-11-13). Each gets a
   * gallery view or client scenario in its group's first step (§4.C, inspect) and leaves
   * this list; the static report prints what is left beside each surface's dialect.
   */
  unreached?: string[];
}

export const LISTED_DIRECTORIES = ['screens', 'shell', 'v2/hud', 'v2/shell', 'starter', 'onboarding', 'arena', 'landing', 'wiki', 'battle-simulator', 'legacy'];

export const SURFACES: GameSurface[] = [
  // The galaxy and the HUD around it.
  {
    id: 'galaxy-hud',
    what: 'Galaksi ana ekranı ve HUD: üst bar, iş satırı, dock, köşeler, sinyaller',
    files: ['screens/GalaxyView.tsx', 'v2/shell/GameShell.tsx', 'v2/shell/HudTop.tsx', 'v2/shell/HudDock.tsx', 'v2/hud/TopBar.tsx', 'v2/hud/StatusLine.tsx', 'v2/hud/Dock.tsx', 'v2/hud/GalaxyCorners.tsx', 'v2/hud/ContextSlot.tsx', 'v2/hud/BaseSwitch.tsx', 'shell/PendingStrip.tsx', 'screens/UnknownSignalHud.tsx'],
    reach: ['gallery:store-discovery', 'gallery:hud-protected', 'gallery:hud-vacation', 'gallery:context-attack', 'gallery:context-event', 'gallery:context-events', 'gallery:context-suggestion', 'gallery:context-selected', 'gallery:readout', 'gallery:toast', 'gallery:toast-warn', 'gallery:toast-error', 'client:galaxy-new', 'client:galaxy-mid', 'client:galaxy-late'],
    group: 'G1',
  },
  { id: 'cosmetic-trial', what: 'Kozmetik deneme şeridi, galaksi üzerinde', files: ['screens/CosmeticTrialBar.tsx'], reach: ['gallery:cosmetic-trial'], group: 'G6' },
  { id: 'now-line', what: 'Şimdi satırı ve zamanlayıcılar', files: ['v2/hud/NowLine.tsx'], reach: ['gallery:timers'], group: 'G1' },
  { id: 'outline', what: 'Üs ve filo özeti katmanı', files: ['v2/hud/Outline.tsx', 'v2/shell/OutlineHost.tsx'], reach: ['client:outline'], group: 'G1' },
  { id: 'fleet', what: 'Filo sayfası: havada, evde, oda', files: ['v2/hud/FleetPage.tsx', 'v2/shell/FleetHost.tsx'], reach: ['gallery:fleet', 'gallery:fleet-home', 'gallery:fleet-room', 'gallery:support-fleet'], group: 'G2', unreached: ['Havada: anıtta bekleyen dalga satırları'] },
  { id: 'bell', what: 'Zil: sinyal akışı ve kronik sekmesi', files: ['v2/hud/BellSheet.tsx', 'v2/shell/BellHost.tsx', 'shell/Signals.tsx'], reach: ['gallery:bell', 'gallery:bell-empty'], group: 'G1' },
  { id: 'chronicle', what: 'Kronik: galaksi geçmişi', files: ['screens/ChronicleScreen.tsx'], reach: ['client:chronicle'], group: 'G5' },
  { id: 'away', what: 'Yokken olanlar özeti', files: ['v2/hud/AwaySheet.tsx', 'v2/shell/AwayHost.tsx'], reach: ['gallery:away'], group: 'G5', unreached: ['gemideki dönüş hikâyesi'] },
  { id: 'view-sheet', what: 'Görünüm ayarları sayfası', files: ['v2/hud/ViewSheet.tsx'], reach: ['gallery:view'], group: 'G3' },
  { id: 'queue', what: 'İnşa ve tersane kuyruğu', files: [], reach: ['gallery:queue'], group: 'G2' },
  { id: 'peek', what: 'Gezegene hızlı bakış', files: [], reach: ['gallery:peek'], group: 'G4', unreached: ['gerçek odak kartının göz atma bölümü (galeri yer tutucu çiziyor)'] },
  { id: 'silent-space', what: 'Sessiz Uzay dönüş bildirimi (panel return)', files: ['shell/SilentSpaceNotice.tsx'], reach: ['client:return'], group: 'G10' },
  { id: 'worlds', what: 'Dünyalar paneli', files: ['screens/WorldsPanel.tsx'], reach: ['client:worlds'], group: 'G2', unreached: ['tek dünya (aktarma yok)'] },
  { id: 'events-guide', what: 'Galaksi olayları rehberi', files: ['screens/GalaxyEventsGuide.tsx'], reach: ['client:events-guide'], group: 'G3' },
  { id: 'unknown-signal', what: 'Bilinmeyen sinyal sayfası', files: ['screens/UnknownSignalSheet.tsx'], reach: ['client:unknown-signal'], group: 'G4', unreached: ['sonuç: korsan', 'sonuç: kaplama', 'gemi yok, üretime yönlendirme'] },

  // Reading a target and acting on it.
  {
    id: 'focus',
    what: 'Odak paneli: hedef dosyası, iplik, radyasyon, bant, anıt',
    files: ['v2/hud/TargetDossier.tsx', 'starter/OutpostReading.tsx', 'starter/PartHere.tsx', 'screens/RadiationBombControls.tsx'],
    reach: ['gallery:focus-radiation', 'gallery:focus-band', 'gallery:focus-monument', 'gallery:focus-thread', 'gallery:focus-thread-pirate', 'gallery:support-focus', 'client:focus'],
    group: 'G4', unreached: ['keşfedilmemiş dünya', 'kendi dünyam', 'kalkanlı / tatildeki hedef', 'Ölüm Yıldızı bölümü', 'asteroit (madencilik)', 'enkaz', 'korsan', 'ticaret gemisi', 'galaksiler arası konvoy', 'temas'],
  },
  { id: 'launch', what: 'Saldırı/gönderme sayfası', files: ['screens/LaunchSheet.tsx', 'starter/TempoNote.tsx'], reach: ['gallery:launch', 'gallery:launch-pirate', 'gallery:launch-radiation', 'gallery:launch-radiation-lethal', 'gallery:support-launch'], group: 'G4' },
  { id: 'transfer', what: 'Kaynak/filo aktarımı', files: ['screens/TransferSheet.tsx'], reach: ['gallery:transfer', 'gallery:transfer-radiation'], group: 'G4' },
  { id: 'convoy', what: 'Galaksiler arası konvoy', files: ['screens/IntergalacticConvoySheet.tsx'], reach: ['gallery:convoy'], group: 'G4' },
  { id: 'trade', what: 'Ticaret', files: ['screens/TradeSheet.tsx'], reach: ['gallery:trade'], group: 'G4' },
  { id: 'settlement', what: 'Koloni kurma ve sahiplenme', files: ['screens/SettlementSheet.tsx'], reach: ['gallery:settlement', 'gallery:settlement-priority', 'gallery:claim-mine', 'gallery:claim-other'], group: 'G4' },
  { id: 'strike', what: 'Stratejik saldırı ve raporu', files: [], reach: ['gallery:strike', 'gallery:report-strike-colony'], group: 'G4', unreached: ['engelli vuruş (menzil, kalkan, köken toparlanıyor, yuva)'] },
  { id: 'monument', what: 'Anıt sayfası, rota ve savaş kuralları', files: ['screens/MonumentSheet.tsx', 'screens/MonumentRoutePreview.tsx', 'screens/MonumentBattleRules.tsx'], reach: ['client:monument'], group: 'G9', unreached: ['dalga beklemede'] },

  // The planet and what is built on it.
  {
    id: 'planet',
    what: 'Gezegen sayfası: filo, üretim, onarım, stratejik, arıza, klan destek bölmesi',
    files: ['screens/PlanetScreen.tsx', 'v2/shell/BaseQueues.tsx', 'screens/RepairStation.tsx', 'screens/FaultSheet.tsx', 'screens/faultScope.tsx', 'screens/ColonyAbandonment.tsx', 'screens/ClanSupportBay.tsx'],
    reach: ['gallery:base-fleet', 'gallery:base-production', 'gallery:base-fleet-empty', 'gallery:base-faults', 'gallery:fault-sheet', 'gallery:fault-sheet-running', 'gallery:fault-sheet-short', 'gallery:repair-station', 'gallery:repair-station-hangar', 'gallery:repair-station-queue', 'gallery:repair-station-radiation', 'gallery:repair-station-empty', 'gallery:strategic-forge', 'gallery:strategic-battery', 'gallery:support-hangar', 'gallery:support-hangar-escape', 'gallery:support-hangar-locked', 'gallery:support-hangar-hold', 'gallery:support-hangar-both', 'gallery:support-hangar-alarm', 'client:planet-colony'],
    group: 'G2', unreached: ["gemi üretme sheet'i (BuildSheet)", 'toparlanma bandı', 'EMP bandı', 'çekirdek onayı (tatilde)', 'onarım: hurda ve iptal onayı'],
  },
  { id: 'research', what: 'Araştırma takımyıldızı', files: ['screens/ResearchPanel.tsx', 'v2/hud/ResearchConstellation.tsx'], reach: ['gallery:base-research'], group: 'G2', unreached: ["proje sheet'i", 'tatilde duraklatılmış'] },

  // Intelligence and reports.
  { id: 'intel', what: 'İstihbarat merkezi', files: ['screens/IntelScreen.tsx'], reach: ['gallery:intel', 'gallery:intel-blind', 'gallery:intel-probes', 'gallery:intel-radar', 'gallery:intel-blind-probes', 'gallery:intel-blind-radar'], group: 'G3', unreached: ['Savaşlar rafı (G5)'] },
  {
    id: 'reports',
    what: 'Savaş raporları ve anıt raporu',
    files: ['screens/BattleReports.tsx', 'v2/hud/ReportScene.tsx', 'screens/MonumentReportSheet.tsx', 'battle-simulator/BattleReplayAction.tsx'],
    reach: ['gallery:report', 'gallery:report-defend', 'gallery:support-report', 'gallery:support-report-supporter'],
    group: 'G5', unreached: ['savaş listesi (boş, okunmamış, stratejik satır)', 'korsan raporu', 'Hakimiyet dökümü'],
  },
  { id: 'battle-replay', what: 'Savaş tekrarı', files: ['battle-simulator/BattleReplay.tsx', 'battle-simulator/BattleReplayDialog.tsx', 'battle-simulator/BattleStage.tsx', 'battle-simulator/RetreatRoster.tsx', 'battle-simulator/UnitInspector.tsx'], reach: ['client:battle-replay'], group: 'G5', unreached: ['kayıt yok / güç yetersiz / çok büyük', 'yüklenemedi (yeniden yükle)'] },
  {
    id: 'simulator',
    what: 'Savaş simülatörü',
    files: ['battle-simulator/BattleSimulator.tsx', 'battle-simulator/SimulatorDialog.tsx', 'battle-simulator/SimulatorHost.tsx', 'battle-simulator/SideEditor.tsx', 'battle-simulator/SimulationNumberInput.tsx', 'battle-simulator/BattleBalance.tsx'],
    reach: ['simulator', 'client:simulator'],
    group: 'G11',
  },

  // Clan.
  {
    id: 'clan',
    what: 'Klan: genel, güç, üyeler, yardım, savaş, dalga',
    files: ['screens/ClanScreen.tsx', 'screens/ClanWarPanel.tsx', 'screens/ClanBanner.tsx', 'screens/ClanDonateSheet.tsx', 'screens/ClanWaveSheet.tsx', 'screens/CommunityPolicy.tsx'],
    reach: ['gallery:clan', 'gallery:clan-strength', 'gallery:clan-members', 'gallery:clan-aid', 'gallery:clan-war', 'gallery:wave', 'gallery:wave-critical', 'gallery:support-banner', 'gallery:support-banner-gold'],
    group: 'G7', unreached: ['dışarıda: tanıtım, klan kur, katıl', 'lider eylem onayı'],
  },
  { id: 'clan-support', what: 'Klan savunma desteği', files: ['screens/ClanSupportSheet.tsx'], reach: ['gallery:support-sheet', 'gallery:support-sheet-alarm', 'gallery:support-clanmate', 'gallery:support-clanmate-closed'], group: 'G7' },
  {
    id: 'chat',
    what: 'Sohbet, medya, tepkiler, engelleme, şikâyet',
    files: ['screens/ChatScreen.tsx', 'v2/shell/ChatHost.tsx', 'screens/ChatMediaAttachment.tsx', 'screens/ChatMediaComposer.tsx', 'screens/ChatReactionRoster.tsx', 'screens/CommunityBlocks.tsx', 'screens/ContentReportSheet.tsx'],
    reach: [
      'gallery:chat', 'gallery:chat-empty', 'gallery:chat-clan', 'gallery:chat-dm', 'gallery:chat-dm-empty', 'gallery:chat-dm-new', 'gallery:chat-actions',
      'gallery:chat-react', 'gallery:chat-roster', 'gallery:chat-report', 'gallery:chat-media', 'gallery:chat-muted', 'gallery:chat-muted-empty',
      'gallery:chat-blocked', 'gallery:chat-block', 'gallery:chat-policy', 'gallery:support-chat', 'client:chat', 'client:chat-rules',
    ],
    group: 'G8',
  },

  // Menu, commander and meta.
  { id: 'menu', what: 'Menü (Komutan sayfası), ayarlar, mağaza vitrini', files: ['shell/MenuPanel.tsx', 'shell/ShopShowcase.tsx', 'shell/ShopShowcasePoster.tsx'], reach: ['gallery:menu', 'gallery:menu-settings', 'gallery:menu-academy', 'gallery:menu-community', 'gallery:menu-ended', 'client:menu'], group: 'G1' },
  { id: 'notifications', what: 'Bildirim Merkezi', files: ['screens/NotificationCenterSheet.tsx'], reach: ['gallery:notification-center', 'gallery:notification-center-new', 'gallery:notification-center-late'], group: 'G8' },
  { id: 'leaderboard', what: 'Sıralama ve sezon arşivi', files: ['screens/LeaderboardScreen.tsx', 'screens/SeasonArchiveScreen.tsx'], reach: ['gallery:leaderboard', 'gallery:leaderboard-archive'], group: 'G9', unreached: ['komutan profili (arşiv)'] },
  { id: 'rewards', what: 'Ödüller', files: ['screens/RewardsScreen.tsx'], reach: ['gallery:rewards', 'gallery:rewards-ready', 'gallery:rewards-complete', 'gallery:rewards-empty', 'client:rewards'], group: 'G6' },
  { id: 'announcements', what: 'Duyurular', files: ['screens/AnnouncementsScreen.tsx'], reach: ['gallery:announcements', 'gallery:announcements-empty', 'client:announcements'], group: 'G8' },
  { id: 'feedback', what: 'Geri bildirim formu', files: ['screens/FeedbackScreen.tsx'], reach: ['gallery:feedback', 'client:feedback'], group: 'G8' },
  { id: 'donate', what: 'Bağış', files: ['screens/DonateScreen.tsx'], reach: ['gallery:donate'], group: 'G6' },
  {
    id: 'shop',
    what: 'Mağaza: kaplamalar, önizleme, koleksiyon, ödeme',
    files: ['screens/SkinsScreen.tsx', 'screens/SkinPreview.tsx', 'screens/CosmeticCollection.tsx', 'screens/CosmeticNavigation.tsx', 'screens/CosmeticPreview.tsx', 'screens/ShipSkinDrive.tsx', 'screens/ShopierCheckout.tsx'],
    reach: ['gallery:skin-shop', 'gallery:skin-shop-live'],
    group: 'G6', unreached: ['ödeme adımı (ShopierCheckout)'],
  },
  { id: 'inventory', what: 'Envanter: sahip olunan kaplamalar', files: ['screens/SkinInventoryScreen.tsx'], reach: ['gallery:skin-inventory', 'gallery:skin-inventory-empty', 'gallery:ship-skin-inventory'], group: 'G6' },
  { id: 'wiki-sheet', what: 'Oyun içi Wiki', files: ['screens/WikiScreen.tsx', 'wiki/WikiContent.tsx'], reach: ['gallery:wiki'], group: 'G11' },
  { id: 'wiki-public', what: 'Yayınlanan Wiki sayfaları', files: ['wiki/publication.tsx'], reach: ['wiki:index', 'wiki:article'], group: 'G11' },
  {
    id: 'profile',
    what: 'Profil: komutan kartı, ülke, tatil, hesap güvenliği ve silme',
    files: ['shell/ProfileHost.tsx', 'shell/ProfilePage.tsx', 'v2/shell/CommanderHost.tsx', 'v2/hud/CommanderCard.tsx', 'screens/VacationSheet.tsx', 'screens/AccountSecuritySheet.tsx', 'screens/AccountDeletionSheet.tsx', 'screens/securityFields.tsx'],
    reach: ['gallery:country-picker', 'client:profile'],
    group: 'G10', unreached: ["tatil sheet'i", 'hesap güvenliği', 'hesap silme'],
  },
  {
    id: 'legacy',
    what: 'Komutan Mirası: ödül, raf, açılış, profil',
    files: ['legacy/AwardReveal.tsx', 'legacy/AwardScene.tsx', 'legacy/AwardSheet.tsx', 'legacy/AwardStage.tsx', 'legacy/AwardTile.tsx', 'legacy/LegacyPeek.tsx', 'legacy/LegacyProfile.tsx', 'legacy/ShowcaseEditor.tsx', 'legacy/ShowcaseShelf.tsx'],
    reach: ['gallery:legacy-award', 'gallery:legacy-shelf', 'gallery:legacy-shelf-new', 'gallery:legacy-shelf-b', 'gallery:legacy-shelf-c', 'gallery:legacy-reveal', 'gallery:legacy-peek', 'gallery:legacy-profile'],
    group: 'G10',
  },
  { id: 'season-recap', what: 'Sezon özeti', files: ['screens/SeasonRecap.tsx'], reach: ['client:recap'], group: 'G9' },
  { id: 'servers', what: 'Galaksi seçimi', files: ['screens/ServersScreen.tsx'], reach: ['client:servers'], group: 'G10' },

  // Before the game: front door, training, loading, faults.
  {
    id: 'landing',
    what: 'Ön kapı, giriş/kayıt, şifre sıfırlama, çerez izni',
    files: ['screens/LandingScreen.tsx', 'landing/LandingScene.tsx', 'landing/public/PublicLandingScreen.tsx', 'landing/public/PublicLanding.tsx', 'landing/public/WebLandingGate.tsx', 'landing/public/ConsentPlacement.tsx', 'shell/ConsentNotice.tsx', 'screens/LandingAuthDialog.tsx', 'screens/PasswordResetSheet.tsx'],
    reach: ['landing:front', 'landing:sign-in', 'landing:password-reset', 'landing:consent', 'landing:guide', 'landing:legal'],
    group: 'G13',
  },
  { id: 'loading', what: 'Yükleme ekranı', files: ['shell/LoadingScreen.tsx'], reach: ['landing:loading'], group: 'G13', unreached: ['galaksi yükleme örtüsü (tarama / harita / yükseltme)'] },
  {
    id: 'training',
    what: 'Hesap öncesi eğitim: prolog, el kitabı, uçuş okulu, kayıt',
    files: ['onboarding/TrainingDoor.tsx', 'onboarding/prologue/Prologue.tsx', 'onboarding/prologue/ShipScene.tsx', 'onboarding/prologue/Handbook.tsx', 'onboarding/flightSchool/FlightSchool.tsx', 'onboarding/flightSchool/SchoolCamera.tsx', 'onboarding/flightSchool/SchoolCoach.tsx', 'onboarding/flightSchool/SchoolHighlight.tsx', 'onboarding/flightSchool/SchoolLookHint.tsx', 'onboarding/flightSchool/SchoolPointer.tsx', 'onboarding/ClaimDialog.tsx', 'onboarding/Gate.tsx', 'onboarding/TutorialHand.tsx'],
    reach: ['training:prologue', 'training:handbook', 'training:flight-school', 'training:claim', 'client:school-replay'],
    group: 'G15',
  },
  {
    id: 'starter',
    what: 'Başlangıç galaksisi: gemi, onarım, sandık, kalkış, rehber; galaksideki evren çipi ve ana galaksi satırı, menüdeki kalkış panosu ve gemi günlüğü',
    files: ['starter/ArrivalHost.tsx', 'starter/VesselScreen.tsx', 'starter/YardDeck.tsx', 'starter/CrateBay.tsx', 'starter/LandingChoice.tsx', 'starter/MigrationPanel.tsx', 'starter/RepairCard.tsx', 'starter/RepairSlots.tsx', 'starter/ShipHero.tsx', 'starter/SystemTabs.tsx', 'starter/UnlockMoment.tsx', 'starter/OutpostOutcome.tsx', 'starter/JumpCall.tsx', 'starter/ObjectiveLine.tsx', 'starter/tutorial/AwayChip.tsx', 'starter/tutorial/DragHint.tsx', 'starter/tutorial/PinchHint.tsx', 'starter/tutorial/StarterAftercare.tsx', 'starter/tutorial/StarterTutorialCoach.tsx', 'starter/tutorial/StarterWaitLine.tsx', 'starter/tutorial/visualGoal.tsx',
      // Drawn in the galaxy and the menu, but only aboard the colony ship: redesigned with the journey, last (owner 2026-11-13).
      'starter/UniverseChip.tsx', 'starter/MainGalaxyRow.tsx', 'starter/DepartureBoard.tsx', 'starter/ShipLog.tsx'],
    reach: ['starter:arrival', 'starter:vessel', 'starter:repair', 'starter:crate', 'starter:tutorial', 'starter:jump', 'starter:drive'],
    group: 'G15',
  },
  { id: 'faults', what: 'Bakım, güncelleme zorunlu, çökme ekranı', files: ['shell/MaintenanceScreen.tsx', 'shell/UpdateRequired.tsx', 'shell/ErrorBoundary.tsx'], reach: ['special:maintenance-flag', 'special:update-required', 'special:render-error'], group: 'G13' },

  // The commander-ship arena.
  {
    id: 'arena',
    what: 'Komutan gemisi arenası: hangar, takım, maç HUD, kontroller',
    files: ['arena/ArenaGate.tsx', 'arena/Sandbox.tsx', 'arena/Hud.tsx', 'arena/Controls.tsx', 'arena/PingWheel.tsx', 'arena/MapSheet.tsx', 'arena/LoopLine.tsx', 'arena/ModePicker.tsx', 'arena/GraphicsPicker.tsx', 'arena/SpectatorPanel.tsx', 'arena/ClassPicker.tsx', 'arena/Hangar.tsx', 'arena/credits.tsx', 'arena/TeamPanel.tsx', 'arena/hangar/HangarPanel.tsx', 'arena/hangar/HangarStage.tsx', 'arena/hangar/ShipDesk.tsx'],
    reach: ['gallery:arena-hangar', 'gallery:arena-team', 'arena:sandbox', 'arena:match'],
    group: 'G12', unreached: ['ping çarkı', "harita sheet'i", 'izleyici paneli'],
  },
];

/**
 * The game kit (direction B, `apps/web/src/game-ui`), measured as a surface of its own
 * (owner 2026-11-12): `run --kit` writes to `out/ui-audit/kit-<date>`, so its numbers
 * never mix into the game's totals. Its parts enter the game screens in stage 4.
 */
export const KIT_SURFACES: Surface[] = [
  {
    id: 'kit',
    what: 'Oyun arayüzü kiti: katalog ve örnek ekranlar (gönderme, üs, HUD, liste, rapor)',
    files: [],
    reach: ['gallery:ui-kit', 'gallery:ui-kit-launch', 'gallery:ui-kit-base', 'gallery:ui-kit-hud', 'gallery:ui-kit-list', 'gallery:ui-kit-report'],
  },
];

export const OUT_OF_SCOPE: Record<string, string> = {
  'screens/AdminPanel.tsx': 'admin: players never see it (owner, 2026-11-11)',
  'screens/AdminContentReports.tsx': 'admin: players never see it (owner, 2026-11-11)',
  'screens/AdminDeletionQueue.tsx': 'admin: players never see it (owner, 2026-11-11)',
  'screens/AdminPlayersPanel.tsx': 'admin: players never see it (owner, 2026-11-11)',
  'screens/AdminReportMedia.tsx': 'admin: players never see it (owner, 2026-11-11)',
  'screens/AdminShopierQueue.tsx': 'admin: players never see it (owner, 2026-11-11)',
  'screens/AdminStarterPanel.tsx': 'admin: players never see it (owner, 2026-11-11)',
  'screens/AnalyticsAdminPanel.tsx': 'admin: players never see it (owner, 2026-11-11)',
  'onboarding/Academy.tsx': 'unreachable: nothing imports it (pre-existing dead code, reported to the owner)',
  'onboarding/Rehearsal.tsx': 'unreachable: nothing imports it (pre-existing dead code, reported to the owner)',
  'onboarding/BeatCard.tsx': 'unreachable: only the unreachable Rehearsal imports it',
  'shell/StatusBar.tsx': 'unreachable: only the unreachable Academy and Rehearsal import it',
  'shell/LocalAlertSync.tsx': 'renders nothing: schedules local alerts',
  'shell/PushDeviceSync.tsx': 'renders nothing: registers the push device',
  'shell/PushOpenRoute.tsx': 'renders nothing: routes an opened push notification',
  'starter/StarterPreview.tsx': 'developer preview of the starter sky behind ?starterPreview=1, not a player surface',
};

/** Gallery views that are not player surfaces. */
export const GALLERY_OUT_OF_SCOPE: Record<string, string> = {
  admin: 'admin: players never see it (owner, 2026-11-11)',
  'ui-kit-standard': "the standard's open decisions laid out for the owner, no player UI",
  'planet-models': '3D model review sheet for developers, no player UI',
  'monument-models': '3D model review sheet for developers, no player UI',
  'ufo-probe-flight': '3D flight review for developers, no player UI',
  'cosmetic-fleet': '3D fleet cosmetic review, no player UI',
  'cosmetic-fleet-titan': '3D fleet cosmetic review, no player UI',
  'ship-skin-fleet': '3D ship skin review, no player UI',
  'commander-presence': '3D commander-ship presence review, no player UI',
  'fleet-towing': '3D fleet towing review, no player UI',
  'planet-selection': '3D planet selection review, no player UI',
  'premium-space': '3D art review of the galaxy canvas, no player UI',
  'planet-card': 'asset render for tools/planet-cards.mjs on a transparent page, no player UI',
  'cosmetic-fleet:*': '3D fleet cosmetic review per engine and flag, no player UI',
  'cosmetic-card:*': 'asset render for the shop card pictures, measured inside the shop surface',
  'skin-card:*': 'asset render for the planet skin pictures, measured inside the shop surface',
};
