import { nextRequiredStep } from '@astera/rules';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useApi } from '../../api/context.js';
import type { VesselView } from '../../api/starterSchemas.js';
import { haptic } from '../../lib/haptics.js';
import { playSound } from '../../lib/sound.js';
import { observe } from '../../lib/playerAnalytics/runtime.js';
import { connectPush } from '../../platform/push.js';
import { capabilities } from '../../platform/runtime.js';

const permissionSchema = z.object({ attempts: z.number().int().min(0).max(2), deniedAt: z.number().nullable() });
const fresh = { attempts: 0, deniedAt: null };
const keyOf = (id: string) => `astera.starter.permission.${id}`;
function read(id: string): z.infer<typeof permissionSchema> {
  try { return permissionSchema.parse(JSON.parse(localStorage.getItem(keyOf(id)) ?? JSON.stringify(fresh))); } catch { return fresh; }
}

/** After the farewell the NPC never owns a gate. Permission has one retry; a visit has one hint. */
export function StarterAftercare({ vessel, farewelled }: { vessel: VesselView; farewelled: boolean }) {
  const api = useApi();
  const { t, i18n } = useTranslation();
  const [permission, setPermission] = useState(() => read(vessel.id));
  const [busy, setBusy] = useState(false);
  const hintKey = `astera.starter.hint.${vessel.id}`;
  const [hintClosed, closeHint] = useState(() => { try { return sessionStorage.getItem(hintKey) === 'closed'; } catch { return false; } });
  const first = nextRequiredStep({ modules: vessel.modules, facts: vessel.facts, parts: vessel.parts, fuel: vessel.fuel }, []);
  const need = first?.missing.find(need => need.kind === 'FACT' || need.kind === 'PARTS');
  const deniedAt = permission.deniedAt;
  const retry = permission.attempts === 1 && deniedAt !== null && vessel.queue.some(order =>
    order.queue === 'CONSTRUCTION' && order.startedAt.getTime() > deniedAt && order.readyAt.getTime() - order.startedAt.getTime() >= 15 * 60_000);
  const offer = farewelled && capabilities().nativePush && (permission.attempts === 0 || retry);
  if (!farewelled || (!offer && (hintClosed || !need))) return null;
  const finish = async (allow: boolean): Promise<void> => {
    if (busy) return;
    setBusy(true);
    playSound('confirm'); haptic('tap');
    const result = allow ? await connectPush(api, { ask: true, locale: i18n.resolvedLanguage ?? 'en', channelName: t('notificationCenter.pushChannel') }) : 'denied';
    if (!allow) observe('alert_permission', { code: 'dismissed', variant: 'push' }, 'live');
    const next = { attempts: result === 'on' ? 2 : Math.min(2, permission.attempts + 1), deniedAt: result === 'on' ? null : Date.now() };
    try { localStorage.setItem(keyOf(vessel.id), JSON.stringify(next)); } catch { /* This visit still remembers. */ }
    setPermission(next); setBusy(false); closeHint(true);
  };
  const dismissHint = (): void => {
    try { sessionStorage.setItem(hintKey, 'closed'); } catch { /* The mounted visit still remembers. */ }
    closeHint(true);
  };
  const task = need?.kind === 'FACT' ? t(`starter.factHow.${need.fact}`) : t('starter.objective.parts', { count: need?.kind === 'PARTS' ? Math.max(0, need.count - vessel.parts) : 0 });
  return <aside data-starter-aftercare className="fixed inset-x-3 top-[max(72px,env(safe-area-inset-top))] z-[85] mx-auto flex max-w-md gap-2 rounded-control border border-v2-self/50 bg-v2-deep/95 p-3 font-v2-ui shadow-lg">
    <img src="/assets/images/general/tutorial-npc.png" alt="" className="size-16 shrink-0 object-contain" />
    <div className="min-w-0 flex-1">
      <p className="text-caption leading-snug text-v2-ink">{offer ? t('starter.tutorial.push') : t('starter.tutorial.hint', { task })}</p>
      <div className="mt-2 flex flex-wrap justify-end gap-2">
        {offer ? <>
          <button type="button" disabled={busy} className="min-h-9 px-3 text-caption text-v2-ink-2" onClick={() => { void finish(false); }}>{t('starter.tutorial.later')}</button>
          <button type="button" disabled={busy} className="min-h-9 rounded-control border border-v2-self px-3 text-caption text-v2-self" onClick={() => { void finish(true); }}>{t('starter.tutorial.allow')}</button>
        </> : <button type="button" className="min-h-9 px-3 text-caption text-v2-self" onClick={() => { playSound('confirm'); haptic('tap'); dismissHint(); }}>{t('starter.tutorial.dismiss')}</button>}
      </div>
    </div>
  </aside>;
}
