import { matchLanguage, type Language } from '../../i18n/languages.js';
/** `label` names the switch (G1-f); `on`/`off` say its state in a sentence. */
interface Copy { label: string; on: string; off: string }
const copy: Record<Language, Copy> = {
  tr: { label: 'Oyun ölçümü', on: 'Oyun ölçümü: Açık', off: 'Oyun ölçümü: Kapalı' },
  en: { label: 'Game measurement', on: 'Game measurement: On', off: 'Game measurement: Off' },
  fr: { label: 'Mesure du jeu', on: 'Mesure du jeu : activée', off: 'Mesure du jeu : désactivée' },
  de: { label: 'Spielmessung', on: 'Spielmessung: An', off: 'Spielmessung: Aus' },
  es: { label: 'Medición del juego', on: 'Medición del juego: Activada', off: 'Medición del juego: Desactivada' },
  ja: { label: 'ゲーム計測', on: 'ゲーム計測：有効', off: 'ゲーム計測：無効' },
};
export const analyticsCopy = (language?: string): Copy => copy[matchLanguage(language) ?? 'tr'];
