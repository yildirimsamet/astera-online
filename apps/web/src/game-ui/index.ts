/**
 * THE GAME KIT (direction B, owner 2026-11-11). Materials in `game-ui.css`, colours in
 * `tokens.css`; every part here is built to sit beside every other one, so a screen
 * is only a composition of them. Gallery: `v2-gallery.html?view=ui-kit`.
 */
export { Chip, GameButton, GameHold, RoundButton, type ButtonTone, type GameButtonProps, type GameHoldProps } from './buttons.js';
export { BottomNav, GameTabs, InfoPeek, Lever, Slider, TextField, Toggle, type LeverOption, type NavItem, type TabItem } from './controls.js';
export { ART_ICONS, ART_SIZES, ArtIcon, DOCK_ART, artIconSrc, type ArtIconId, type ArtSize } from './art.js';
export { GLYPH_IDS, Glyph, type GlyphId } from './icons.js';
export {
  CargoBar, CountBadge, Dot, Emblem, LevelBadge, ListRow, LockBadge, MultiplierBadge, ProgressBar, RangeBars, ResourceHud, SpendBar,
  StatPlaque, StatusChip, Timer, type BarTone, type HudResource, type StatTone, type StatusTone,
} from './readouts.js';
export { Banner, CoachMark, CutPlate, Dialog, EmptyState, Plate, SectionTag, SheetFrame, Well } from './surfaces.js';
export { CLAN_LEVEL_ART, ClanEmblem, ClanLevelBadge, FLAG_IDS, HONOR_ART, HonorBadge, flagTileSrc, type FlagId } from './ranks.js';
export { POD_ART, POD_OPEN_MS, RewardPod, type RewardPodProps } from './RewardPod.js';
export { UnitBay, UnitCard, type UnitCardProps } from './UnitCard.js';
