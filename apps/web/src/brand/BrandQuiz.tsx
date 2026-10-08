import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BRAND_RECALL } from '@astera/rules';
import type { Api } from '../api/client.js';
import { Sheet } from '../v2/kit/Sheet.js';
import { Button } from '../v2/kit/Surface.js';
import { Icon } from '../v2/icons.js';
import { BrandLockup, BrandRewardTray, useBrandPanelFocus } from './Panel.js';

export type BrandQuizResult = Awaited<ReturnType<Api['answerBrandRecall']>>;

export function BrandQuiz({ result, message, pending, reward, onAnswer, onClose }: {
  result: BrandQuizResult | null; message: 'wrong' | 'failed' | null; pending: boolean;
  reward: BrandQuizResult['granted']; onAnswer: (value: string | null) => void; onClose: () => void;
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string | null>(null);
  const [choices] = useState(() => {
    const ordered: string[] = [...BRAND_RECALL.choices];
    for (let i = ordered.length - 1; i > 0; i--) {
      const at = Math.floor(Math.random() * (i + 1));
      [ordered[i], ordered[at]] = [ordered[at]!, ordered[i]!];
    }
    return ordered;
  });
  const completed = result?.completed === true;
  const content = useBrandPanelFocus(true, completed);
  const paid = completed && result.granted.alloy + result.granted.crystal + result.granted.deuterium > 0;
  const title = t(completed ? paid ? 'brand.received' : 'brand.alreadyComplete' : 'brand.quizLabel');

  return <Sheet title={title} detents={['fit']} placement="card" quietTitle bleed onClose={onClose}>
    <div ref={content} tabIndex={-1} data-testid="brand-quiz" className="brand-panel brand-quiz-panel" aria-busy={pending}>
      <BrandLockup />
      {completed ? <>
        <div className="brand-quiz-complete"><span className="brand-success-mark" aria-hidden="true"><Icon id="i-check" className="size-6" /></span><h3 className="brand-panel-heading">{title}</h3></div>
        <p className="brand-quiz-address select-all">asteraonline<span>.space</span></p>
        {paid && <BrandRewardTray reward={result.granted} label={t('brand.rewardLabel')} />}
        <Button variant="primary" onClick={onClose}>{t('brand.continue')}<Icon id="i-chev" className="size-4" /></Button>
      </> : <>
        <p className="brand-panel-label">{t('brand.quizLabel')}</p>
        <h3 className="brand-panel-heading">{t('brand.question')}</h3>
        <BrandRewardTray reward={reward} label={t('brand.rewardLabel')} />
        <div className="brand-quiz-choices">{choices.map((choice, index) => {
          const at = choice.lastIndexOf('.');
          return <button key={choice} type="button" aria-label={choice} disabled={pending}
            className="brand-quiz-choice" data-selected={selected === choice || undefined}
            data-wrong={message === 'wrong' && selected === choice || undefined}
            onClick={() => { setSelected(choice); onAnswer(choice); }}>
            <span className="brand-choice-letter" aria-hidden="true">{String.fromCharCode(65 + index)}</span>
            <span className="brand-choice-address">{choice.slice(0, at)}<span>{choice.slice(at)}</span></span>
            <Icon id="i-chev" className="size-4" />
          </button>;
        })}</div>
        {message && <p role="alert" className="brand-panel-notice">{t(message === 'wrong' ? 'brand.wrong' : 'brand.requestFailed')}</p>}
        {pending && <p role="status" className="brand-panel-note">{t('brand.waiting')}</p>}
        <Button variant="ghost" disabled={pending} onClick={() => { onAnswer(null); }}>{t('brand.skip')}</Button>
      </>}
    </div>
  </Sheet>;
}
