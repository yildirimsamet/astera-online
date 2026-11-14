import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSendFeedback } from '../api/queries.js';
import type { FeedbackKind } from '../api/schemas.js';
import { describeError } from '../i18n/errors.js';
import { Banner, Choices, GameButton } from '../game-ui/index.js';

const MAX_MESSAGE = 2_000;

/**
 * A LINE TO THE TEAM (C5, 2026-11-14): what kind of word it is on the kit's plates, the message
 * in the glass slot, a send key that says what it still needs, and the kit's good banner after.
 */
export function FeedbackScreen() {
  const { t } = useTranslation();
  const field = useId();
  const [kind, setKind] = useState<FeedbackKind>('BUG');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const submitFeedback = useSendFeedback();
  const clean = message.trim();

  const send = (): void => {
    if (clean.length < 3 || submitFeedback.isPending) return;
    submitFeedback.mutate({ kind, message: clean }, {
      onSuccess: () => {
        setMessage('');
        setSent(true);
      },
    });
  };

  return (
    <div className="gk flex flex-col gap-4 pb-6 pt-3">
      <p className="gk-copy">{t('community.feedback.intro')}</p>
      <Choices
        label={t('community.feedback.kindLabel')}
        value={kind}
        onChange={(next) => {
          setKind(next);
          setSent(false);
        }}
        options={[
          { id: 'BUG', label: t('community.feedback.kinds.bug') },
          { id: 'SUGGESTION', label: t('community.feedback.kinds.suggestion') },
          { id: 'PRAISE', label: t('community.feedback.kinds.praise') },
        ]}
      />
      <div className="grid gap-1.5">
        <label htmlFor={field} className="gk-copy font-semibold">{t('community.feedback.messageLabel')}</label>
        <textarea
          id={field}
          value={message}
          rows={8}
          maxLength={MAX_MESSAGE}
          placeholder={t('community.feedback.placeholder')}
          onChange={(event) => {
            setMessage(event.currentTarget.value);
            setSent(false);
          }}
          className="gk-field__input"
        />
        <span className="gk-note ml-auto">{t('community.feedback.remaining', { count: MAX_MESSAGE - message.length })}</span>
      </div>
      {submitFeedback.isError && (
        <p role="alert" className="text-v2-warn">{describeError(submitFeedback.error)}</p>
      )}
      {sent && <Banner tone="good" glyph="check" role="status" title={t('community.feedback.sent')} />}
      <GameButton wide tone="action" glyph="mail" pending={submitFeedback.isPending}
        disabledReason={clean.length < 3 ? t('community.feedback.tooShort') : null} onPress={send}>
        {submitFeedback.isPending ? t('community.feedback.sending') : t('community.feedback.send')}
      </GameButton>
    </div>
  );
}
