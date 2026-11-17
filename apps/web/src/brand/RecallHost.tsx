import { isAppActive, watchAppActivity } from '../platform/activity.js';
import { refreshQueries } from '../api/refreshQueries.js';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { BRAND_RECALL } from '@astera/rules';
import { useApi } from '../api/context.js';
import { keys } from '../api/keys.js';
import { useApplyPlanet } from '../api/queries.js';
import { RoundButton } from '../game-ui/index.js';
import { BrandQuiz, type BrandQuizResult } from './BrandQuiz.js';
import { InstallButton, useDesktopInstall, useInstalled } from './Install.js';
import { advanceRecall, readRecall, saveRecall } from './recallState.js';
import { capabilities } from '../platform/runtime.js';

type AnswerResult = BrandQuizResult;

/** Mounted only by the real-game shell, never the Academy or entry screens. */
export function RecallHost({ accountId, paused = false }: { accountId: string; paused?: boolean }) {
  const api = useApi();
  const client = useQueryClient();
  const applyPlanet = useApplyPlanet();
  const { t } = useTranslation();
  const installed = useInstalled();
  const offerInstall = capabilities().pwaInstall && !installed;
  const desktop = useDesktopInstall();
  const key = ['brandRecall', accountId] as const;
  const status = useQuery({ queryKey: key, queryFn: () => api.brandRecallStatus(), staleTime: Infinity });
  const progress = useRef(readRecall(accountId));
  const [surface, setSurface] = useState<'return' | 'quiz' | null>(null);
  const surfaceRef = useRef(surface);
  surfaceRef.current = surface;
  const blocked = useRef(paused);
  blocked.current = paused;
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [message, setMessage] = useState<'wrong' | 'failed' | null>(null);
  const eligible = status.data?.eligible === true && !status.data.completed;

  const answer = useMutation({
    mutationFn: (value: string | null) => api.answerBrandRecall(value),
    onSuccess: async (response, value) => {
      setMessage(response.completed ? null : 'wrong');
      setResult(response);
      if (response.planet) await applyPlanet(response.planet);
      if (response.completed) {
        progress.current = saveRecall(accountId, { ...progress.current, quizDone: true });
        client.setQueryData(key, { ...status.data, eligible: true, completed: true });
        void refreshQueries(client, { queryKey: keys.rewards });
        void refreshQueries(client, { queryKey: keys.leaderboard });
        void refreshQueries(client, { queryKey: keys.galaxy });
        if (value === null) setSurface(null);
      }
    },
    onError: () => { setMessage('failed'); },
  });

  useEffect(() => {
    if (!eligible || progress.current.quizDone) return;
    let last = performance.now();
    let playing = isAppActive() && !document.querySelector('[data-loading-screen]');
    let savedAt = last;
    const tick = () => {
      const now = performance.now();
      const visible = isAppActive();
      const loaded = !document.querySelector('[data-loading-screen]');
      if (playing && visible && loaded) progress.current = advanceRecall(progress.current, now - last);
      playing = visible && loaded;
      last = now;
      if (now - savedAt >= 5000 || !visible) {
        progress.current = saveRecall(accountId, progress.current);
        savedAt = now;
      }
      if (!playing || blocked.current || document.querySelector('[data-sheet-panel], [role="dialog"], [data-consent-notice]')) return;
      if (!progress.current.quizDone && progress.current.activeMs >= BRAND_RECALL.delayMs) {
        if (surfaceRef.current !== 'quiz') setSurface('quiz');
      } else if (offerInstall && !progress.current.returnShown && progress.current.activeMs >= BRAND_RECALL.returnDelayMs) {
        progress.current = saveRecall(accountId, { ...progress.current, returnShown: true });
        setSurface('return');
      }
    };
    const interval = window.setInterval(tick, 500);
    const onVisibility = () => { tick(); last = performance.now(); playing = isAppActive() && !document.querySelector('[data-loading-screen]'); };
    const onStorage = () => { progress.current = saveRecall(accountId, progress.current); if (progress.current.quizDone) setSurface(null); };
    const stopActivity = watchAppActivity(onVisibility);
    window.addEventListener('pagehide', tick);
    window.addEventListener('storage', onStorage);
    return () => {
      window.clearInterval(interval);
      stopActivity();
      window.removeEventListener('pagehide', tick);
      window.removeEventListener('storage', onStorage);
      saveRecall(accountId, progress.current);
    };
  }, [accountId, eligible, offerInstall]);

  if (surface === 'quiz') return <BrandQuiz
    result={result} message={message} pending={answer.isPending}
    reward={status.data?.reward ?? BRAND_RECALL.reward}
    onAnswer={(value) => { setMessage(null); answer.mutate(value); }}
    onClose={() => { if (answer.isPending) return; if (result?.completed) setSurface(null); else answer.mutate(null); }}
  />;
  if (surface !== 'return' || paused || !offerInstall) return null;
  return <aside data-testid="return-card" className="gk gk-returncard" aria-label={t('brand.returnTitle')}>
    <div className="gk-returncard__head">
      <div>
        <p className="gk-display gk-returncard__title">{t('brand.returnTitle')}</p>
        <p className="gk-returncard__address">asteraonline<span>.space</span></p>
      </div>
      <RoundButton glyph="close" label={t('brand.close')} onPress={() => { setSurface(null); }} />
    </div>
    <p className="gk-sub">{t(desktop ? 'brand.returnHintDesktop' : 'brand.returnHint')}</p>
    <div className="gk-returncard__foot"><span className="gk-label">Astera Online</span><InstallButton compact /></div>
  </aside>;
}
