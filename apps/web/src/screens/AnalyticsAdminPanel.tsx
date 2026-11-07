import { useState } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useApi } from '../api/context.js';
import { Button, Note, Section } from '../v2/kit/Surface.js';
import { schoolCopy } from '../onboarding/flightSchool/copy.js';
import type { AnalyticsTimeline, AnalyticsAdminReport } from '../api/analyticsAdminSchemas.js';
import { analyticsAdminQuerySchema, type AnalyticsFilters } from '../api/analyticsAdminSchemas.js';

/** Internal operator surface. Missing permission/coverage is never represented as zero play. */
export function AnalyticsAdminPanel() {
  const api = useApi(), { i18n, t } = useTranslation();
  const [inactiveHours, setInactiveHours] = useState<0 | 24 | 48 | 72>(24);
  const [filters, setFilters] = useState<AnalyticsFilters & { username?: string }>({});
  const [draft, setDraft] = useState({ build: '', source: '', platform: '', locale: '', trainingVersion: '', username: '' });
  const [filterError, setFilterError] = useState(false);
  const [after, setAfter] = useState<string>();
  const [selected, setSelected] = useState<string | null>(null);
  const [anonymousOpen, setAnonymousOpen] = useState(false), [anonymousAfter, setAnonymousAfter] = useState<string>();
  const [anonymousSelected, setAnonymousSelected] = useState<string | null>(null);
  const anonymous = useQuery({ queryKey: ['admin', 'anonymous-analytics', anonymousAfter], enabled: anonymousOpen,
    queryFn: () => api.analyticsAnonymousVisits(anonymousAfter), refetchOnWindowFocus: false });
  const anonymousTimeline = useInfiniteQuery({ queryKey: ['admin', 'anonymous-analytics-timeline', anonymousSelected], enabled: anonymousSelected !== null,
    initialPageParam: null as AnalyticsTimeline['nextBefore'], queryFn: ({ pageParam }) => api.analyticsAnonymousTimeline(anonymousSelected!, pageParam ?? undefined),
    getNextPageParam: page => page.nextBefore ?? undefined, refetchOnWindowFocus: false });
  const report = useQuery({ queryKey: ['admin', 'player-analytics', inactiveHours, after, filters],
    queryFn: () => api.analyticsAdmin({ ...filters, inactiveHours, after }), staleTime: 60_000, refetchOnWindowFocus: false });
  const timeline = useInfiniteQuery({ queryKey: ['admin', 'player-analytics-timeline', selected, filters], enabled: selected !== null,
    initialPageParam: null as AnalyticsTimeline['nextBefore'],
    queryFn: ({ pageParam }) => api.analyticsTimeline(selected!, pageParam ?? undefined, {
      build: filters.build, source: filters.source, platform: filters.platform, locale: filters.locale, trainingVersion: filters.trainingVersion }),
    getNextPageParam: page => page.nextBefore ?? undefined, refetchOnWindowFocus: false });
  const locale = i18n.resolvedLanguage ?? 'tr';
  const date = (value: Date | null) => value ? new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(value) : 'Bilinmiyor';
  const minutes = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value / 60_000);
  const returned = (value: { mature: boolean; returned: boolean | null }) => !value.mature ? 'Henüz değerlendirilemez' : value.returned ? 'Dönüş gözlendi' : 'Dönüş gözlenmedi';
  const evidence = (event: NonNullable<AnalyticsAdminReport['players'][number]['summary']>['lastObservation']) =>
    event ? `${event.properties.surface ?? event.properties.code ?? event.name} · ${date(new Date(event.at))}` : 'Bilinmiyor';
  const chapters = schoolCopy(locale).chapters;
  return <div className="space-y-4 py-3" data-analytics-admin>
    <Note>Bu rapor gözlenen kayıtları gösterir. Kayıtsız ziyaretler oyuncu hesaplarıyla birleştirilmez. Kesin çıkış zamanı ve oyunu bırakma nedeni bu veriden tek başına belirlenemez. Saatler: {Intl.DateTimeFormat().resolvedOptions().timeZone}.</Note>
    <div className="flex flex-wrap gap-2"><Button onClick={() => { setInactiveHours(24); setAfter(undefined); }}>24 saattir görülmeyenler</Button>
      <Button onClick={() => { setInactiveHours(48); setAfter(undefined); }}>48 saattir görülmeyenler</Button>
      <Button onClick={() => { setInactiveHours(72); setAfter(undefined); }}>72 saattir görülmeyenler</Button>
      <Button onClick={() => { setInactiveHours(0); setAfter(undefined); }}>Tüm hesaplar</Button>
      <Button onClick={() => { void report.refetch(); }}>Yenile</Button></div>
    <details className="rounded-control border border-v2-line p-3"><summary className="min-h-11 cursor-pointer text-caption">Ölçüm filtreleri</summary>
      <form className="grid grid-cols-2 gap-2" onSubmit={event => {
        event.preventDefault();
        const parsed = analyticsAdminQuerySchema.safeParse(Object.fromEntries(Object.entries(draft).filter(([, value]) => value !== '')));
        setFilterError(!parsed.success);
        if (parsed.success) {
          const { build, source, platform, locale: language, trainingVersion, username } = parsed.data;
          setFilters({ build, source, platform, locale: language, trainingVersion, username }); setAfter(undefined); setSelected(null);
        }
      }}>
        {([['build', 'İstemci sürümü'], ['trainingVersion', 'Eğitim sürümü'], ['source', 'Kampanya kaynağı'],
          ['locale', 'Dil kodu'], ['username', 'Hesap adı']] as const).map(([key, label]) => <label key={key} className="min-w-0 text-micro text-v2-ink-2">{label}
          <input className="mt-1 min-h-11 w-full rounded-control border border-v2-line bg-v2-deep px-2 text-label" maxLength={128} value={draft[key]}
            onChange={event => { setDraft(previous => ({ ...previous, [key]: event.target.value })); }} /></label>)}
        <label className="min-w-0 text-micro text-v2-ink-2">Platform<select className="mt-1 min-h-11 w-full rounded-control border border-v2-line bg-v2-deep px-2 text-label" value={draft.platform}
          onChange={event => { setDraft(previous => ({ ...previous, platform: event.target.value })); }}><option value="">Tümü</option><option value="web">Web</option><option value="android">Android</option><option value="ios">iOS</option></select></label>
        <Button type="submit">Filtrele</Button><Button onClick={() => { setDraft({ build: '', source: '', platform: '', locale: '', trainingVersion: '', username: '' }); setFilters({}); setAfter(undefined); setSelected(null); setFilterError(false); }}>Temizle</Button>
        {filterError && <p role="alert" className="col-span-2 text-label text-v2-warn">Sürüm ve dil için yalnız harf, sayı, nokta, tire veya alt çizgi kullan.</p>}
      </form><p className="mt-2 text-micro text-v2-ink-3">Filtreler ziyaretleri ve onlara bağlı olayları seçer. Geçmiş yalnız saklama penceresi içindedir. Hesap adı tam eşleşir; inaktiflik listesi son sunucu etkinliğine dayanır.</p>
    </details>
    {report.isPending && <p role="status">Ölçüm yükleniyor…</p>}
    {report.isError && <p role="alert">Ölçüm raporu alınamadı. Yenile ile tekrar dene.</p>}
    {report.data && <>
      <Section label="Ölçüm kapsamı"><p className="text-label text-v2-ink-2">Hesapların {report.data.quality.measuredAccounts}/{report.data.quality.totalAccounts} tanesinde ölçüm var. {report.data.quality.visits} ziyaret. Saati güvenilir olmayan olay: {report.data.quality.untrusted}.</p>
        <p className="mt-1 text-micro text-v2-ink-3">Ham veri penceresi: {date(report.data.windowStart)} – {date(report.data.measuredAt)}. Ölçülmeyen hesaplar dönüş oranına sıfır olarak eklenmez.</p></Section>
      <Section label="Ana sayfa → Eğitim"><p className="text-label">Ana sayfa: {report.data.landing.visibleVisits} ziyaret · Play: {report.data.landing.playVisits} · Eğitime başladı: {report.data.landing.trainingVisits}<br />Giriş düğmesi: {report.data.landing.loginVisits} · Eğitime ulaşma hatası: {report.data.landing.loadFailedVisits}</p></Section>
      <Section label="Eğitim — 11 adım"><ol aria-label="Eğitim adımları" className="divide-y divide-v2-line rounded-control border border-v2-line">
        {report.data.steps.map(step => <li key={step.step} className="flex justify-between gap-2 px-3 py-2 text-label"><span>{step.step}. {chapters[step.step - 1]}</span><span>{step.attempts} deneme</span></li>)}
      </ol><p className="mt-1 text-micro text-v2-ink-3">Her satır o adımı gören farklı eğitim denemeleridir. Alt sahneler kayıtsız ziyaret zaman çizelgesinde görünür.</p></Section>
      <details className="rounded-control border border-v2-line p-3"><summary className="min-h-11 cursor-pointer text-caption">Sürüm, kaynak ve platform kesitleri</summary>
        <p className="text-micro text-v2-ink-3">Kesitler ziyaret tabanlıdır. Aynı hesap farklı kesitlerde bulunabilir. İlk gözlenen açılışa göre D1: 24–48, D3: 72–96, D7: 168–192 saat.</p>
        {report.data.cohorts.map((cohort, index) => <div key={index} className="break-words border-t border-v2-line py-2 text-label">
          {cohort.platform} · {cohort.locale} · {cohort.source ?? 'Kaynak bilinmiyor'} · {cohort.visits} ziyaret / {cohort.accounts} hesap
          <code className="block break-all text-micro text-v2-ink-3">{cohort.build}</code>
          {cohort.retention && <p className="text-micro text-v2-ink-3">İlk gözlenen hazır ziyaret: {cohort.anchorAccounts} hesap. D1 / D3 / D7: {[cohort.retention.d1, cohort.retention.d3, cohort.retention.d7].map(window => `${window.returned}/${window.mature} değerlendirilebilir, ${window.pending} bekliyor`).join(' · ')}</p>}
        </div>)}{report.data.cohortsTruncated && <p className="text-micro text-v2-warn">En çok ziyaret alan 50 kesit gösteriliyor.</p>}
      </details>
      {report.data.starter && <Section label={t('starter.funnel.title')}><div data-starter-funnel className="space-y-2 text-caption text-v2-ink-2">
        <p>{t('starter.funnel.sessions', { accounts: report.data.starter.accounts, sessions: report.data.starter.sessions, returned: report.data.starter.returnedAccounts })}</p>
        <p>{t('starter.funnel.push', report.data.starter.push)}</p>
        <p>{t('starter.funnel.crates', report.data.starter.crates)}</p>
        <details><summary className="min-h-9 cursor-pointer">{t('starter.funnel.steps')}</summary>
          {report.data.starter.steps.map(step => <p key={step.scene} className="flex justify-between gap-2 border-t border-v2-line py-1"><code>{step.scene}</code><span>{t('starter.funnel.dropoff', step)}</span></p>)}
        </details>
      </div></Section>}
      <Section label="Oyuncular"><div className="space-y-2">{report.data.players.map(player => <article key={player.accountId} className="rounded-control border border-v2-line bg-v2-panel p-3">
        <button type="button" className="min-h-11 w-full text-left text-caption font-semibold text-v2-self" aria-expanded={selected === player.accountId}
          onClick={() => { setSelected(selected === player.accountId ? null : player.accountId); }}>{player.username}</button>
        <p className="text-label text-v2-ink-2">{player.galaxy ?? 'Yerleşim yok'} · Son sunucu etkinliği: {date(player.lastActiveAt)}</p>
        <p className="text-micro text-v2-ink-3">Saklanan hesaplı ziyaretlerde ilk kaynak: {player.firstVisit?.campaign.utm_source ?? 'Bilinmiyor'} · Son kaynak: {player.currentVisit?.campaign.utm_source ?? 'Bilinmiyor'}. Kayıt öncesi ziyaret dahil değildir.</p>
        {player.summary ? <>
          <p className="mt-1 text-label">{player.summary.sessions.length} gözlenen oturum · {minutes(player.summary.foregroundMs)} dakika ön planda · {minutes(player.summary.interactionMs)} dakika etkileşim</p>
          <p className="text-label text-v2-ink-2">{player.summary.commands} doğrulanmış işlem · Son eğitim adımı: {player.summary.lastTraining?.step ?? 'Bilinmiyor'}</p>
          <div className="mt-2 space-y-1 break-words text-label text-v2-ink-2">
            <p>Son yüzey: {evidence(player.summary.lastSurface)}</p>
            <p>Son kesin işlem: {evidence(player.summary.lastCommand)}</p>
            <p>Son görünen engel: {evidence(player.summary.lastBlocker)}</p>
            <p>Son sonuç: {evidence(player.summary.lastOutcome)}</p>
            <p className="text-micro text-v2-ink-3">Son gözlem: {evidence(player.summary.lastObservation)}. Sonucun oluşması, oyuncunun gördüğü anlamına gelmez.</p>
          </div>
          <p className="text-micro text-v2-ink-3">İlk 24 saatte ayrı oturum: {returned(player.summary.return24h)}<br />
            D1 / D3 / D7: {[player.summary.retention.d1, player.summary.retention.d3, player.summary.retention.d7].map(returned).join(' / ')}<br />
            Manuel işlemle D1 / D3 / D7: {[player.summary.manualRetention.d1, player.summary.manualRetention.d3, player.summary.manualRetention.d7].map(returned).join(' / ')}</p>
          <details className="mt-2 text-micro text-v2-ink-2"><summary className="min-h-11 cursor-pointer">Oturum aralıkları</summary><ol>{player.summary.sessions.map((session, index) => <li key={index} className="py-1">
            {date(new Date(session.start))} → Son gözlem: {date(new Date(session.end))} · {session.ending === 'observed_background' ? 'Arka plana geçiş gözlendi' : session.ending === 'open' ? 'Açık' : 'Kapanış gözlenmedi'}
          </li>)}</ol></details>
        </> : <p className="mt-1 text-label text-v2-warn">{player.truncated ? 'Olay sınırı aşıldı; toplam süre ve dönüş hesaplanmadı.' : 'Davranış ölçümü yok'}</p>}
        {selected === player.accountId && <div className="mt-3 space-y-2 border-t border-v2-line pt-2">
          {timeline.isPending && <p role="status">Olaylar yükleniyor…</p>}
          {timeline.isError && <p role="alert">Olaylar alınamadı.</p>}
          {timeline.data && timeline.data.pages[0]?.events.length === 0 && <p>Bu hesap için gözlenen olay yok.</p>}
          <ol className="space-y-2">{timeline.data?.pages.flatMap(page => page.events).map(event => <li key={event.id} className="break-words text-micro">
            <time>{date(event.occurredAt)}</time> · {event.name} · {event.mode} · {event.source}
            {event.properties.step && ` · Adım ${String(event.properties.step)}`}{event.properties.scene && ` · ${event.properties.scene}`}
            {event.properties.code && ` · ${event.properties.code}`}{!event.timeTrusted && ' · İstemci saati güvenilir değil'}
          </li>)}</ol>
          {timeline.hasNextPage && <Button disabled={timeline.isFetchingNextPage} onClick={() => { void timeline.fetchNextPage(); }}>Önceki olaylar</Button>}
        </div>}
      </article>)}</div>
      {report.data.players.length === 0 && <p>Bu filtrede hesap yok.</p>}
      {report.data.nextAfter && <Button onClick={() => { setAfter(report.data.nextAfter ?? undefined); }}>Sonraki hesaplar</Button>}</Section>
    </>}
    <Section label="Kayıtsız ziyaretler"><Button onClick={() => { setAnonymousOpen(previous => !previous); }}>Hesaba bağlanmayan ziyaretler</Button>
      {anonymousOpen && <><p className="text-micro text-v2-ink-3">Geçici ziyaret kimliği kişiyi veya hesabı tanımlamaz. Yenilenen sayfa yeni ziyarettir. Oyuncu dönüş oranıyla birleştirilmez.</p>
        {anonymous.isPending && <p role="status">Ziyaretler yükleniyor…</p>}{anonymous.isError && <p role="alert">Ziyaretler alınamadı.</p>}
        {anonymous.data?.visits.map(visit => <div key={visit.id} className="border-t border-v2-line py-2">
          <button className="min-h-11 text-left text-label text-v2-self" onClick={() => { setAnonymousSelected(anonymousSelected === visit.id ? null : visit.id); }}>{date(visit.createdAt)} · {visit.metadata.platform} · {visit.metadata.campaign.utm_source ?? 'Kaynak bilinmiyor'}</button>
          {anonymousSelected === visit.id && <>{anonymousTimeline.isError && <p role="alert">Olaylar alınamadı.</p>}
            <ol className="break-words text-micro">{anonymousTimeline.data?.pages.flatMap(page => page.events).map(event => <li key={event.id}>{date(event.occurredAt)} · {event.name}{event.properties.step ? ` · Adım ${event.properties.step}` : ''}</li>)}</ol>
            {anonymousTimeline.hasNextPage && <Button disabled={anonymousTimeline.isFetchingNextPage} onClick={() => { void anonymousTimeline.fetchNextPage(); }}>Önceki ziyaret olayları</Button>}</>}
        </div>)}{anonymous.data?.nextAfter && <Button onClick={() => { setAnonymousAfter(anonymous.data.nextAfter ?? undefined); }}>Sonraki ziyaretler</Button>}
      </>}
    </Section>
  </div>;
}
