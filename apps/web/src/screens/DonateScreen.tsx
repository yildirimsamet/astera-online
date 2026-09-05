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
 * anyone already holding crypto, and card amounts for anyone who is not. The
 * İyzico amounts are DISABLED on purpose — the prices and the payment link are not
 * settled yet, and a live-looking button that does nothing when pressed is worse
 * than one that says it is not ready.
 */

const CRYPTO = [
  { id: 'trc20', labelKey: 'cryptoTrc20', address: 'TPDV6p6QctXvL7nwiW7AMkPzqNqkrG2kGS' },
  { id: 'solana', labelKey: 'cryptoSolana', address: '3z84BrV8nzzbZkGuDmWczjn6vd6Z1tKis9PHimZSae9J' },
] as const;

const CARD_AMOUNTS = ['$1', '$5', '$10', '$20'] as const;

export function DonateScreen() {
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

      <Section label={t('community.donate.cardHeading')}>
        <div className="grid grid-cols-4 gap-2">
          {CARD_AMOUNTS.map((amount) => (
            <Button key={amount} variant="default" size="lg" disabled>
              {amount}
            </Button>
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
