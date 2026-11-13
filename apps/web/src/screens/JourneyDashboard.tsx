import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '../api/context.js';
import { summarizeJourney } from '../api/journeyModel.js';
import { JOURNEY_STAGES, journeyQuerySchema, type JourneyPlayer, type JourneyQuery, type JourneyReport } from '../api/journeySchemas.js';
import { journeyLabel, STAGE_LABELS } from './journeyLabels.js';
import './journey.css';

const date = (at: number | null) => at === null ? 'Bilinmiyor' : new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short' }).format(at);
const duration = (ms: number | null) => ms === null ? 'Bilinmiyor' : ms < 60_000 ? `${Math.round(ms / 1000)} sn` : `${(ms / 60_000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} dk`;
const BUCKET_LABELS = ['1 dk altı', '1–3 dk', '3–10 dk', '10–30 dk', '30 dk ve üzeri'];
const HISTORY_LABELS = { command: 'İşlem', result: 'Görülen sonuç', screen: 'Ekran', guide: 'Rehber', blocker: 'Engel', error: 'Hata', background: 'Oturum' };
type Stage = JourneyPlayer['stage'];

function Panel({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return <section className="journey-panel"><header className="journey-panel-head"><h3>{title}</h3>{aside}</header>{children}</section>;
}

export function JourneyDashboard() {
  const api = useApi();
  const [query, setQuery] = useState<JourneyQuery>({ hours: 24, absentMinutes: 30 });
  const [draft, setDraft] = useState({ from: '', to: '' });
  const [invalid, setInvalid] = useState(false);
  const report = useQuery({ queryKey: ['admin', 'journey', query], queryFn: () => api.analyticsJourney(query), staleTime: 60_000, refetchOnWindowFocus: false });
  return <div className="journey-dashboard" data-journey-dashboard>
    <header className="journey-heading"><div><h2>Oyuncu yolculuğu</h2><p>İlk hamleden ana galaksiye. Oyuncuların ne yaptığını, nerede durduğunu ve nelerin önlerine çıktığını incele.</p></div>
      <button className="journey-button" disabled={report.isFetching} onClick={() => { void report.refetch(); }}>{report.isFetching ? 'Güncelleniyor…' : 'Yenile'}</button>
    </header>
    <div className="journey-controls"><div className="journey-presets" aria-label="Kayıt aralığı">
      {[[4, 'Son 4 saat'], [24, 'Son 24 saat'], [168, 'Son 7 gün']].map(([hours, label]) => <button key={hours} className="journey-button" aria-pressed={!query.from && query.hours === hours}
        onClick={() => { setQuery(previous => ({ hours: Number(hours), absentMinutes: previous.absentMinutes })); setDraft({ from: '', to: '' }); setInvalid(false); }}>{label}</button>)}
    </div><label>Hareketsizlik eşiği<select value={Number(query.absentMinutes)} onChange={event => {
      const parsed = journeyQuerySchema.safeParse({ ...query, absentMinutes: event.target.value });
      if (parsed.success) setQuery(parsed.data);
    }}><option value="30">30 dakika</option><option value="60">1 saat</option><option value="1440">24 saat</option></select></label>
      <details className="journey-dates"><summary>Özel kayıt aralığı</summary><form onSubmit={event => {
        event.preventDefault();
        const start = Date.parse(draft.from), end = Date.parse(draft.to);
        if (!Number.isFinite(start) || draft.to && !Number.isFinite(end)) { setInvalid(true); return; }
        const parsed = journeyQuerySchema.safeParse({ from: new Date(start).toISOString(), ...(draft.to ? { to: new Date(end).toISOString() } : {}), absentMinutes: query.absentMinutes });
        setInvalid(!parsed.success); if (parsed.success) setQuery(parsed.data);
      }}><label>Kayıt başlangıcı<input type="datetime-local" required value={draft.from} onChange={e => { setDraft(previous => ({ ...previous, from: e.target.value })); }} /></label>
        <label>Kayıt bitişi<input type="datetime-local" value={draft.to} onChange={e => { setDraft(previous => ({ ...previous, to: e.target.value })); }} /></label>
        <button className="journey-button" type="submit">Aralığı uygula</button>
        {invalid && <p role="alert">Başlangıç ve bitiş tarihlerini kontrol et.</p>}
      </form></details>
    </div>
    {report.isPending && <p role="status" className="journey-notice">Oyuncuların yolculuğu hazırlanıyor…</p>}
    {report.isError && <div role="alert" className="journey-notice journey-warning">Yolculuk raporu alınamadı. Kayıt aralığı son 30 gün içinde olmalı.<button className="journey-button" onClick={() => { void report.refetch(); }}>Yeniden dene</button></div>}
    {report.data && <JourneyReportView key={`${report.data.from}:${report.data.to}:${report.data.absentMinutes}`} report={report.data} />}
  </div>;
}

export function JourneyReportView({ report }: { report: JourneyReport }) {
  const [stage, setStage] = useState<Stage | null>(null);
  const [mapMode, setMapMode] = useState<'reached' | 'absent'>('reached');
  const [band, setBand] = useState<number | null>(null);
  const [listMode, setListMode] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('joined');
  const [selected, setSelected] = useState<string | null>(null);
  const cohort = useMemo(() => summarizeJourney(report.players), [report.players]);
  const absent = report.players.filter(p => p.activity === 'absent');
  const waiting = absent.filter(p => p.waitingAtLastActivity !== null).length;
  const errors = report.players.filter(p => p.errors.length > 0).length;
  const filtered = report.players.filter(p => (!search || p.username.toLocaleLowerCase('tr').includes(search.toLocaleLowerCase('tr')))
    && (!stage || (mapMode === 'reached' ? p.milestones.includes(stage) : p.stage === stage && p.activity === 'absent'))
    && (band === null || p.durationQuality === 'observed' && p.foregroundMs !== null && p.foregroundMs >= (cohort.durationBuckets[band]?.min ?? 0) && p.foregroundMs < (cohort.durationBuckets[band]?.max ?? Infinity))
    && (listMode !== 'absent' || p.activity === 'absent') && (listMode !== 'quality' || p.durationQuality !== 'observed')
    && (listMode !== 'errors' || p.errors.length > 0)).toSorted((a, b) => sort === 'time' ? (b.foregroundMs ?? -1) - (a.foregroundMs ?? -1)
    : sort === 'progress' ? JOURNEY_STAGES.indexOf(b.stage) - JOURNEY_STAGES.indexOf(a.stage) : b.joinedAt - a.joinedAt);
  const reset = () => { setStage(null); setBand(null); setListMode('all'); setSearch(''); };
  const observedTotal = report.players.reduce((sum, p) => sum + (p.foregroundMs ?? 0), 0);
  return <>
    <p className="journey-caption">Kayıt: {date(report.from)} – {date(report.to)}. Bu hesapların ilerlemesi {date(report.measuredAt)} anına kadar izlenir. Saatler: {Intl.DateTimeFormat().resolvedOptions().timeZone}.</p>
    {report.truncated && <p role="alert" className="journey-notice journey-warning">Veri sınırına ulaşıldı. Grafikler kısmi veri içeriyor; kayıt aralığını daralt. {report.players.length}/{report.totalAccounts} hesap listeleniyor.</p>}
    <div className="journey-summary">
      <div className="journey-total"><strong>{report.totalAccounts}</strong><span>yeni oyuncu hesabı</span><small>Bot ve admin hesapları hariç</small></div>
      <div><span>Gözlenen ön plan</span><strong>{duration(report.players.some(p => p.foregroundMs !== null) ? observedTotal : null)}</strong><small>Eksik kayıtlarda gerçek süre daha uzun olabilir</small></div>
      <div><span>Ortanca süre</span><strong>{duration(cohort.medianMs)}</strong><small>Ölçümü tutarlı {cohort.measured} hesapta · ortalama {duration(cohort.averageMs)}</small></div>
      <div><span>{report.absentMinutes} dk hareket yok</span><strong>{absent.length}<em> / {report.players.length}</em></strong><small>{waiting} hesapta son harekette bekleyen iş vardı</small></div>
    </div>
    <div className="journey-main-grid">
      <Panel title="İlerleme haritası" aside={<div className="journey-switch"><button aria-pressed={mapMode === 'reached'} onClick={() => { setMapMode('reached'); setStage(null); }}>Ulaşanlar</button><button aria-pressed={mapMode === 'absent'} onClick={() => { setMapMode('absent'); setStage(null); }}>Ara verme noktaları</button></div>}>
        <p className="journey-caption">{mapMode === 'reached' ? 'Her aşamaya ulaşan hesaplar. Aşamalar bağımsızdır; sırayı atlamak kayıp sayılmaz.' : `Son doğrulanan aşamasında en az ${report.absentMinutes} dakikadır hareket görülmeyen hesaplar.`} Bir satıra dokunarak oyuncuları incele.</p>
        <div className="journey-stage-map">{cohort.stages.map((entry, index) => {
          const count = mapMode === 'reached' ? entry.reached : entry.absent;
          return <button key={entry.id} className="journey-stage" aria-label={`${STAGE_LABELS[entry.id]} ${count}/${report.players.length}`} aria-pressed={stage === entry.id} onClick={() => { setStage(stage === entry.id ? null : entry.id); setBand(null); }}>
            <span className="journey-stage-name"><i aria-hidden="true">{index + 1}</i>{STAGE_LABELS[entry.id]}</span>
            <span className={`journey-track ${mapMode === 'absent' ? 'journey-amber' : ''}`} aria-hidden="true"><span style={{ width: `${report.players.length ? count / report.players.length * 100 : 0}%` }} /></span>
            <strong>{count}<span>/{report.players.length}</span></strong>
          </button>;
        })}</div>
      </Panel>
      <div className="journey-side">
        <Panel title="Oynama süresi dağılımı" aside={<span className="journey-count">{cohort.measured} hesap</span>}>
          <div className="journey-histogram" role="group" aria-label="Oynama süresi dağılımı">{cohort.durationBuckets.map((bucket, index) => <button key={index} aria-pressed={band === index}
            onClick={() => { setBand(band === index ? null : index); setStage(null); }}>
            <span>{BUCKET_LABELS[index]}</span><span className="journey-track" aria-hidden="true"><span style={{ width: `${cohort.measured ? bucket.count / cohort.measured * 100 : 0}%` }} /></span><strong>{bucket.count}</strong>
          </button>)}</div>
          <p className="journey-caption">{cohort.durationMissing} hesapta süre ölçümü yok. {cohort.durationPartial} hesapta kısmi. Bu hesaplar dağılıma ve ortalamaya eklenmez.</p>
        </Panel>
        <Panel title="İncelenecek noktalar">
          <button className="journey-signal" onClick={() => { setListMode('errors'); setStage(null); setBand(null); }}><span><b>{errors}</b> hesapta istemci hatası</span><span aria-hidden="true">↗</span></button>
          <button className="journey-signal" onClick={() => { setListMode('quality'); setStage(null); setBand(null); }}><span><b>{cohort.durationMissing + cohort.durationPartial}</b> hesapta süre ölçümü eksik</span><span aria-hidden="true">↗</span></button>
          <p className="journey-caption">Kesin bırakma nedeni ölçülmez. Bir işlem veya onarım oyuncu yokken tamamlanabilir; bu, geri döndüğü anlamına gelmez.</p>
        </Panel>
      </div>
    </div>
    <div className="journey-secondary-grid"><ArrivalChart report={report} /><BlockerChart players={report.players} /></div>
    <Panel title="Oyuncular" aside={<span className="journey-count">{filtered.length}/{report.players.length} hesap</span>}>
      <div className="journey-list-controls"><label>Hesap ara<input type="search" value={search} onChange={e => { setSearch(e.target.value); }} placeholder="Oyuncu adı" /></label>
        <label>Göster<select value={listMode} onChange={e => { setListMode(e.target.value); }}><option value="all">Tüm hesaplar</option><option value="absent">Hareket görülmeyenler</option><option value="quality">Ölçümü eksik olanlar</option><option value="errors">Hata yaşayanlar</option></select></label>
        <label>Sırala<select value={sort} onChange={e => { setSort(e.target.value); }}><option value="joined">En yeni kayıt</option><option value="time">En uzun gözlenen süre</option><option value="progress">En ileri aşama</option></select></label>
      </div>
      {(stage !== null || band !== null || listMode !== 'all' || search.length > 0) && <div className="journey-filter-caption"><span>{stage ? STAGE_LABELS[stage] : band !== null ? BUCKET_LABELS[band] : 'Oyuncu filtresi'}</span><button className="journey-button" onClick={reset}>Filtreyi temizle</button></div>}
      {report.players.length === 0 ? <p className="journey-empty">Bu kayıt aralığında oyuncu yok.</p> : filtered.length === 0 ? <p className="journey-empty">Bu filtreye uyan oyuncu yok. Filtreyi temizleyerek tüm hesapları gör.</p> : <div className="journey-players">{filtered.map(player => <article key={player.accountId} className="journey-player">
        <button className="journey-player-toggle" aria-expanded={selected === player.accountId} onClick={() => { setSelected(selected === player.accountId ? null : player.accountId); }}>
          <span><strong>{player.username}</strong><small>{player.galaxy ?? 'Henüz gemiye katılmadı'}</small></span>
          <span className="journey-player-progress"><span>{STAGE_LABELS[player.stage]}</span><span className="journey-dots" aria-hidden="true">{JOURNEY_STAGES.map(id => <i key={id} className={player.milestones.includes(id) ? 'is-reached' : ''} />)}</span></span>
          <span className="journey-player-time"><strong>{player.durationQuality === 'partial' ? '≥ ' : ''}{duration(player.foregroundMs)}</strong><small>{player.durationQuality === 'observed' ? 'ön planda' : player.durationQuality === 'partial' ? 'kısmi ölçüm' : 'ölçüm eksik'}</small></span>
          <span className={`journey-activity ${player.activity === 'absent' ? 'is-absent' : ''}`}>{player.activity === 'recent' ? 'Yakın zamanda etkin' : player.activity === 'absent' ? `${report.absentMinutes} dk hareket yok` : 'Etkinlik bilinmiyor'}</span>
        </button>
        {selected === player.accountId && <PlayerDetail player={player} />}
      </article>)}</div>}
    </Panel>
  </>;
}

function PlayerDetail({ player }: { player: JourneyPlayer }) {
  return <div className="journey-detail">
    <dl><div><dt>Kayıt</dt><dd>{date(player.joinedAt)}</dd></div><div><dt>Son etkinlik kanıtı</dt><dd>{date(player.lastActiveAt)}</dd></div>
      <div><dt>Son doğrulanan işlem</dt><dd>{player.lastCommand ? `${journeyLabel(player.lastCommand.code)} · ${date(player.lastCommand.at)}` : 'İşlem kaydı yok'}</dd></div>
      <div><dt>Son rehber adımı</dt><dd>{player.lastTutorial ? journeyLabel(player.lastTutorial.code) : 'Ölçülmedi'}{player.guideSkipped ? ' · Rehberi kapattı' : ''}</dd></div>
      <div><dt>Son ekran</dt><dd>{player.lastSurface ? journeyLabel(player.lastSurface.code) : 'Ölçülmedi'}</dd></div>
      <div><dt>Gözlenen etkileşim</dt><dd>{duration(player.interactionMs)}</dd></div>
    </dl>
    {player.durationQuality === 'missing' && <p className="journey-notice journey-warning">Oynama süresi bilinmiyor.{player.sampledForegroundMs > 0 ? ` Ön plan örnekleri: ${duration(player.sampledForegroundMs)}; oynanış süresi doğrulanamadı.` : ''}</p>}
    {player.durationQuality === 'partial' && <p className="journey-notice journey-warning">Bu süre kısmi. Sunucu etkinliği ile istemci kaydı arasında boşluk var veya kayıt sınırına ulaşıldı. Son görülme aralığı oynama süresi sayılmaz.</p>}
    {player.waitingAtLastActivity && <p className="journey-notice">Son etkinlik anında {player.waitingAtLastActivity.count} iş bekliyordu. İlk planlanan bitiş: {date(player.waitingAtLastActivity.nextAt)}. Ayrılma nedeni olarak yorumlanamaz.</p>}
    <h4>Son 20 olay ve işlem</h4><ol className="journey-timeline">{player.history.map((entry, index) => <li key={`${entry.at}:${index}`} className={`journey-event-${entry.kind}`}>
      <time>{date(entry.at)}</time><span><small>{HISTORY_LABELS[entry.kind]}</small>{journeyLabel(entry.code)}</span>
    </li>)}</ol>{player.history.length === 0 && <p className="journey-caption">Bu hesapta ayrıntılı olay kaydı yok.</p>}
  </div>;
}

function ArrivalChart({ report }: { report: JourneyReport }) {
  const bins = Array.from({ length: 12 }, () => 0);
  const span = Math.max(1, report.to - report.from);
  for (const player of report.players) {
    const index = Math.max(0, Math.min(11, Math.floor((player.joinedAt - report.from) / span * 12)));
    bins[index] = (bins[index] ?? 0) + 1;
  }
  const max = Math.max(1, ...bins);
  return <Panel title="Yeni oyuncu akışı" aside={<span className="journey-count">Kayıt zamanı</span>}>
    <div className="journey-arrivals" role="img" aria-label={`Kayıt aralığında ${report.players.length} yeni hesap`}>
      {bins.map((count, index) => <div key={index} title={`${date(report.from + index / 12 * span)}: ${count} hesap`}>
        <span>{count}</span><i aria-hidden="true" style={{ height: `${count / max * 90}px` }} />
      </div>)}
    </div><div className="journey-axis"><span>{date(report.from)}</span><span>{date(report.to)}</span></div>
  </Panel>;
}

function BlockerChart({ players }: { players: JourneyPlayer[] }) {
  const counts = new Map<string, number>();
  for (const p of players) for (const code of new Set(p.blockers.map(b => b.code))) counts.set(code, (counts.get(code) ?? 0) + 1);
  const rows = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 5);
  return <Panel title="Görülen engeller" aside={<span className="journey-count">Hesap bazında</span>}>
    {rows.length ? <div className="journey-blockers">{rows.map(([code, count]) => <div key={code}><span>{journeyLabel(code)}</span><span className="journey-track journey-amber" aria-hidden="true"><span style={{ width: `${players.length ? count / players.length * 100 : 0}%` }} /></span><strong>{count}/{players.length}</strong></div>)}</div>
      : <p className="journey-empty">Gözlenen engel yok. Bu, engel yaşanmadığını kanıtlamaz; istemci ölçümü eksik olabilir.</p>}
    <p className="journey-caption">Aynı hesap birden fazla engelde yer alabilir. Engel görülmesi, oyuncunun o nedenle ayrıldığını göstermez.</p>
  </Panel>;
}
