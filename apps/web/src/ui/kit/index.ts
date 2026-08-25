/**
 * THE KIT.
 *
 * Everything the interface is built from. Three material words — plate, slab, socket
 * (`styles/chrome.css`) — and a small set of components that use them consistently.
 *
 * Import from here, not from the individual files: the single entry point is what
 * stops a fourteenth bespoke card style appearing the next time a screen needs
 * something slightly different.
 */

export { Plate, type PlateTone } from './Plate.js';
export { Button, IconButton, type ButtonVariant, type ButtonSize } from './Button.js';
export { Meter, Progress, Bars } from './Meter.js';
export { ArtWell, type WellTone } from './ArtWell.js';
export { ResourcePill } from './ResourcePill.js';
export { Readout, Stat, type ReadoutSize } from './Readout.js';
export { PriceTag, Amount } from './PriceTag.js';
export { SectionHead, Section, Chip, EmptyState, Skeleton, SkeletonText, Waiting, Note, Unreachable, type ChipTone } from './Surface.js';
export { GradeStamp, wentYourWay } from './GradeStamp.js';
export { Sheet } from './Sheet.js';
export { Segmented, type Segment } from './Segmented.js';
export { useCountUp, useJump } from './useCountUp.js';
export { useOwnPress } from './useOwnPress.js';
