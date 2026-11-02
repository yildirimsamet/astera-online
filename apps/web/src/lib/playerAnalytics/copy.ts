import { matchLanguage, type Language } from '../../i18n/languages.js';
interface Copy { on: string; off: string }
const copy: Record<Language, Copy> = {
  tr: { on: 'Oyun ölçümü: Açık', off: 'Oyun ölçümü: Kapalı' },
  en: { on: 'Game measurement: On', off: 'Game measurement: Off' },
  fr: { on: 'Mesure du jeu : activée', off: 'Mesure du jeu : désactivée' },
  de: { on: 'Spielmessung: An', off: 'Spielmessung: Aus' },
  es: { on: 'Medición del juego: Activada', off: 'Medición del juego: Desactivada' },
  ja: { on: 'ゲーム計測：有効', off: 'ゲーム計測：無効' },
};
export const analyticsCopy = (language?: string): Copy => copy[matchLanguage(language) ?? 'tr'];
