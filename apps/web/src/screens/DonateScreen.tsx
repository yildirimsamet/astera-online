import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Note, Section } from '../ui/kit/index.js';
import { CheckIcon, CopyIcon } from '../ui/icons/index.js';
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
 * Two ways to give, because they suit different people: an address to copy for
 * anyone already holding crypto, and the Shopier cards for anyone who is not. A
 * card with no address yet is DISABLED on purpose — a live-looking button that
 * does nothing when pressed is worse than one that says it is not ready.
 */

const CRYPTO = [
  { id: 'trc20', labelKey: 'cryptoTrc20', address: 'TPDV6p6QctXvL7nwiW7AMkPzqNqkrG2kGS' },
  { id: 'solana', labelKey: 'cryptoSolana', address: '3z84BrV8nzzbZkGuDmWczjn6vd6Z1tKis9PHimZSae9J' },
] as const;

export interface SupportCard {
  /** Turkish lira, and the only place the figure is written rather than drawn. */
  readonly amount: number;
  readonly art: string;
  /** The payment page. `null` until there is one; see `SupportCardButton`. */
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
 * `href` IS THE WHOLE SWITCH. It is `null` because the payment links do not exist
 * yet; filling one in turns that card into a real link with no other edit, and a
 * card without one is not pressable at all. That is this screen's oldest rule and
 * the reason the retired `$1/$5/$10/$20` row was disabled too: a live-looking
 * button that does nothing when pressed is worse than one that says it is not
 * ready.
 */
export const SUPPORT_CARDS: readonly SupportCard[] = [
  { amount: 49, art: '/assets/images/general/49-tl-destek.png', href: null },
  { amount: 99, art: '/assets/images/general/99-tl-destek.png', href: null },
  { amount: 199, art: '/assets/images/general/199-tl-destek.png', href: null },
  { amount: 499, art: '/assets/images/general/499-tl-destek.png', href: null },
];

export function DonateScreen({ cards = SUPPORT_CARDS }: { cards?: readonly SupportCard[] } = {}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-6 pb-6 pt-3">
      {/*
        One block, tight gaps: four paragraphs that are one argument, not four
        notices. The appeal is the only line in `text-bone` — it is the sentence
        the whole sheet exists to say, and the rest is the case for it.
      */}
      <div className="flex flex-col gap-2">
        <p className="text-body leading-relaxed text-bone">{t('community.donate.intro')}</p>
        <p className="text-body leading-relaxed text-dim">{t('community.donate.costs')}</p>
        <p className="text-body leading-relaxed text-bone">{t('community.donate.appeal')}</p>
        <p className="text-body leading-relaxed text-dim">{t('community.donate.impact')}</p>
      </div>

      <p className="text-body leading-relaxed text-bone">{t('community.donate.supportLead')}</p>

      <Section label={t('community.donate.cryptoHeading')}>
        <div className="flex flex-col gap-2">
          {CRYPTO.map((row) => (
            <AddressRow key={row.id} label={t(`community.donate.${row.labelKey}`)} address={row.address} />
          ))}
        </div>
      </Section>

      {/*
        FOUR ACROSS, AND SMALL. Owner report: two columns drew them "kocaman".

        The art is almost entirely frame and one large numeral, so it survives
        being small far better than a photograph would — at a quarter of a 350px
        sheet each card is about seventy-five pixels wide and the figure still
        reads. Four across also states the choice as ONE row of options rather
        than a two-by-two block that dominates the sheet it is asking from.
      */}
      <Section label={t('community.donate.cardHeading')}>
        <div className="grid grid-cols-4 gap-1.5">
          {cards.map((card) => (
            <SupportCardButton key={card.amount} card={card} />
          ))}
        </div>
        <Note>{t('community.donate.cardNote')}</Note>
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
    <div className="plate flex flex-col gap-2 p-3">
      <p className="legend">{label}</p>
      <p className="selectable break-all text-label leading-relaxed text-bone">{address}</p>
      {/*
        THE PRESS ANSWERS, VISIBLY. Owner instruction.

        Three things move at once — the glyph becomes a tick, the slab takes the
        affirmative weight, and the word changes — because a button whose only
        change is one word is a button a player pressing it on a phone, with a
        thumb over the label, cannot tell they have pressed. The accessible name
        changes with them, so the confirmation is not a sighted-only fact.
      */}
      <Button
        size="md"
        full
        variant={copied ? 'primary' : 'default'}
        icon={copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
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
 * not ready. The art is dimmed rather than hidden, because a player has to be
 * able to see what is coming; `Note` under the grid says why.
 */
function SupportCardButton({ card }: { card: SupportCard }) {
  const { t } = useTranslation();
  const label = t('community.donate.cardLabel', { amount: card.amount });
  const art = (
    <img
      src={card.art}
      alt={label}
      loading="lazy"
      className="h-auto w-full object-contain"
    />
  );

  /*
    FULL BRIGHTNESS EITHER WAY. Owner instruction: *"opacity verme, aydınlık parlak
    olsun."* The card is lit artwork and dimming it made the one hopeful thing on
    the sheet look switched off. Readiness is carried by the `Note` under the grid
    and by the press simply not being offered — never by greying out the art.
  */
  if (card.href === null) {
    return (
      <button type="button" disabled aria-label={label} className="rounded-chip">
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
      className="rounded-chip transition-transform active:scale-[0.97]"
      onClick={() => { haptic('tap'); }}
    >
      {art}
    </a>
  );
}
