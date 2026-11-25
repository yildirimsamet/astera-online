import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CAPSULE_CATALOG, CAPSULE_IDS } from '@astera/rules';
import { useSynthesis, useSynthesisOrder } from '../api/queries.js';
import type { CapsuleIdView, SynthesisView } from '../api/schemas.js';
import { describeError } from '../i18n/errors.js';
import { upTo } from '../lib/format.js';
import { haptic } from '../lib/haptics.js';
import { playSound } from '../lib/sound.js';
import { ASTERIUM_ART, CAPSULE_ART, capsuleWords, labState, vialRack } from '../lib/synthesis.js';
import { countdown, duration, useNow } from '../lib/time.js';
import { CostLine, GameHold, Glyph, InfoPeek, Slider } from '../game-ui/index.js';
import type { CssVars } from '../game-ui/style.js';
import { ArmSpecs, ArmStatus } from '../ui/ArmCard.js';
import { useToast } from '../ui/Toast.js';

/* The laboratory's own picture (G14, made with agy): a cut-out building, shown whole (owner 2026-11-25: "büyük kısmı kesilmiş"). */
const ART = '/assets/images/lab/synthesis_lab.webp';
const vialStyle = (fill: number): CssVars => ({ '--fill': fill });

/**
 * SENTEZ LABORATUVARI (plan 2026-11-24 §4.4), IN ITS OWN BAY (owner 2026-11-25: "ileride bu laboratuvar daha
 * gelişecek… daha profesyonelce tasarlanmalı"). A place, read top to bottom in the order a commander asks:
 *
 * 1. the lab and the Asteryum in it (the picture, the stock beside the resource's own icon);
 * 2. where Asteryum comes from: the moons a day, the next storm in the Yarık;
 * 3. the recipe shelf, the capsules as potions with what is held, the minutes and Asteryum each takes;
 * 4. the order (one count, one price line with all four resources and the time, a hold), or, while a batch
 *    brews, the still: a rack of vials, the made ones full, the next one filling.
 *
 * Each part is its own labelled section, so a new recipe is one more potion on the shelf and a new lab
 * system is one more section, not a reshuffle.
 */
export function SynthesisLab({ held }: { held: { alloy: number; crystal: number; deuterium: number } }) {
  const { t } = useTranslation();
  const now = useNow();
  const say = useToast();
  const read = useSynthesis();
  const order = useSynthesisOrder();
  const [capsule, setCapsule] = useState<CapsuleIdView>('OPTIC_VEIL');
  const [quantity, setQuantity] = useState(1);
  const view = read.data;
  if (!view?.enabled) return null;
  const job = view.job;
  const lit = job?.capsuleId ?? capsule;
  const name = (id: CapsuleIdView): string => t(`synthesis.capsule.${id}.name`);
  const cancel = (): void => {
    order.mutate({ kind: 'cancel' }, { onError: (error) => { say(describeError(error), 'error'); } });
  };
  return <section className="gk gk-lab" data-testid="synthesis-lab"
    data-state={job ? 'BUILDING' : view.unlocked ? 'READY' : 'LOCKED'}>
    {/* The stock, on its own at the very top (owner 2026-11-25: "direkt görülsün"): what the lab has to brew with. */}
    <div className="gk-lab__stock" data-lab-stock="">
      <img src={ASTERIUM_ART} alt="" width={30} height={30} draggable={false} />
      <span className="gk-lab__stocklabel">{t('synthesis.lab.stockLabel')}</span>
      <b className="gk-num" data-asterium="">{view.asterium}</b>
    </div>
    <header className="gk-lab__hero" data-lab-hero="">
      <img className="gk-lab__building" src={ART} alt="" draggable={false} decoding="async" />
      <h4 className="gk-lab__name"><Glyph id="flask" />{t('synthesis.lab.title')}</h4>
    </header>

    <div className="gk-lab__body">
      <Income view={view} now={now} />
      {view.moons.length === 0 && <p className="gk-sub">{t('synthesis.lab.noMoons')}</p>}

      <p className="gk-label">{t('synthesis.lab.recipes')}</p>
      <div className="gk-potions" role="radiogroup" aria-label={t('synthesis.lab.recipes')}>
        {CAPSULE_IDS.map((id) => <button key={id} type="button" role="radio" aria-checked={id === lit}
          className="gk-potion" data-capsule={id}
          disabled={job !== null || !view.unlocked}
          onClick={() => { if (id === capsule) return; playSound('tab'); haptic('tap'); setCapsule(id); setQuantity(1); }}>
          <span className="gk-potion__glass"><img src={CAPSULE_ART[id]} alt="" width={52} height={52} /></span>
          <span className="gk-potion__name">{name(id)}</span>
          <span className="gk-potion__meta gk-num">
            <b>×{view.capsules[id]}</b>
            <span>{t('units.minutes', { m: CAPSULE_CATALOG[id].craftMinutes })}</span>
            <span className="gk-asterium"><img src={ASTERIUM_ART} alt="" width={12} height={12} />{CAPSULE_CATALOG[id].cost.asterium}</span>
          </span>
        </button>)}
      </div>
      <p className="gk-sub">{capsuleWords(t, lit, true)}</p>

      {!view.unlocked && <p className="gk-arm__note"><Glyph id="lock" /> {t('synthesis.lab.locked', { core: view.requiredCore })}</p>}
      {view.unlocked && job && <div className="gk-lab__part" data-lab-still="">
        <ArmStatus tone="self" text={t('synthesis.lab.made', { done: job.delivered, total: job.quantity })} />
        <div className="gk-still" data-capsule={job.capsuleId}>
          <img className="gk-still__flask" src={CAPSULE_ART[job.capsuleId]} alt="" width={44} height={44} />
          <div className="gk-rack" aria-hidden="true">
            {vialRack(job, now).map((vial, index) => <i key={index} data-vial={vial.state} style={vialStyle(vial.fill)} />)}
          </div>
        </div>
        <p className="gk-sub">{name(job.capsuleId)} · {t('synthesis.lab.next', { time: countdown(Math.max(0, job.nextAt.getTime() - now)) })}</p>
        <p className="gk-arm__note">{t('synthesis.lab.cancelNote')}</p>
        <div data-act><GameHold label={t('synthesis.lab.cancel')} weight="final" tone="danger" glyph="close" commitSound="refuse"
          disabledReason={order.isPending ? '…' : null} onCommit={cancel} /></div>
      </div>}
      {view.unlocked && !job && <Order view={view} held={held} capsule={capsule} quantity={quantity} onQuantity={setQuantity} />}

      <InfoPeek fact={t('synthesis.lab.held', { count: view.capsules.OPTIC_VEIL + view.capsules.SILENT_THRUST })}
        about={t('itemSheet.howItWorks')}
        rule={<ul className="gk-arm__rules">
          <li>{t('synthesis.lab.rule')}</li>
          {CAPSULE_IDS.map((id) => <li key={id}>{name(id)}: {capsuleWords(t, id, true)}</li>)}
        </ul>} />
    </div>
  </section>;
}

