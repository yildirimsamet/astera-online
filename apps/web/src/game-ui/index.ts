/**
 * THE GAME KIT (direction B, owner 2026-11-11). Materials in `game-ui.css`, colours in
 * `tokens.css`; every part here is built to sit beside every other one, so a screen
 * is only a composition of them. Gallery: `v2-gallery.html?view=ui-kit`.
 */
import './game-ui.css';
export { Chip, GameButton, GameHold, Medallion, RoundButton, type ButtonTone, type GameButtonProps, type GameHoldProps, type HoldWeight } from './buttons.js';
export {
  BottomNav, Choices, GameTabs, InfoPeek, LANGUAGE_FLAG, LanguagePicker, Lever, SettingLink, Slider, TextField, Toggle, type LeverOption, type NavItem, type TabItem,
} from './controls.js';
export { ART_ICONS, ART_SIZES, ArtIcon, DOCK_ART, artIconSrc, type ArtIconId, type ArtSize } from './art.js';
export { GLYPH_IDS, Glyph, type GlyphId } from './icons.js';
export {
  CargoBar, CostLine, CountBadge, Dot, Emblem, FreeSlot, LevelBadge, ListRow, LockBadge, MultiplierBadge, ProgressBar, QueueSlot, RangeBars, ResourceHud,
  SpendBar, StatPlaque, StatusChip, StoreGauge, Timer, TimerPlate, TimerRow, type BarTone, type HudResource, type SlotState, type StatTone, type StatusTone,
  type TimerTone,
} from './readouts.js';
export { Banner, CoachMark, ContextCard, ContextStrip, CutPlate, Dialog, EmptyState, Plate, SectionTag, SheetFrame, Well } from './surfaces.js';
export { DropGroup, DropPanel, PickRow, Tally, type TallyPaint } from './finder.js';
export { NewsList, NewsRow, type NewsOutcome, type NewsTone } from './news.js';
export { CLAN_LEVEL_ART, ClanEmblem, ClanLevelBadge, FLAG_IDS, HONOR_ART, HonorBadge, flagTileSrc, type FlagId } from './ranks.js';
export { POD_ART, POD_OPEN_MS, RewardPod, type RewardPodProps } from './RewardPod.js';
export { UnitBay, UnitCard, type UnitCardProps } from './UnitCard.js';
