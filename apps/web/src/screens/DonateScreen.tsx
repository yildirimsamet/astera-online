import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GameButton, Glyph, SectionTag } from '../game-ui/index.js';
import { HeartIcon } from '../ui/icons/index.js';
import { copyText } from '../lib/clipboard.js';
import { haptic } from '../lib/haptics.js';
import { OWN_SOUND, playSound } from '../lib/sound.js';
import { capabilities } from '../platform/runtime.js';

/** Support is optional: explain its purpose before payment, with the full developer note one tap deeper. */

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
  return capabilities().webCheckout ? <WebDonateScreen cards={cards} /> : null;
}

function WebDonateScreen({ cards }: { cards: readonly SupportCard[] }) {
  const { t } = useTranslation();

  return (
    <div data-support-page className="gk gk-donate">
      <section className="gk-donate__part">
        <SectionTag as="h3">{t('community.donate.aboutHeading')}</SectionTag>
        <div className="gk-well gk-donate__case">
          <div className="gk-donate__impact">
            <HeartIcon className="gk-donate__heart" />
            <p>{t('community.donate.impact')}</p>
          </div>
          <details className="gk-donate__note">
            <summary {...OWN_SOUND} className="gk-donate__more" onClick={() => { playSound('tab'); haptic('tap'); }}>
              {t('community.donate.developerNote')}<span className="gk-donate__chev"><Glyph id="next" /></span>
            </summary>
            <div className="gk-donate__letter">
              <p>{t('community.donate.intro')}</p>
              <p>{t('community.donate.costs')}</p>
              <p className="gk-donate__appeal">{t('community.donate.appeal')}</p>
            </div>
          </details>
        </div>
      </section>

      {/*
        FOUR ACROSS, AND SMALL. Owner report: two columns drew them "kocaman". The art is
        almost entirely frame and one large numeral, so it survives being small — at a
        quarter of a 350px sheet each card is about seventy-five pixels wide and the figure
        still reads — and one row states the choice as four options, not a block.
      */}
      <section className="gk-donate__part">
        <SectionTag as="h3">{t('community.donate.cardHeading')}</SectionTag>
        <div className="gk-donate__cards">
          {cards.map((card) => (
            <SupportCardButton key={card.amount} card={card} />
          ))}
        </div>
        <p className="gk-note">{t('community.donate.cardNote')}</p>
      </section>

      <section className="gk-donate__part">
        <SectionTag as="h3">{t('community.donate.cryptoHeading')}</SectionTag>
        {CRYPTO.map((row) => (
          <AddressRow key={row.id} label={t(`community.donate.${row.labelKey}`)} address={row.address} />
        ))}
      </section>

      <p className="gk-note">{t('community.donate.noPressure')}</p>
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
    <div className="gk-well gk-donate__wallet">
      <div className="gk-donate__walletline">
        <p className="gk-label">{label}</p>
        {/*
          THE PRESS ANSWERS, VISIBLY. Owner instruction: the glyph becomes a tick, the
          slab takes the action colour, and the word changes — three changes at once,
          because a thumb over the label hides a one-word change. The name changes with them.
        */}
        <GameButton
          size="sm"
          tone={copied ? 'action' : 'steel'}
          glyph={copied ? 'check' : undefined}
          spoken={copied ? t('community.donate.copiedLabel', { label }) : t('community.donate.copyLabel', { label })}
          onPress={() => {
            void (async () => {
              // False means every path was refused — an insecure context AND no
              // legacy copy. The address is on screen and selectable, which is the
              // way out; claiming "Copied" over an empty clipboard would send a
              // player away believing they had it.
              if (!(await copyText(address))) return;
              setCopied(true);
              if (settle.current !== null) clearTimeout(settle.current);
              settle.current = setTimeout(() => { setCopied(false); }, 2_000);
            })();
          }}
        >
          {copied ? t('community.donate.copied') : t('community.donate.copy')}
        </GameButton>
      </div>
      <p className="selectable gk-donate__address">{address}</p>
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
      className="gk-donate__art"
    />
  );

  if (card.href === null) {
    return (
      <button type="button" disabled aria-label={label} className="gk-donate__card">
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
      {...OWN_SOUND}
      className="gk-donate__card"
      onClick={() => { playSound('tap'); haptic('tap'); }}
    >
      {art}
    </a>
  );
}