/** Where Asteryum comes from, as two readings: what the moons add a day, and the Yarık's next storm. */
function Income({ view, now }: { view: SynthesisView; now: number }) {
  const { t } = useTranslation();
  const storm = view.storm;
  return <div data-lab-income="">
    <ArmSpecs items={[
      { glyph: 'moon', label: t('synthesis.lab.moons'), value: t('synthesis.lab.perDay', { amount: upTo(view.perDay, 1) }) },
      ...(storm ? [{
        glyph: 'storm' as const,
        label: t('synthesis.lab.storm'),
        value: <span data-storm={storm.active ? 'now' : 'next'}>{storm.active
          ? t('synthesis.lab.stormNow', { time: countdown(storm.endsAt.getTime() - now) })
          : t('synthesis.lab.stormNext', { time: countdown(storm.startsAt.getTime() - now) })}</span>,
      }] : []),
    ]} />
  </div>;
}

/** One batch: how many, one price line (the three, Asteryum, the time), and a hold that spends it. */
function Order({ view, held, capsule, quantity, onQuantity }: {
  view: SynthesisView;
  held: { alloy: number; crystal: number; deuterium: number };
  capsule: CapsuleIdView;
  quantity: number;
  onQuantity: (next: number) => void;
}) {
  const { t } = useTranslation();
  const say = useToast();
  const order = useSynthesisOrder();
  const state = labState(view, held, capsule, Math.min(quantity, labState(view, held, capsule, 1).most));
  const count = Math.min(quantity, state.most);
  const refusal = order.isPending ? '…'
    : state.refusal === 'asterium' ? t('synthesis.lab.short')
      : state.refusal === 'resources' ? t('errors.INSUFFICIENT_RESOURCES')
        : null;
  const start = (): void => {
    order.mutate({ kind: 'start', capsuleId: capsule, quantity: count }, {
      onSuccess: () => { haptic('thunk'); },
      onError: (error) => { say(describeError(error), 'error'); },
    });
  };
  return <div className="gk-lab__part" data-lab-order="">
    <Slider label={t('synthesis.lab.quantity')} value={count} min={1} max={state.most}
      onChange={(next) => { playSound('tick'); onQuantity(next); }} readout={String(count)} />
    <CostLine cost={{ ...state.cost, asterium: state.asterium }} held={{ ...held, asterium: view.asterium }}
      time={<span className="gk-cost__time" data-time=""><Glyph id="clock" />{duration(state.minutes)}</span>} />
    <div data-act><GameHold label={t('synthesis.lab.start')} weight="spends" glyph="flask" commitSound="ignite"
      disabledReason={refusal} onCommit={start} /></div>
  </div>;
}
