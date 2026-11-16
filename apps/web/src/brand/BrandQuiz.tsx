import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BRAND_RECALL } from '@astera/rules';
import type { Api } from '../api/client.js';
import { Sheet } from '../v2/kit/Sheet.js';
import { Banner, GameButton, Glyph } from '../game-ui/index.js';
import { playSound } from '../lib/sound.js';
import { AsteraSigil, AsteraWordmark } from './Identity.js';
import { BrandRewardTray, useBrandPanelFocus } from './Panel.js';

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

  return <Sheet title={title} detents={['fit']} placement="card" quietTitle bleed kit={{ tone: 'self' }} onClose={onClose}>
    <div ref={content} tabIndex={-1} data-testid="brand-quiz" className="gk-quiz" aria-busy={pending}>
      <div className="gk-quizbrand" aria-label="Astera Online">
        <span className="sr-only">Astera Online</span><AsteraSigil className="gk-quizbrand__sigil" />
        <AsteraWordmark className="gk-quizbrand__word" /><span aria-hidden="true">ONLINE</span>
      </div>
      {completed ? <>
        <div className="gk-quiz__done"><span className="gk-quiz__mark" aria-hidden="true"><Glyph id="check" /></span><h3 className="gk-display gk-quiz__title">{title}</h3></div>
        <p className="gk-quiz__address select-all">asteraonline<span>.space</span></p>
        {paid && <BrandRewardTray reward={result.granted} label={t('brand.rewardLabel')} />}
        <GameButton tone="action" size="lg" wide glyph="next" onPress={onClose}>{t('brand.continue')}</GameButton>
      </> : <>
        <p className="gk-label gk-quiz__eyebrow">{t('brand.quizLabel')}</p>
        <h3 className="gk-display gk-quiz__title">{t('brand.question')}</h3>
        <BrandRewardTray reward={reward} label={t('brand.rewardLabel')} />
        <div className="gk-quiz__choices">{choices.map((choice, index) => {
          const at = choice.lastIndexOf('.');
          return <button key={choice} type="button" aria-label={choice} disabled={pending}
            className="gk-quizopt" data-selected={selected === choice || undefined}
            data-wrong={message === 'wrong' && selected === choice || undefined}
            onClick={() => { playSound('tap'); setSelected(choice); onAnswer(choice); }}>
            <span className="gk-quizopt__key gk-num" aria-hidden="true">{String.fromCharCode(65 + index)}</span>
            <span className="gk-quizopt__address">{choice.slice(0, at)}<span>{choice.slice(at)}</span></span>
            <Glyph id="next" />
          </button>;
        })}</div>
        {message && <Banner tone="warn" role="alert" title={t(message === 'wrong' ? 'brand.wrong' : 'brand.requestFailed')} />}
        {pending && <p role="status" className="gk-note">{t('brand.waiting')}</p>}
        <GameButton tone="ghost" disabledReason={pending ? t('brand.waiting') : null} onPress={() => { onAnswer(null); }}>{t('brand.skip')}</GameButton>
      </>}
    </div>
  </Sheet>;
}
