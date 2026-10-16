import { useTranslation } from 'react-i18next';
import { ChargeTally } from '../v2/kit/ChargeTally.js';

/** Slots always count inventory; a weapon's level belongs to its own badge. */
export function TacticalStock({ ready, loading, paused = 0, inFlight = 0, total, capacity = total, kind = 'stock' }: {
  ready: number;
  loading: number;
  paused?: number;
  inFlight?: number;
  total: number;
  /** A captured world can retain more stock than its owner may manufacture. */
  capacity?: number;
  kind?: 'stock' | 'charges';
}) {
  const { t } = useTranslation();
  const used = ready + loading + paused + inFlight;
  const counter = t(`planet.tacticalStock.${kind}`, { used, total: capacity });
  const states: { key: 'ready' | 'loading' | 'paused' | 'flight'; count: number }[] = [
    { key: 'ready', count: ready },
    { key: 'loading', count: loading },
    { key: 'paused', count: paused },
    { key: 'flight', count: inFlight },
  ];
  const summary = states.filter(part => part.count > 0)
    .map(part => t(`planet.tacticalStock.${part.key}`, { count: part.count }));
  if (summary.length === 0) summary.push(t('planet.tacticalStock.empty'));
  const reading = summary.join(' · ');
  return <div className="tactical-stock" data-stock-kind={kind}>
    <div className="tactical-stock__counter"><span data-stock-counter>{counter}</span>
      <ChargeTally ready={ready} loading={loading} paused={paused} inFlight={inFlight} total={total}
        label={`${counter} · ${reading}`} /></div>
    <p className="tactical-stock__summary">{reading}</p>
  </div>;
}
