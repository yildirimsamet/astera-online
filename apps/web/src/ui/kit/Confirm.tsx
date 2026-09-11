import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button.js';
import { Sheet } from './Sheet.js';

/**
 * CONFIRM — the second beat before something that cannot be taken back.
 *
 * `visual-design.md` reserves commit STYLING for the irreversible; this is the
 * other half of that rule. A control that looks like a commitment and still fires
 * on the first tap is a control that only warns the players who already knew.
 *
 * WHAT IT IS FOR, AND WHAT IT IS NOT. Two things in this game destroy something
 * permanently on one press of a small target:
 *
 *   · CANCELLING A QUEUED ORDER, which burns half of what the order cost
 *     (`BUILD.cancelRefund`) from a 20px glyph in the corner of a build segment.
 *     The figure was on a `title` attribute — a tooltip, on a game budgeted for a
 *     phone, where no such thing exists — so on the real device the price was not
 *     merely unconfirmed, it was unstated.
 *   · FIRING A DEATH STAR, the most expensive single action a commander takes,
 *     which consumed the weapon from one slab in a wrapped row of four whose
 *     neighbour is an ordinary raid.
 *
 * It is NOT for every destructive-sounding thing. A raid is already committed on
 * its own full sheet, where the fleet is chosen; putting a second sheet in front
 * of that would be asking twice for one decision. The test is whether the press
 * that spends the thing is ALSO the press that chose it — if there is no surface
 * in between, this is that surface.
 *
 * ONE OBJECT, TWO USES, AND THAT IS DELIBERATE. Introducing two confirmations on
 * one day is the easiest way to grow the fifteenth bespoke card style the owner
 * reported; `irreversible-confirm.test.tsx` asserts both call sites reach here.
 *
 * IT IS AN ORDINARY SHEET. Same entrance, same head, same scrim, same commit slab
 * as every other decision surface — because it IS one, and a decision surface
 * that arrived looking like a browser `confirm()` would be the inconsistency this
 * was written to answer.
 *
 * AND IT GOES THROUGH A PORTAL, WHICH IS NOT A DETAIL. Unlike the sheets a screen
 * opens at its own top level, a confirmation is opened FROM a control, so it is
 * born wherever that control happens to live — and one of those places is
 * `FocusShell`, which is `absolute … z-20`. Position plus a z-index that is not
 * `auto` opens a stacking context, so the sheet's own `z-40` resolved INSIDE it:
 * everything on the page at z-30 or above painted over the scrim and stayed
 * clickable through it. A modal that is not modal.
 *
 * The first version of this file argued the opposite in a comment — "where the
 * element sits in this tree changes nothing about where it lands" — which is true
 * of the POSITION and false of the painting order. `document.body` is the only
 * parent that cannot be a stacking context somebody else opened.
 */
export function Confirm({
  eyebrow,
  title,
  children,
  confirmLabel,
  backLabel,
  pending = false,
  onConfirm,
  onClose,
}: {
  /** The question's category — what kind of thing is about to happen. */
  eyebrow: string;
  /** The subject, and it must NAME the thing: the order, or the world. */
  title: string;
  /**
   * What it costs, drawn rather than argued. Quantities a player must judge are
   * drawn (D142), and this is the one screen whose whole job is that judgement.
   */
  children: ReactNode;
  /** The verb, in the commander's own words. Never "OK". */
  confirmLabel: string;
  /**
   * The refusal, also in the caller's words.
   *
   * A PROP RATHER THAN A SHARED KEY, because `i18n/locales/en/index.ts` states
   * the rule: one namespace per surface and nothing shared between them. Two
   * controls that read the same in English are still two controls, and the day
   * one is reworded — or translated differently, which happens constantly
   * between English and Turkish — the other must not move with it.
   */
  backLabel: string;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return createPortal(
    <Sheet
      eyebrow={eyebrow}
      title={title}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {/*
            BACKING OUT IS A REAL CONTROL, and it is first. The glyph close in the
            head is a dismissal — the same one every sheet has — and a commander
            who has just been shown a price needs the refusal to be as findable as
            the acceptance, at the end of the screen their thumb is already at.
          */}
          {/*
            `px-3` RATHER THAN THE SIZE'S OWN `px-6`. This control takes a third
            of a 343px row on the target screen — about 111px — and `lg` spends
            48 of them on side padding, which left room for eight characters and
            wrapped the Turkish refusal onto a second line. See the arithmetic in
            `irreversible-confirm.test.tsx`.
          */}
          <Button variant="ghost" size="lg" onClick={onClose} className="flex-1 px-3">
            {backLabel}
          </Button>
          <Button
            variant="commit"
            size="lg"
            disabled={pending}
            onClick={onConfirm}
            testId="confirm-commit"
            className="flex-[2]"
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {children}
    </Sheet>,
    document.body,
  );
}

/**
 * A LINE OF THE PRICE. What goes, in the resource's own hue, beside what it is.
 *
 * `tone` is the whole grammar: `lost` is what this press destroys and `kept` is
 * what survives it. A refund figure on its own reads as a GAIN — the player is
 * being handed resources — and says nothing about the larger number destroyed to
 * hand it over, which is exactly how the queue's cancel used to read.
 */
export function ConfirmLine({
  label,
  value,
  tone = 'lost',
}: {
  label: string;
  value: ReactNode;
  tone?: 'lost' | 'kept';
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="legend min-w-0 flex-1 truncate">{label}</span>
      <span className={`num shrink-0 text-body ${tone === 'lost' ? 'text-threat-ink' : 'text-dim'}`}>
        {value}
      </span>
    </div>
  );
}
