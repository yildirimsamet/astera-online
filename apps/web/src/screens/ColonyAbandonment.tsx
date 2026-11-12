import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../api/client.js';
import { useAbandonColony, useColonyAbandonment } from '../api/colonyAbandonment.js';
import { colonyAbandonmentReasonSchema, type PlanetView } from '../api/schemas.js';
import { describe, useToast } from '../ui/Toast.js';
import { Banner, GameButton, GameHold, Glyph } from '../game-ui/index.js';
import { Sheet } from '../v2/kit/Sheet.js';
import type { z } from 'zod';

type Reason = z.infer<typeof colonyAbandonmentReasonSchema>;

export function ColonyAbandonment({ planet }: { planet: PlanetView }) {
  return planet.planet.kind === 'COLONY'
    ? <ColonyControl key={planet.planet.id} planet={planet} />
    : null;
}

function ColonyControl({ planet }: { planet: PlanetView }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return <>
    {/* Stage 4.1: a quiet kit row; the weight of the act lives in the sheet it opens. */}
    <button type="button" onClick={() => { setOpen(true); }} className="gk gk-exitrow">
      <span className="gk-exitrow__glyph"><Glyph id="colony" /></span>
      <span className="gk-exitrow__label">{t('planet.abandon.action')}</span>
      <Glyph id="next" />
    </button>
    {open && <AbandonColonySheet planet={planet} onClose={() => { setOpen(false); }} />}
  </>;
}

function AbandonColonySheet({ planet, onClose }: { planet: PlanetView; onClose: () => void }) {
  const { t } = useTranslation();
  const say = useToast();
  const eligibility = useColonyAbandonment(planet.planet.id);
  const abandon = useAbandonColony();
  const submitting = useRef(false);
  const [refusal, setRefusal] = useState<Reason | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const checking = eligibility.isPending || eligibility.isFetching;
  const reasons = [...new Set([...(eligibility.data?.reasons ?? []), ...(refusal ? [refusal] : [])])];
  const allowed = eligibility.isSuccess && !checking && eligibility.data.allowed && reasons.length === 0 && !failure;
  const close = () => { if (!submitting.current) onClose(); };
  const recheck = () => {
    if (checking || submitting.current) return;
    setRefusal(null);
    setFailure(null);
    abandon.reset();
    void eligibility.refetch();
  };

  const submit = () => {
    if (!allowed || submitting.current) return;
    submitting.current = true;
    abandon.mutate(planet.planet.id, {
      onSuccess: () => {
        say(t('planet.abandon.success', { planet: planet.planet.name }));
        onClose();
      },
      onError: error => {
        submitting.current = false;
        const reason = error instanceof ApiError && error.code === 'COLONY_ABANDON_BLOCKED'
          ? colonyAbandonmentReasonSchema.safeParse(error.params?.reason) : null;
        if (reason?.success) setRefusal(reason.data);
        else setFailure(describe(error));
      },
    });
  };
  /** A dead hold says why on its face: the check is running, the order is going, or something must finish first. */
  const holdRefusal = abandon.isPending ? t('planet.abandon.pending')
    : checking ? t('planet.abandon.checking')
      : allowed ? null : t('planet.abandon.blocked');

  /* Owner 2026-11-12 (4.1): abandoning is final, so it is the kit's 1.5 s hold, never a tap. */
  return <Sheet kit={{ tone: 'hostile' }} title={t('planet.abandon.title')} eyebrow={planet.planet.name} placement="card" detents={['fit']} onClose={close}
    footer={<div data-consent-foot className="grid gap-2">
      <GameHold label={t('planet.abandon.confirm')} tone="danger" glyph="colony" weight="final"
        disabledReason={holdRefusal} onCommit={submit} />
      <GameButton tone="ghost" wide disabledReason={abandon.isPending ? t('planet.abandon.cancel') : null} onPress={close}>
        {t('planet.abandon.cancel')}
      </GameButton>
    </div>}
  >
    <div className="grid gap-3">
      <Banner tone="hostile" variant="strip" glyph="warn" title={t('planet.abandon.irreversible')} />
      <ul className="grid gap-2">
        <li className="gk-inote"><span className="gk-tone-good"><Glyph id="crate" /></span><span>{t('planet.abandon.keeps')}</span></li>
        <li className="gk-inote"><span className="gk-tone-self"><Glyph id="recall" /></span><span>{t('planet.abandon.ships')}</span></li>
        <li className="gk-inote"><span className="gk-tone-hostile"><Glyph id="close" /></span><span>{t('planet.abandon.queue')}</span></li>
      </ul>
      <p className="gk-sub">{t('planet.abandon.rule')}</p>
      {!checking && (reasons.length > 0 || failure !== null || eligibility.isError) && (
        <section role="alert" className="grid gap-2">
          {reasons.map(reason => <Banner key={reason} tone="warn" variant="strip" title={t(`planet.abandon.reasons.${reason}`)} />)}
          {failure && <Banner tone="warn" variant="strip" title={failure} />}
          {eligibility.isError && <Banner tone="warn" variant="strip" title={t('planet.abandon.checkFailed')} />}
          <GameButton wide glyph="refresh" pending={abandon.isPending} onPress={recheck}>{t('planet.abandon.recheck')}</GameButton>
        </section>
      )}
    </div>
  </Sheet>;
}
