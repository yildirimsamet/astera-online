import type { ClanPerkId } from '@astera/rules';

/**
 * THE CLAN PERKS, AS OBJECTS (F2, owner 2026-11-11): each rung of the banner and each clan event in
 * the chat wears the thing its perk is — the corridor gate, the alarm beacon, the watch bastion,
 * the refinery furnace, the golden banner — so a glance reads which kind of news it is.
 */
const ART: Record<ClanPerkId, string> = {
  CORRIDOR: '/assets/images/clan/perk-corridor.webp',
  ALARM: '/assets/images/clan/perk-alarm.webp',
  STATION: '/assets/images/clan/perk-station.webp',
  REFINERY: '/assets/images/clan/perk-refinery.webp',
  BANNER: '/assets/images/clan/perk-banner.webp',
};

export function PerkArt({ perk, className = 'size-9' }: { perk: ClanPerkId; className?: string }) {
  return <img data-perk-art={perk} src={ART[perk]} alt="" aria-hidden="true" draggable={false}
    className={`shrink-0 object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] ${className}`} />;
}
