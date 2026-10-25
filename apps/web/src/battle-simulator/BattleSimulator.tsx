import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { COMBAT, HULLS, fleetEntries } from '@astera/rules';
import { LanguageSwitch } from '../ui/LanguageSwitch.js';
import { DEFAULT_SCENARIO, SIMULATION_UNIT_LIMIT, scenarioSchema, type BattleScenario, type BattleSimulation } from './scenario.js';
import { runSimulation } from './runner.js';
import { SideEditor } from './SideEditor.js';
import { BattleReplay } from './BattleReplay.js';
import { SimulationNumberInput } from './SimulationNumberInput.js';
import { useCompactViewport } from './useCompactViewport.js';
import './simulator.css';

export function BattleSimulator({ onLeave }: { onLeave: () => void }) {
  const { t } = useTranslation();
  const compact = useCompactViewport();
  const [scenario, setScenario] = useState(() => structuredClone(DEFAULT_SCENARIO));
  const [side, setSide] = useState<'attackers' | 'defenders'>('attackers');
  const [settings, setSettings] = useState(() => window.innerWidth >= 700);
  const [simulation, setSimulation] = useState<BattleSimulation | null>(null);
  const [busy, setBusy] = useState(true), [dirty, setDirty] = useState(false);
  const [error, setError] = useState<'invalid' | 'failed' | null>(null);
  const [invalidFields, setInvalidFields] = useState<ReadonlySet<string>>(new Set());
  const [presetName, setPresetName] = useState('balanced');
  const pending = useRef<AbortController | null>(null);
  const edits = useRef(0);
  const [revision, setRevision] = useState(0);
  const update = useCallback((change: (draft: BattleScenario) => void) => {
    edits.current++;
    setScenario(current => { const next = structuredClone(current); change(next); return next; });
    setDirty(true); setError(null); setInvalidFields(new Set()); setPresetName('custom');
  }, []);
  const start = useCallback(async (input: BattleScenario) => {
    const parsed = scenarioSchema.safeParse(input);
    if (!parsed.success) {
      setInvalidFields(new Set(parsed.error.issues.map(issue => issue.path.join('.'))));
      const invalidSide = parsed.error.issues.find(issue => issue.path[0] === 'attackers' || issue.path[0] === 'defenders')?.path[0];
      if (invalidSide === 'attackers' || invalidSide === 'defenders') setSide(invalidSide);
      setSettings(true); setError('invalid'); setBusy(false); return;
    }
    pending.current?.abort();
    const controller = new AbortController(); pending.current = controller;
    const submittedEdits = edits.current;
    setBusy(true); setError(null); setInvalidFields(new Set());
    try {
      const output = await runSimulation(parsed.data, controller.signal);
      if (controller.signal.aborted) return;
      setSimulation(output); setRevision(value => value + 1); setDirty(edits.current !== submittedEdits);
      if (window.innerWidth < 700) setSettings(false);
    } catch {
      if (!controller.signal.aborted) setError('failed');
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }, []);
  useEffect(() => { void start(structuredClone(DEFAULT_SCENARIO)); return () => { pending.current?.abort(); }; }, [start]);
  useEffect(() => {
    if (error !== 'invalid') return;
    const fields = document.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-sim-field]');
    [...fields].find(field => invalidFields.has(field.dataset.simField ?? ''))?.focus();
  }, [error, invalidFields]);
  const environment = (value: string) => { update(d => {
    d.environment = value === 'MONUMENT' ? 'MONUMENT' : 'PLANET';
    if (d.environment === 'MONUMENT') {
      d.aegisLevel = 0; d.defenceOffline = false; d.automaticEscape = false;
      for (const owner of d.defenders) owner.fleet = Object.fromEntries(fleetEntries(owner.fleet).filter(([id]) => !HULLS[id].ground));
    }
  }); };
  const preset = (value: string) => {
    const next = structuredClone(DEFAULT_SCENARIO);
    if (value === 'shieldDuel') { next.attackers[0]!.fleet = { NULLIFIER: 8, CORSAIR: 4 }; next.defenders[0]!.fleet = { CITADEL: 3, BASTION: 6 }; next.aegisLevel = 2; next.aegisCharge = 100; }
    if (value === 'cargo') { next.environment = 'MONUMENT'; next.aegisLevel = 0; next.attackers[0]!.fleet = { CATACLYSM: 3, CORSAIR: 2 }; next.defenders[0]!.fleet = { DART: 3, ARGOSY: 5, GARBAGE_COLLECTOR: 2 }; }
    if (value === 'artillery') { next.attackers[0]!.fleet = { CORSAIR: 5, NULLIFIER: 3 }; next.defenders[0]!.fleet = { BASTION: 7, THORN: 4, HARPOON: 4 }; next.aegisLevel = 1; }
    edits.current++; setScenario(next); setDirty(true); setError(null); setInvalidFields(new Set()); setPresetName(value);
  };
  return <main className="simulator" data-battle-simulator>
    <header className="sim-header"><button className="sim-brand" type="button" onClick={onLeave} aria-label={t('simulator.back')}>ASTERA<span>ONLINE</span></button>
      <div className="sim-heading"><h1>{t('simulator.title')}</h1><p>{t('simulator.subtitle')}</p></div><LanguageSwitch />
    </header>
    <div className="sim-toolbar">
      <button type="button" className="sim-configure" aria-expanded={settings} onClick={() => { setSettings(value => !value); }}>{t('simulator.configure')}</button>
      <label>{t('simulator.battlefield')}<select aria-label={t('simulator.battlefield')} value={scenario.environment} onChange={event => { environment(event.currentTarget.value); }}>
        <option value="PLANET">{t('simulator.planet')}</option><option value="MONUMENT">{t('simulator.space')}</option></select></label>
      <button type="button" className="sim-primary" disabled={busy} onClick={() => { void start(scenario); }}>{t(busy ? 'simulator.busy' : 'simulator.run')}<span aria-hidden>↗</span></button>
    </div>
    {error && <p className="sim-alert" role="alert">{t(`simulator.${error}`, { limit: SIMULATION_UNIT_LIMIT })}</p>}
    <div className="sim-workbench">
      <aside className={`sim-editor ${settings ? 'is-open' : ''}`} aria-label={t('simulator.settings')}>
        <div className="sim-editor-top"><label className="sim-preset">{t('simulator.preset')}<select value={presetName} onChange={event => { preset(event.currentTarget.value); }}>
          <option value="custom" disabled>{t('simulator.custom')}</option>
          {(['balanced', 'shieldDuel', 'cargo', 'artillery'] as const).map(key => <option key={key} value={key}>{t(`simulator.${key}`)}</option>)}</select></label>
          <div role="tablist">{(['attackers', 'defenders'] as const).map(id => <button key={id} type="button" role="tab" aria-selected={side === id}
          id={`sim-tab-${id}`} aria-controls={`sim-panel-${id}`} onClick={() => { setSide(id); }}>{t(id === 'attackers' ? 'simulator.attacker' : 'simulator.defender')}</button>)}</div>
          <button className="sim-close-settings" type="button" aria-label={t('simulator.close')} onClick={() => { setSettings(false); }}>×</button></div>
        <div className="sim-editor-scroll" role="tabpanel" aria-labelledby={`sim-tab-${side}`} id={`sim-panel-${side}`}>
          <SideEditor side={side} scenario={scenario} update={update} invalidFields={invalidFields} />
          {side === 'defenders' && <label className="sim-setting">{t('simulator.pirate')}<select value={scenario.pirateLevel} onChange={event => {
            const n = Number(event.currentTarget.value); update(d => { d.pirateLevel = n === 1 || n === 2 || n === 3 || n === 4 ? n : 0; });
          }}><option value={0}>{t('simulator.noPirate')}</option>{[1, 2, 3, 4].map(level => <option key={level} value={level}>{t('simulator.pirateLevel', { level })}</option>)}</select></label>}
          <div className="sim-seed"><label>{t('simulator.seed')}<SimulationNumberInput min={0} max={0xffffffff} value={scenario.seed} onValueChange={n => { update(d => { d.seed = n; }); }} /></label>
            <button type="button" onClick={() => { const seed = crypto.getRandomValues(new Uint32Array(1))[0]!; update(d => { d.seed = seed; }); }}>{t('simulator.newSeed')}</button></div>
          <p className="sim-caption">{t('simulator.mechanics', { targets: COMBAT.targetsPerShot })}</p>
        </div>
      </aside>
      <section className="sim-viewer">
        {dirty && <p className="sim-dirty">{t('simulator.changed')}</p>}
        {simulation ? <BattleReplay key={revision} simulation={simulation} environment={simulation.environment} suspended={settings && compact} />
          : error ? <div className="sim-initial-loading"><p>{t(`simulator.${error}`, { limit: SIMULATION_UNIT_LIMIT })}</p><button type="button" onClick={() => { void start(scenario); }}>{t('simulator.retry')}</button></div>
            : <div className="sim-initial-loading" role="status">{t('simulator.stageLoading')}</div>}
        {busy && simulation && <div className="sim-calculating" role="status">{t('simulator.busy')}</div>}
      </section>
    </div>
    <footer className="sim-footer"><span>{t('simulator.hint')}</span><span>ASTERA / FLIGHT OPERATIONS</span></footer>
  </main>;
}
