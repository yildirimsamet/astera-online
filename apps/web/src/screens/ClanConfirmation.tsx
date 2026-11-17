import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { GameButton, GameHold, Glyph } from '../game-ui/index.js';

/**
 * A CLAN ACT ASKED FOR IN PLACE. What will happen in a red-edged well, the act itself on the kit's
 * 0.6 s hold (owner 2026-11-14: every former confirmation dialog is a 0.6 s hold), and a way back.
 * Removing a member, handing over the lead, leaving, disbanding, joining with hostile flights in the
 * air and cancelling the clan's target all ask this way.
 */
export function ClanConfirmation({
  title,
  body,
  confirm,
  back,
  onCancel,
  onConfirm,
  busy,
  error = null,
}: {
  title: string;
  body: string;
  confirm: string;
  /** The way back's word; "Cancel" when the act has none of its own. */
  back?: string;
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
  /** Why the act just failed, said where it was asked. */
  error?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <aside aria-label={title} className="gk-well gk-clan__confirm">
      <p className="gk-inote" data-tone="hostile"><Glyph id="warn" />{title}</p>
      <p className="gk-sub">{body}</p>
      <GameHold weight="reversible" tone="danger" size="md" glyph="warn" label={confirm}
        disabledReason={busy ? confirm : null} onCommit={onConfirm} />
      {error ? <p role="alert" className="gk-inote" data-tone="warn"><Glyph id="warn" />{error}</p> : null}
      <GameButton size="sm" glyph="back" onPress={onCancel}>{back ?? t('clan.cancel')}</GameButton>
    </aside>
  );
}
