import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n/index.js';
import { LoadingScreen } from '../shell/LoadingScreen.js';
import { BrandMasthead } from './Identity.js';
import { TopBar } from '../v2/hud/TopBar.js';
import { BRAND_RECALL } from '@astera/rules';
import { BrandQuiz, type BrandQuizResult } from './BrandQuiz.js';
import { InstallButton, InstallProvider } from './Install.js';
import '../styles.css';

// A review surface, not part of the game bundle or its interaction flow.
const params = new URLSearchParams(window.location.search);
const view = params.get('view');
void i18n.changeLanguage(params.get('lang') ?? 'tr');
const noop = () => undefined;

function Preview() {
  const [result, setResult] = useState<BrandQuizResult | null>(params.get('state') === 'reward' ? { correct: true, completed: true, granted: BRAND_RECALL.reward } : null);
  const [message, setMessage] = useState<'wrong' | 'failed' | null>(params.get('state') === 'wrong' ? 'wrong' : null);
  const [closed, setClosed] = useState(false);
  if (!view) return <LoadingScreen caption="Evrenle bağlantı kuruluyor…" {...(params.get('progress') ? { progress: Number(params.get('progress')) } : {})} />;
  return <InstallProvider><div style={{ minHeight: '100dvh', background: 'var(--color-v2-void)' }}>
      <BrandMasthead />
      <TopBar commander="Yıldırım" shield={null} now={Date.now()} world={null}
        stock={{ alloy: { value: 1270, cap: 5000 }, crystal: { value: 860, cap: 5000 }, deuterium: { value: 240, cap: 1000 } }}
        bell={{ unseen: 0, urgent: false }} rewards={0} boosted={false}
        onCommander={noop} onRewards={noop} onWorld={noop} onResource={noop} onBell={noop} />
      <div style={{ padding: 24, fontSize: 13, color: 'var(--color-v2-ink-2)' }}>
        <p style={{ marginBottom: 16 }}>Astera Online · tasarım önizlemesi</p>
        {view === 'install' && <InstallButton />}
        <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 24, color: 'var(--color-v2-self)' }}>
          <a href="/brand-preview.html">Loading</a><a href="?view=hud">Üst bar</a><a href="?view=install">Kurulum</a><a href="?view=quiz">Quiz</a>
        </nav>
      </div>
      {view === 'quiz' && !closed && <BrandQuiz result={result} message={message} pending={false} reward={BRAND_RECALL.reward}
        onClose={() => { setClosed(true); }}
        onAnswer={(value) => {
          if (value === null) { setClosed(true); return; }
          if (value !== BRAND_RECALL.answer) { setMessage('wrong'); return; }
          setMessage(null); setResult({ correct: true, completed: true, granted: BRAND_RECALL.reward });
        }} />}
    </div></InstallProvider>;
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<I18nextProvider i18n={i18n}><Preview /></I18nextProvider>);
