import { useTranslation } from 'react-i18next';
import { GameButton } from '../game-ui/index.js';

/**
 * THE APP REFUSED AT THE DOOR (G13-a, 2026-11-16): what it is, the server's own reason, and one
 * lit press to try again. The web shows its front door instead; this is the app's screen.
 */
export function BlockedScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <main role="alert" className="flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="gk-crash">
        <h1 className="gk-display gk-crash__title">{t('app.blockedTitle')}</h1>
        <p className="gk-sub gk-crash__body">{message}</p>
        <GameButton tone="action" size="lg" wide glyph="refresh" onPress={onRetry}>{t('app.blockedRetry')}</GameButton>
      </div>
    </main>
  );
}
