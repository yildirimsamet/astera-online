import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Note, Section } from '../v2/kit/Surface.js';
import { Icon } from '../v2/icons.js';
import { copyText } from '../lib/clipboard.js';
import { haptic } from '../lib/haptics.js';

/**
 * THE ONE SCREEN IN THE GAME WITH NOTHING TO SELL.
 *
 * Everything else in Astera trades something for something: Alloy for a building,
 * a fleet for a world, Dominion for a risk. This sheet trades nothing — no Alloy,
 * no Crystal, no ships, no premium edge, no in-game status — which means the ONLY
 * thing that can carry it is the prose. Four paragraphs, in this order: who funds
 * the game today, what it costs, why it matters now, and where a contribution
 * actually lands. Then the ways to give, then the line that tells a player who
 * gives nothing that they are still welcome.
 *
 * THE PROSE IS THE FEATURE, not decoration around a payment form. If a future edit
 * shortens this to an address and a button, the surface has become a checkout and
 * `community-screens.test.tsx` will say so.
 *
 * Two ways to give, the cards first (owner 2026-09-27, the Shopier pages are live): a
 * card needs nothing but a tap, a wallet needs a wallet. Drawn in the Gözlemevi language.
 */

const CRYPTO = [
  { id: 'trc20', labelKey: 'cryptoTrc20', address: 'TPDV6p6QctXvL7nwiW7AMkPzqNqkrG2kGS' },
  { id: 'solana', labelKey: 'cryptoSolana', address: '3z84BrV8nzzbZkGuDmWczjn6vd6Z1tKis9PHimZSae9J' },
] as const;

export interface SupportCard {
  /** Turkish lira, and the only place the figure is written rather than drawn. */
  readonly amount: number;
  readonly art: string;
  /** The payment page. `null` while there is none; see `SupportCardButton`. */
  readonly href: string | null;
}

/**
 * THE CARD ART IS THE BUTTON. Owner instruction, with the four PNGs handed over
 * as the controls themselves rather than as decoration beside them.
 *
 * Each card already draws its amount and its own "DESTEK OL", so neither is
 * written a second time anywhere — the house rule is that a fact which is DRAWN
 * is not also written. The only string these owe is the accessible name, because
 * the amount exists solely as pixels.
 *
 * `href` IS THE WHOLE SWITCH: a card with one is a link to its Shopier page, a card
 * without one is not pressable at all — a live-looking button that does nothing when
 * pressed is worse than one that says it is not ready.
 */
export const SUPPORT_CARDS: readonly SupportCard[] = [
  { amount: 49, art: '/assets/images/general/49-tl-destek.png', href: 'https://www.shopier.com/asteraonline/51278327' },
  { amount: 99, art: '/assets/images/general/99-tl-destek.png', href: 'https://www.shopier.com/asteraonline/51278343' },
  { amount: 199, art: '/assets/images/general/199-tl-destek.png', href: 'https://www.shopier.com/asteraonline/51278354' },
  { amount: 499, art: '/assets/images/general/499-tl-destek.png', href: 'https://www.shopier.com/asteraonline/51278360' },
];

export function DonateScreen({ cards = SUPPORT_CARDS }: { cards?: readonly SupportCard[] } = {}) {
  const { t } = useTranslation();

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5 px-1 pb-6 pt-2 font-v2-ui">
      {/*
        One block, tight gaps: four paragraphs that are one argument, not four notices.
        The appeal is the sentence the whole sheet exists to say, so it alone is set in
        full ink and weight; the case around it is the second ink.
      */}
      <div className="flex flex-col gap-2.5 text-body leading-relaxed">
        <p className="text-v2-ink">{t('community.donate.intro')}</p>
        <p className="text-v2-ink-2">{t('community.donate.costs')}</p>
        <p className="font-semibold text-v2-ink">{t('community.donate.appeal')}</p>
        <p className="text-v2-ink-2">{t('community.donate.impact')}</p>
      </div>

      <p className="text-caption font-semibold text-v2-ink">{t('community.donate.supportLead')}</p>

      {/*
        FOUR ACROSS, AND SMALL. Owner report: two columns drew them "kocaman". The art is
        almost entirely frame and one large numeral, so it survives being small — at a
        quarter of a 350px sheet each card is about seventy-five pixels wide and the figure
        still reads — and one row states the choice as four options, not a block.
      */}
      <Section label={t('community.donate.cardHeading')}>
        <div className="grid grid-cols-4 gap-1.5">
          {cards.map((card) => (
            <SupportCardButton key={card.amount} card={card} />
          ))}
        </div>
        <Note>{t('community.donate.cardNote')}</Note>
      </Section>

      <Section label={t('community.donate.cryptoHeading')}>
        <div className="flex flex-col gap-1.5">
          {CRYPTO.map((row) => (
            <AddressRow key={row.id} label={t(`community.donate.${row.labelKey}`)} address={row.address} />
          ))}
        </div>
      </Section>

      <Note>{t('community.donate.noPressure')}</Note>
    </div>
  );
}

