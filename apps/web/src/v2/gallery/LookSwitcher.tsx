/**
 * THE LOOK SWITCHER (gallery only, owner 2026-11-12). Redraws every kit screen in another
 * panel colour (`&skin=`) and another design language (`&tone=`), so looks are compared on
 * the same screens. The marks sit on <html>, so sheets and dialogs wear the look too.
 * Today's look (game tone, navy skin) carries no mark.
 */
import '../../game-ui/tone-command.css';
import { useEffect, useState } from 'react';

export const LOOK_TONES = [
  { id: 'game', name: 'Bugün' },
  { id: 'command', name: 'Komuta' },
] as const;
export const LOOK_SKINS = [
  { id: 'navy', name: 'Lacivert' },
  { id: 'graphite', name: 'Grafit' },
  { id: 'carbon', name: 'Karbon' },
] as const;

type Tone = typeof LOOK_TONES[number]['id'];
type Skin = typeof LOOK_SKINS[number]['id'];
export interface Look { tone: Tone; skin: Skin }

const DEFAULT: Look = { tone: 'game', skin: 'navy' };
const pick = <T extends string>(options: readonly { id: T }[], value: string | null, fallback: T): T =>
  options.find((option) => option.id === value)?.id ?? fallback;

export function readLook(search: string): Look {
  const params = new URLSearchParams(search);
  return { tone: pick(LOOK_TONES, params.get('tone'), DEFAULT.tone), skin: pick(LOOK_SKINS, params.get('skin'), DEFAULT.skin) };
}

const mark = (name: string, value: string, plain: string): void => {
  if (value === plain) document.documentElement.removeAttribute(name);
  else document.documentElement.setAttribute(name, value);
};

const remember = (look: Look): void => {
  const params = new URLSearchParams(window.location.search);
  for (const [key, value, plain] of [['tone', look.tone, DEFAULT.tone], ['skin', look.skin, DEFAULT.skin]] as const) {
    if (value === plain) params.delete(key);
    else params.set(key, value);
  }
  window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
};

function Choice<T extends string>({ label, options, value, onPick }: {
  label: string;
  options: readonly { id: T; name: string }[];
  value: T;
  onPick: (id: T) => void;
}) {
  return (
    <div className="gk-look__row" role="radiogroup" aria-label={label}>
      <span className="gk-label">{label}</span>
      {options.map((option) => (
        <button key={option.id} type="button" className="gk-hit" role="radio" aria-checked={value === option.id} onClick={() => { onPick(option.id); }}>
          <span className="gk-chip" data-on={value === option.id ? '' : undefined}>{option.name}</span>
        </button>
      ))}
    </div>
  );
}

export function LookSwitcher() {
  const [look, setLook] = useState<Look>(() => readLook(window.location.search));
  const [open, setOpen] = useState(false);

  useEffect(() => {
    mark('data-gk-tone', look.tone, DEFAULT.tone);
    mark('data-gk-skin', look.skin, DEFAULT.skin);
  }, [look]);
  useEffect(() => () => {
    document.documentElement.removeAttribute('data-gk-tone');
    document.documentElement.removeAttribute('data-gk-skin');
  }, []);

  const change = (next: Look): void => {
    setLook(next);
    remember(next);
  };

  return (
    <div className="gk gk-look">
      <button type="button" className="gk-hit" aria-expanded={open} onClick={() => { setOpen(!open); }}>
        <span className="gk-chip">Görünüm</span>
      </button>
      {open && (
        <div className="gk-look__panel">
          <Choice label="Dil" options={LOOK_TONES} value={look.tone} onPick={(tone) => { change({ ...look, tone }); }} />
          <Choice label="Renk" options={LOOK_SKINS} value={look.skin} onPick={(skin) => { change({ ...look, skin }); }} />
        </div>
      )}
    </div>
  );
}
