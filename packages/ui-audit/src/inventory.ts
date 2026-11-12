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

export const LISTED_DIRECTORIES = ['screens', 'shell', 'v2/hud', 'v2/shell', 'starter', 'onboarding', 'arena', 'landing', 'wiki', 'battle-simulator', 'legacy'];

export const SURFACES: Surface[] = [
  // The galaxy and the HUD around it.
  {
    id: 'galaxy-hud',
    what: 'Galaksi ana ekranı ve HUD: üst bar, iş satırı, dock, köşeler, sinyaller',
    files: ['screens/GalaxyView.tsx', 'v2/shell/GameShell.tsx', 'v2/shell/HudTop.tsx', 'v2/shell/HudDock.tsx', 'v2/hud/TopBar.tsx', 'v2/hud/WorksLine.tsx', 'v2/hud/Dock.tsx', 'v2/hud/GalaxyCorners.tsx', 'v2/hud/ContextSlot.tsx', 'v2/hud/BaseSwitch.tsx', 'shell/Signals.tsx', 'shell/PendingStrip.tsx', 'screens/UnknownSignalHud.tsx', 'starter/UniverseChip.tsx', 'starter/MainGalaxyRow.tsx'],
    reach: ['gallery:store-discovery', 'client:galaxy-new', 'client:galaxy-mid', 'client:galaxy-late'],
  },
  { id: 'cosmetic-trial', what: 'Kozmetik deneme şeridi, galaksi üzerinde', files: ['screens/CosmeticTrialBar.tsx'], reach: ['gallery:cosmetic-trial'] },
  { id: 'now-line', what: 'Şimdi satırı ve zamanlayıcılar', files: ['v2/hud/NowLine.tsx'], reach: ['gallery:timers'] },
  { id: 'outline', what: 'Üs ve filo özeti katmanı', files: ['v2/hud/Outline.tsx', 'v2/shell/OutlineHost.tsx'], reach: ['client:outline'] },
  { id: 'fleet', what: 'Filo sayfası: havada, evde, oda', files: ['v2/hud/FleetPage.tsx', 'v2/shell/FleetHost.tsx'], reach: ['gallery:fleet', 'gallery:fleet-home', 'gallery:fleet-room', 'gallery:support-fleet'] },
  { id: 'bell', what: 'Zil: olay listesi', files: ['v2/hud/BellSheet.tsx', 'v2/shell/BellHost.tsx'], reach: ['gallery:bell'] },
  { id: 'chronicle', what: 'Kronik: galaksi geçmişi', files: ['screens/ChronicleScreen.tsx'], reach: ['client:chronicle'] },
  { id: 'away', what: 'Yokken olanlar özeti', files: ['v2/hud/AwaySheet.tsx', 'v2/shell/AwayHost.tsx'], reach: ['gallery:away'] },
  { id: 'view-sheet', what: 'Görünüm ayarları sayfası', files: ['v2/hud/ViewSheet.tsx'], reach: ['gallery:view'] },
  { id: 'queue', what: 'İnşa ve tersane kuyruğu', files: [], reach: ['gallery:queue'] },
  { id: 'peek', what: 'Gezegene hızlı bakış', files: [], reach: ['gallery:peek'] },
  { id: 'silent-space', what: 'Sessiz Uzay dönüş bildirimi (panel return)', files: ['shell/SilentSpaceNotice.tsx'], reach: ['client:return'] },
  { id: 'worlds', what: 'Dünyalar paneli', files: ['screens/WorldsPanel.tsx'], reach: ['client:worlds'] },
  { id: 'events-guide', what: 'Galaksi olayları rehberi', files: ['screens/GalaxyEventsGuide.tsx'], reach: ['client:events-guide'] },
  { id: 'unknown-signal', what: 'Bilinmeyen sinyal sayfası', files: ['screens/UnknownSignalSheet.tsx'], reach: ['client:unknown-signal'] },

  // Reading a target and acting on it.
  {
    id: 'focus',
    what: 'Odak paneli: hedef dosyası, iplik, radyasyon, bant, anıt',
    files: ['v2/hud/TargetDossier.tsx', 'starter/OutpostReading.tsx', 'starter/PartHere.tsx', 'screens/RadiationBombControls.tsx'],
    reach: ['gallery:focus-radiation', 'gallery:focus-band', 'gallery:focus-monument', 'gallery:focus-thread', 'gallery:focus-thread-pirate', 'gallery:support-focus', 'client:focus'],
  },
  { id: 'launch', what: 'Saldırı/gönderme sayfası', files: ['screens/LaunchSheet.tsx', 'starter/TempoNote.tsx'], reach: ['gallery:launch', 'gallery:launch-pirate', 'gallery:launch-radiation', 'gallery:launch-radiation-lethal', 'gallery:support-launch'] },
  { id: 'transfer', what: 'Kaynak/filo aktarımı', files: ['screens/TransferSheet.tsx'], reach: ['gallery:transfer', 'gallery:transfer-radiation'] },
  { id: 'convoy', what: 'Galaksiler arası konvoy', files: ['screens/IntergalacticConvoySheet.tsx'], reach: ['gallery:convoy'] },
  { id: 'trade', what: 'Ticaret', files: ['screens/TradeSheet.tsx'], reach: ['gallery:trade'] },
  { id: 'settlement', what: 'Koloni kurma ve sahiplenme', files: ['screens/SettlementSheet.tsx'], reach: ['gallery:settlement', 'gallery:settlement-priority', 'gallery:claim-mine', 'gallery:claim-other'] },
  { id: 'strike', what: 'Stratejik saldırı ve raporu', files: [], reach: ['gallery:strike', 'gallery:report-strike-colony'] },
  { id: 'monument', what: 'Anıt sayfası, rota ve savaş kuralları', files: ['screens/MonumentSheet.tsx', 'screens/MonumentRoutePreview.tsx', 'screens/MonumentBattleRules.tsx'], reach: ['client:monument'] },

  // The planet and what is built on it.
  {
    id: 'planet',
    what: 'Gezegen sayfası: filo, üretim, onarım, stratejik, arıza, klan destek bölmesi',
    files: ['screens/PlanetScreen.tsx', 'v2/shell/BaseQueues.tsx', 'screens/RepairStation.tsx', 'screens/FaultSheet.tsx', 'screens/faultScope.tsx', 'screens/ColonyAbandonment.tsx', 'screens/ClanSupportBay.tsx'],
    reach: ['gallery:base-fleet', 'gallery:base-production', 'gallery:base-fleet-empty', 'gallery:repair-station', 'gallery:repair-station-empty', 'gallery:strategic-forge', 'gallery:strategic-battery', 'gallery:support-hangar', 'gallery:support-hangar-escape', 'gallery:support-hangar-locked', 'gallery:support-hangar-hold', 'gallery:support-hangar-both', 'gallery:support-hangar-alarm', 'client:planet-colony'],
  },
  { id: 'research', what: 'Araştırma takımyıldızı', files: ['screens/ResearchPanel.tsx', 'v2/hud/ResearchConstellation.tsx'], reach: ['gallery:base-research'] },

  // Intelligence and reports.
  { id: 'intel', what: 'İstihbarat merkezi', files: ['screens/IntelScreen.tsx'], reach: ['gallery:intel'] },
  {
    id: 'reports',
    what: 'Savaş raporları ve anıt raporu',
    files: ['screens/BattleReports.tsx', 'v2/hud/ReportScene.tsx', 'screens/MonumentReportSheet.tsx', 'battle-simulator/BattleReplayAction.tsx'],
    reach: ['gallery:report', 'gallery:report-defend', 'gallery:support-report', 'gallery:support-report-supporter'],
  },
  { id: 'battle-replay', what: 'Savaş tekrarı', files: ['battle-simulator/BattleReplay.tsx', 'battle-simulator/BattleReplayDialog.tsx', 'battle-simulator/BattleStage.tsx', 'battle-simulator/RetreatRoster.tsx', 'battle-simulator/UnitInspector.tsx'], reach: ['client:battle-replay'] },
  {
    id: 'simulator',
    what: 'Savaş simülatörü',
    files: ['battle-simulator/BattleSimulator.tsx', 'battle-simulator/SimulatorDialog.tsx', 'battle-simulator/SimulatorHost.tsx', 'battle-simulator/SideEditor.tsx', 'battle-simulator/SimulationNumberInput.tsx', 'battle-simulator/BattleBalance.tsx'],
    reach: ['simulator', 'client:simulator'],
  },

  // Clan.
  {
    id: 'clan',
    what: 'Klan: genel, güç, üyeler, yardım, savaş, dalga',
    files: ['screens/ClanScreen.tsx', 'screens/ClanWarPanel.tsx', 'screens/ClanBanner.tsx', 'screens/ClanDonateSheet.tsx', 'screens/ClanWaveSheet.tsx', 'screens/CommunityPolicy.tsx'],
    reach: ['gallery:clan', 'gallery:clan-strength', 'gallery:clan-members', 'gallery:clan-aid', 'gallery:clan-war', 'gallery:wave', 'gallery:wave-critical', 'gallery:support-banner', 'gallery:support-banner-gold'],
  },
  { id: 'clan-support', what: 'Klan savunma desteği', files: ['screens/ClanSupportSheet.tsx'], reach: ['gallery:support-sheet', 'gallery:support-sheet-alarm', 'gallery:support-clanmate', 'gallery:support-clanmate-closed'] },
  {
    id: 'chat',
    what: 'Sohbet, medya, tepkiler, engelleme, şikâyet',
    files: ['screens/ChatScreen.tsx', 'v2/shell/ChatHost.tsx', 'screens/ChatMediaAttachment.tsx', 'screens/ChatMediaComposer.tsx', 'screens/ChatReactionRoster.tsx', 'screens/CommunityBlocks.tsx', 'screens/ContentReportSheet.tsx'],
    reach: ['gallery:support-chat', 'client:chat', 'client:chat-rules'],
  },

  // Menu, commander and meta.
  { id: 'menu', what: 'Menü, mağaza vitrini, kalkış panosu, gemi günlüğü', files: ['shell/MenuPanel.tsx', 'shell/ShopShowcase.tsx', 'shell/ShopShowcasePoster.tsx', 'starter/DepartureBoard.tsx', 'starter/ShipLog.tsx'], reach: ['gallery:menu', 'client:menu'] },
  { id: 'notifications', what: 'Bildirim Merkezi', files: ['screens/NotificationCenterSheet.tsx'], reach: ['gallery:notification-center', 'gallery:notification-center-new', 'gallery:notification-center-late'] },
  { id: 'leaderboard', what: 'Sıralama ve sezon arşivi', files: ['screens/LeaderboardScreen.tsx', 'screens/SeasonArchiveScreen.tsx'], reach: ['gallery:leaderboard', 'gallery:leaderboard-archive'] },
  { id: 'rewards', what: 'Ödüller', files: ['screens/RewardsScreen.tsx'], reach: ['gallery:rewards', 'gallery:rewards-ready', 'gallery:rewards-complete', 'gallery:rewards-empty', 'client:rewards'] },
  { id: 'announcements', what: 'Duyurular', files: ['screens/AnnouncementsScreen.tsx'], reach: ['client:announcements'] },
  { id: 'feedback', what: 'Geri bildirim formu', files: ['screens/FeedbackScreen.tsx'], reach: ['client:feedback'] },
  { id: 'donate', what: 'Bağış', files: ['screens/DonateScreen.tsx'], reach: ['gallery:donate'] },
  {
    id: 'shop',
    what: 'Mağaza: kaplamalar, önizleme, koleksiyon, ödeme',
    files: ['screens/SkinsScreen.tsx', 'screens/SkinPreview.tsx', 'screens/CosmeticCollection.tsx', 'screens/CosmeticNavigation.tsx', 'screens/CosmeticPreview.tsx', 'screens/ShipSkinDrive.tsx', 'screens/ShopierCheckout.tsx'],
    reach: ['gallery:skin-shop', 'gallery:skin-shop-live'],
  },
  { id: 'inventory', what: 'Envanter: sahip olunan kaplamalar', files: ['screens/SkinInventoryScreen.tsx'], reach: ['gallery:skin-inventory', 'gallery:skin-inventory-empty', 'gallery:ship-skin-inventory'] },
  { id: 'wiki-sheet', what: 'Oyun içi Wiki', files: ['screens/WikiScreen.tsx', 'wiki/WikiContent.tsx'], reach: ['gallery:wiki'] },
  { id: 'wiki-public', what: 'Yayınlanan Wiki sayfaları', files: ['wiki/publication.tsx'], reach: ['wiki:index', 'wiki:article'] },
  {
    id: 'profile',
    what: 'Profil: komutan kartı, ülke, tatil, hesap güvenliği ve silme',
    files: ['shell/ProfileHost.tsx', 'shell/ProfilePage.tsx', 'v2/shell/CommanderHost.tsx', 'v2/hud/CommanderCard.tsx', 'screens/VacationSheet.tsx', 'screens/AccountSecuritySheet.tsx', 'screens/AccountDeletionSheet.tsx', 'screens/securityFields.tsx'],
    reach: ['gallery:country-picker', 'client:profile'],
  },
  {
    id: 'legacy',
    what: 'Komutan Mirası: ödül, raf, açılış, profil',
    files: ['legacy/AwardReveal.tsx', 'legacy/AwardScene.tsx', 'legacy/AwardSheet.tsx', 'legacy/AwardStage.tsx', 'legacy/AwardTile.tsx', 'legacy/LegacyPeek.tsx', 'legacy/LegacyProfile.tsx', 'legacy/ShowcaseEditor.tsx', 'legacy/ShowcaseShelf.tsx'],
    reach: ['gallery:legacy-award', 'gallery:legacy-shelf', 'gallery:legacy-shelf-new', 'gallery:legacy-shelf-b', 'gallery:legacy-shelf-c', 'gallery:legacy-reveal', 'gallery:legacy-peek', 'gallery:legacy-profile'],
  },
  { id: 'season-recap', what: 'Sezon özeti', files: ['screens/SeasonRecap.tsx'], reach: ['client:recap'] },
  { id: 'servers', what: 'Galaksi seçimi', files: ['screens/ServersScreen.tsx'], reach: ['client:servers'] },

  // Before the game: front door, training, loading, faults.
  {
    id: 'landing',
    what: 'Ön kapı, giriş/kayıt, şifre sıfırlama, çerez izni',
    files: ['screens/LandingScreen.tsx', 'landing/LandingScene.tsx', 'landing/public/PublicLandingScreen.tsx', 'landing/public/PublicLanding.tsx', 'landing/public/WebLandingGate.tsx', 'landing/public/ConsentPlacement.tsx', 'shell/ConsentNotice.tsx', 'screens/LandingAuthDialog.tsx', 'screens/PasswordResetSheet.tsx'],
    reach: ['landing:front', 'landing:sign-in', 'landing:password-reset', 'landing:consent', 'landing:guide', 'landing:legal'],
  },
  { id: 'loading', what: 'Yükleme ekranı', files: ['shell/LoadingScreen.tsx'], reach: ['landing:loading'] },
  {
    id: 'training',
    what: 'Hesap öncesi eğitim: prolog, el kitabı, uçuş okulu, kayıt',
    files: ['onboarding/TrainingDoor.tsx', 'onboarding/prologue/Prologue.tsx', 'onboarding/prologue/ShipScene.tsx', 'onboarding/prologue/Handbook.tsx', 'onboarding/flightSchool/FlightSchool.tsx', 'onboarding/flightSchool/SchoolCamera.tsx', 'onboarding/flightSchool/SchoolCoach.tsx', 'onboarding/flightSchool/SchoolHighlight.tsx', 'onboarding/flightSchool/SchoolLookHint.tsx', 'onboarding/flightSchool/SchoolPointer.tsx', 'onboarding/ClaimDialog.tsx', 'onboarding/Gate.tsx', 'onboarding/TutorialHand.tsx'],
    reach: ['training:prologue', 'training:handbook', 'training:flight-school', 'training:claim', 'client:school-replay'],
  },
  {
    id: 'starter',
    what: 'Başlangıç galaksisi: gemi, onarım, sandık, kalkış, rehber',
    files: ['starter/ArrivalHost.tsx', 'starter/VesselScreen.tsx', 'starter/YardDeck.tsx', 'starter/CrateBay.tsx', 'starter/LandingChoice.tsx', 'starter/MigrationPanel.tsx', 'starter/RepairCard.tsx', 'starter/RepairSlots.tsx', 'starter/ShipHero.tsx', 'starter/SystemTabs.tsx', 'starter/UnlockMoment.tsx', 'starter/OutpostOutcome.tsx', 'starter/JumpCall.tsx', 'starter/ObjectiveLine.tsx', 'starter/tutorial/AwayChip.tsx', 'starter/tutorial/DragHint.tsx', 'starter/tutorial/PinchHint.tsx', 'starter/tutorial/StarterAftercare.tsx', 'starter/tutorial/StarterTutorialCoach.tsx', 'starter/tutorial/StarterWaitLine.tsx', 'starter/tutorial/visualGoal.tsx'],
    reach: ['starter:arrival', 'starter:vessel', 'starter:repair', 'starter:crate', 'starter:tutorial', 'starter:jump', 'starter:drive'],
  },
  { id: 'faults', what: 'Bakım, güncelleme zorunlu, çökme ekranı', files: ['shell/MaintenanceScreen.tsx', 'shell/UpdateRequired.tsx', 'shell/ErrorBoundary.tsx'], reach: ['special:maintenance-flag', 'special:update-required', 'special:render-error'] },

  // The commander-ship arena.
  {
    id: 'arena',
    what: 'Komutan gemisi arenası: hangar, takım, maç HUD, kontroller',
    files: ['arena/ArenaGate.tsx', 'arena/Sandbox.tsx', 'arena/Hud.tsx', 'arena/Controls.tsx', 'arena/PingWheel.tsx', 'arena/MapSheet.tsx', 'arena/LoopLine.tsx', 'arena/ModePicker.tsx', 'arena/GraphicsPicker.tsx', 'arena/SpectatorPanel.tsx', 'arena/ClassPicker.tsx', 'arena/Hangar.tsx', 'arena/credits.tsx', 'arena/TeamPanel.tsx', 'arena/hangar/HangarPanel.tsx', 'arena/hangar/HangarStage.tsx', 'arena/hangar/ShipDesk.tsx'],
    reach: ['gallery:arena-hangar', 'gallery:arena-team', 'arena:sandbox', 'arena:match'],
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