/**
 * THE ADDRESS IS THE PRODUCT. THE BUTTON IS A CONVENIENCE.
 *
 * `navigator.clipboard` is not something to depend on here: it needs a secure
 * context, a permission on some browsers, and an in-app webview can refuse it
 * outright — and a donation that silently fails to copy is money that never
 * arrives. So the string itself is the fallback, and it is built to survive the
 * button being useless:
 *
 *   · PRINTED WHOLE. `break-all` wraps mid-string rather than `truncate` hiding
 *     the tail; a player must be able to read the last character to trust it.
 *   · SELECTABLE. `styles.css` turns selection off for the whole game on purpose
 *     (a drag on the disc must not paint a planet name blue), and `.selectable` is
 *     that rule's own escape hatch — it also restores `-webkit-touch-callout`, so
 *     iOS long-press gives back the native Copy menu.
 *
 * One row: the network and the press on one line, the address under them — the copy
 * press no longer takes a full-width line of its own.
 *
 * The accessible name names the NETWORK and the state, because two buttons that
 * both read "Copy" are one button to a screen reader, and a confirmation only the
 * sighted can read is not a confirmation.
 */
function AddressRow({ label, address }: { label: string; address: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The sheet can be closed while the confirmation is still up. Nothing here
  // survives that, so neither should the timer that would write to it.
  useEffect(() => () => {
    if (settle.current !== null) clearTimeout(settle.current);
  }, []);

  return (
    <div className="flex flex-col gap-1.5 rounded-control border border-v2-line bg-v2-panel px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-micro font-semibold uppercase tracking-wide text-v2-ink-2">{label}</p>
        {/*
          THE PRESS ANSWERS, VISIBLY. Owner instruction: the glyph becomes a tick, the
          slab takes your colour, and the word changes — three changes at once, because a
          thumb over the label hides a one-word change. The name changes with them.
        */}
        <Button
          size="sm"
          variant={copied ? 'primary' : 'default'}
          icon={copied ? <Icon id="i-check" className="size-3.5" /> : undefined}
          ariaLabel={
            copied
              ? t('community.donate.copiedLabel', { label })
              : t('community.donate.copyLabel', { label })
          }
          onClick={() => {
            void (async () => {
              // False means every path was refused — an insecure context AND no
              // legacy copy. The address is on screen and selectable, which is the
              // way out; claiming "Copied" over an empty clipboard would send a
              // player away believing they had it.
              if (!(await copyText(address))) return;
              haptic('tap');
              setCopied(true);
              if (settle.current !== null) clearTimeout(settle.current);
              settle.current = setTimeout(() => { setCopied(false); }, 2_000);
            })();
          }}
        >
          {copied ? t('community.donate.copied') : t('community.donate.copy')}
        </Button>
      </div>
      <p className="selectable break-all font-v2-mono text-caption leading-snug text-v2-ink">{address}</p>
    </div>
  );
}

/**
 * ONE CARD, AND WHAT IT IS DEPENDS ENTIRELY ON WHETHER IT HAS SOMEWHERE TO GO.
 *
 * With an address it is an ANCHOR — a payment page is a real destination, so a
 * long-press gets the browser's own menu and the status bar shows where the press
 * leads, which is worth having on the one control in the game that asks for money.
 * `noopener` because it opens a third-party page in a new tab.
 *
 * Without one it is a DISABLED BUTTON: still drawn, still legible, and visibly
 * not ready.
 */
function SupportCardButton({ card }: { card: SupportCard }) {
  const { t } = useTranslation();
  const label = t('community.donate.cardLabel', { amount: card.amount });
  /*
    FULL BRIGHTNESS EITHER WAY. Owner instruction: *"opacity verme, aydınlık parlak
    olsun."* The card is lit artwork and dimming it made the one hopeful thing on
    the sheet look switched off.
  */
  const art = (
    <img
      src={card.art}
      alt={label}
      loading="lazy"
      className="h-auto w-full object-contain"
    />
  );

  if (card.href === null) {
    return (
      <button type="button" disabled aria-label={label} className="rounded-control">
        {art}
      </button>
    );
  }
  return (
    <a
      href={card.href}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={label}
      className="rounded-control transition-transform duration-150 ease-v2 hover:-translate-y-0.5 active:scale-[0.97]"
      onClick={() => { haptic('tap'); }}
    >
      {art}
    </a>
  );
}
