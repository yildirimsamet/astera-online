import { useId, useMemo, useRef, useState, type ReactNode, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import { PLANET_SKIN_IDS, type PlanetSkinId } from '@astera/rules';
import { useAdminFeedback, usePublishAnnouncement } from '../api/queries.js';
import { useApi } from '../api/context.js';
import { ApiError } from '../api/client.js';
import {
  retryPerfSession, startPerfSession, stopPerfSession, usePerfSession,
} from '../lib/perfSession.js';
import { formatClock } from '../ui/FpsReadout.js';
import type { FeedbackKind } from '../api/schemas.js';
import { describeError } from '../i18n/errors.js';
import { RichContent } from '../ui/RichContent.js';
import { Unreachable, Waiting } from '../ui/kit/index.js';
import { Button, EmptyState, Note } from '../v2/kit/Surface.js';
import { Segmented } from '../v2/kit/Segmented.js';
import { Icon } from '../v2/icons.js';
import { PLANET_SKIN_CATALOG, SKIN_COLLECTIONS } from '../ui/skinCatalog.js';
import { HeartIcon } from '../ui/icons/index.js';

type AdminTab = 'COMPOSE' | 'FEEDBACK' | 'PERF' | 'SKINS' | 'SUPPORTERS';

const ADMIN_TAB_ID: Record<AdminTab, string> = {
  COMPOSE: 'admin-compose-tab',
  FEEDBACK: 'admin-feedback-tab',
  PERF: 'admin-perf-tab',
  SKINS: 'admin-skins-tab',
  SUPPORTERS: 'admin-supporters-tab',
};

/** The Gözlemevi field: one height, one border, your colour when it has the caret. */
const FIELD = 'h-10 w-full rounded-control border border-v2-line-hi bg-v2-deep px-3 text-caption text-v2-ink placeholder:text-v2-ink-3 outline-none focus:border-v2-self';
const LABEL = 'text-micro font-semibold uppercase tracking-wide text-v2-ink-3';

/**
 * THE OPERATOR'S DESK, IN THE GÖZLEMEVI LANGUAGE (owner 2026-09-27: every surface this work
 * touched redrawn to the ui-v2 standard). Announcements, feedback, performance recordings,
 * Shopier skin grants and permanent manual supporter recognition.
 */
export default function AdminPanel() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<AdminTab>('COMPOSE');
  return (
    <div className="flex h-full min-h-0 flex-col font-v2-ui">
      <div className="shrink-0 px-2 py-2.5 [&_[role=tablist]]:grid-cols-3 [&_[role=tablist]]:grid-flow-row sm:[&_[role=tablist]]:grid-cols-none sm:[&_[role=tablist]]:grid-flow-col">
        <Segmented
          label={t('community.admin.tabsLabel')}
          value={tab}
          onChange={setTab}
          tabId={(id) => ADMIN_TAB_ID[id]}
          options={[
            { id: 'COMPOSE', label: t('community.admin.composeTab') },
            { id: 'FEEDBACK', label: t('community.admin.feedbackTab') },
            { id: 'PERF', label: t('community.admin.perfTab') },
            { id: 'SKINS', label: t('community.admin.skinsTab') },
            { id: 'SUPPORTERS', label: t('community.admin.supportersTab') },
          ]}
        />
      </div>
      <div
        role="tabpanel"
        aria-labelledby={ADMIN_TAB_ID[tab]}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-6"
      >
        {tab === 'COMPOSE' ? <AnnouncementComposer />
          : tab === 'FEEDBACK' ? <AdminFeedbackList />
            : tab === 'PERF' ? <PerfRecorderPanel />
              : tab === 'SKINS' ? <SkinGrantForm /> : <SupporterForm />}
      </div>
    </div>
  );
}

function AnnouncementComposer() {
  const { t } = useTranslation();
  const titleId = useId();
  const [title, setTitle] = useState('');
  const [html, setHtml] = useState('<p></p>');
  const [editorVersion, setEditorVersion] = useState(0);
  const [published, setPublished] = useState(false);
  const publish = usePublishAnnouncement();

  const submit = (event: SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!title.trim() || html === '<p></p>' || publish.isPending) return;
    publish.mutate({ title: title.trim(), bodyHtml: html }, {
      onSuccess: () => {
        setTitle('');
        setHtml('<p></p>');
        setEditorVersion((version) => version + 1);
        setPublished(true);
      },
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 pt-1">
      <Note>{t('community.admin.securityNote')}</Note>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={titleId} className={LABEL}>{t('community.admin.titleLabel')}</label>
        <input
          id={titleId}
          value={title}
          maxLength={120}
          onChange={(event) => {
            setTitle(event.currentTarget.value);
            setPublished(false);
          }}
          className={FIELD}
          placeholder={t('community.admin.titlePlaceholder')}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className={LABEL}>{t('community.admin.contentLabel')}</span>
        <RichTextEditor key={editorVersion} onChange={(value) => {
          setHtml(value);
          setPublished(false);
        }} />
      </div>

      <section className="flex flex-col gap-2">
        <header className="flex items-center gap-2">
          <h3 className={LABEL}>{t('community.admin.previewLabel')}</h3>
          <span aria-hidden className="h-px flex-1 bg-v2-line" />
          <span className="text-micro text-v2-ink-3">{t('community.admin.previewHint')}</span>
        </header>
        <div className="grid gap-3 xl:grid-cols-[380px_minmax(720px,1fr)]">
          <PreviewFrame label={t('community.admin.mobilePreview')} widthClass="w-[360px]">
            <PreviewAnnouncement title={title} html={html} />
          </PreviewFrame>
          <PreviewFrame label={t('community.admin.desktopPreview')} widthClass="w-[720px]">
            <PreviewAnnouncement title={title} html={html} />
          </PreviewFrame>
        </div>
      </section>

      {publish.isError && (
        <p role="alert" className="text-caption text-v2-warn">{describeError(publish.error)}</p>
      )}
      {published && (
        <p role="status" className="flex items-center gap-1.5 rounded-control border border-v2-self/40 bg-v2-self/5 px-3 py-2 text-caption text-v2-self">
          <Icon id="i-check" className="size-3.5 shrink-0" />
          {t('community.admin.published')}
        </p>
      )}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        full
        disabled={!title.trim() || html === '<p></p>' || publish.isPending}
        icon={<Icon id="i-bell" className="size-4" />}
      >
        {publish.isPending ? t('community.admin.publishing') : t('community.admin.publish')}
      </Button>
    </form>
  );
}

function RichTextEditor({ onChange }: { onChange: (html: string) => void }) {
  const { t } = useTranslation();
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
      }),
      Image.configure({ allowBase64: false }),
      Youtube.configure({ nocookie: true, controls: true }),
    ],
    content: '<p></p>',
    editorProps: {
      attributes: {
        class: 'tiptap-editor min-h-52 px-3 py-3 text-body text-v2-ink focus:outline-none',
        role: 'textbox',
        'aria-label': t('community.admin.contentLabel'),
        'aria-multiline': 'true',
      },
    },
    onUpdate: ({ editor: current }) => { onChange(current.getHTML()); },
  });

  if (!editor) return <Waiting>{t('community.admin.contentLabel')}</Waiting>;

  const askLink = (): void => {
    const url = window.prompt(t('community.admin.linkPrompt'), 'https://');
    if (url === null) return;
    if (!url.trim()) editor.chain().focus().extendMarkRange('link').unsetLink().run();
    else editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  };
  const askImage = (): void => {
    const url = window.prompt(t('community.admin.imagePrompt'), 'https://');
    if (url?.trim()) editor.chain().focus().setImage({ src: url.trim() }).run();
  };
  const askVideo = (): void => {
    const url = window.prompt(t('community.admin.videoPrompt'), 'https://www.youtube.com/watch?v=');
    if (url?.trim()) editor.commands.setYoutubeVideo({ src: url.trim() });
  };

  return (
    <div className="overflow-hidden rounded-control border border-v2-line-hi bg-v2-deep focus-within:border-v2-self">
      <div className="flex flex-wrap gap-0.5 border-b border-v2-line bg-v2-panel p-1" role="toolbar" aria-label={t('community.admin.toolbarLabel')}>
        <ToolButton label={t('community.admin.tools.bold')} active={editor.isActive('bold')} onClick={() => { editor.chain().focus().toggleBold().run(); }} />
        <ToolButton label={t('community.admin.tools.italic')} active={editor.isActive('italic')} onClick={() => { editor.chain().focus().toggleItalic().run(); }} />
        <ToolButton label={t('community.admin.tools.heading')} active={editor.isActive('heading', { level: 2 })} onClick={() => { editor.chain().focus().toggleHeading({ level: 2 }).run(); }} />
        <ToolButton label={t('community.admin.tools.bullets')} active={editor.isActive('bulletList')} onClick={() => { editor.chain().focus().toggleBulletList().run(); }} />
        <ToolButton label={t('community.admin.tools.quote')} active={editor.isActive('blockquote')} onClick={() => { editor.chain().focus().toggleBlockquote().run(); }} />
        <ToolButton label={t('community.admin.tools.link')} active={editor.isActive('link')} onClick={askLink} />
        <ToolButton label={t('community.admin.tools.image')} onClick={askImage} />
        <ToolButton label={t('community.admin.tools.video')} onClick={askVideo} />
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolButton({ label, active = false, onClick }: { label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-chip px-2.5 py-1.5 text-micro font-semibold transition-colors ${active ? 'bg-v2-raise text-v2-self ring-1 ring-v2-line-hi' : 'text-v2-ink-2 hover:bg-v2-raise hover:text-v2-ink'}`}
    >
      {label}
    </button>
  );
}

function PreviewFrame({ label, widthClass, children }: { label: string; widthClass: string; children: ReactNode }) {
  return (
    <div className="min-w-0 overflow-x-auto rounded-control border border-v2-line bg-v2-void p-2.5">
      <p className={`${LABEL} mb-2`}>{label}</p>
      <div className={`${widthClass} min-h-64 rounded-control border border-v2-line bg-v2-deep p-3`}>{children}</div>
    </div>
  );
}

/**
 * THE PLAYER'S ARTICLE, AS THE PLAYER SEES IT. Deliberately the markup of
 * `AnnouncementsScreen`, not this desk's: a preview is only worth reading if it is the page.
 */
function PreviewAnnouncement({ title, html }: { title: string; html: string }) {
  const { t } = useTranslation();
  return (
    <article className="plate overflow-hidden">
      <header className="border-b border-line-soft px-2 py-3">
        <p className="name text-bone">{title.trim() || t('community.admin.previewUntitled')}</p>
      </header>
      <RichContent html={html} className="px-2 py-2" />
    </article>
  );
}

function AdminFeedbackList() {
  const { t, i18n } = useTranslation();
  const dateFormat = useMemo(() => new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }), [i18n.language]);
  const feedback = useAdminFeedback();
  if (feedback.isError) {
    return <Unreachable what={t('surface.whatAdminFeedback')} onRetry={() => { void feedback.refetch(); }} />;
  }
  if (!feedback.data) return <Waiting>{t('community.admin.feedbackTab')}</Waiting>;
  if (feedback.data.feedback.length === 0) {
    return <div className="py-2"><EmptyState icon={<Icon id="i-bell" className="size-6" />} title={t('community.admin.feedbackEmpty')} /></div>;
  }
  return (
    <ol className="flex flex-col gap-1.5 pt-1">
      {feedback.data.feedback.map((entry) => (
        <li key={entry.id} className="rounded-control border border-v2-line bg-v2-panel px-2.5 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="rounded-chip bg-v2-raise px-1.5 py-0.5 text-micro font-semibold text-v2-ink-2">
              {t(feedbackLabelKey(entry.kind))}
            </span>
            <time className="font-v2-mono text-micro text-v2-ink-3" dateTime={entry.createdAt.toISOString()}>
              {dateFormat.format(entry.createdAt)}
            </time>
          </div>
          <p className="mt-2 whitespace-pre-wrap break-words text-body leading-relaxed text-v2-ink">{entry.message}</p>
          <p className="mt-2 text-micro text-v2-ink-3">{entry.displayName} · @{entry.username}</p>
        </li>
      ))}
    </ol>
  );
}

function feedbackLabelKey(kind: FeedbackKind):
  | 'community.feedback.kinds.bug'
  | 'community.feedback.kinds.suggestion'
  | 'community.feedback.kinds.praise' {
  if (kind === 'BUG') return 'community.feedback.kinds.bug';
  if (kind === 'SUGGESTION') return 'community.feedback.kinds.suggestion';
  return 'community.feedback.kinds.praise';
}

/**
 * THE PERFORMANCE RECORDER'S CONTROL. Owner request, 2026-09-19.
 *
 * One button that starts and stops, the elapsed time while it runs, and after it
 * stops the figures a person reads first: the average and the low end of the frame
 * rate, how often it hitched and froze, the longest stall, what the GPU was asked
 * to draw, where memory went, and the worst moment with what was on the disc. The
 * full second-by-second record is on the server for the rest.
 */
function PerfRecorderPanel() {
  const { t } = useTranslation();
  const api = useApi();
  const perf = usePerfSession();
  const recording = perf.status === 'recording';
  const summary = perf.summary;

  const rows: [string, string][] = summary
    ? [
      [t('community.admin.perfFpsAvg'), String(summary.fpsAvg ?? '—')],
      [t('community.admin.perfFpsLow'), String(summary.fpsP5 ?? '—')],
      [t('community.admin.perfHitches'), String(summary.hitches ?? 0)],
      [t('community.admin.perfFreezes'), String(summary.freezes ?? 0)],
      [t('community.admin.perfJankMax'), `${String(summary.jankMaxMs ?? 0)} ms`],
      [t('community.admin.perfCalls'), `${String(summary.callsAvg ?? '—')} / ${String(summary.callsMax ?? '—')}`],
      [t('community.admin.perfTriangles'), String(summary.trianglesMax ?? '—')],
      [
        t('community.admin.perfHeap'),
        summary.heapStartMb === null
          ? '—'
          : `${String(summary.heapStartMb)} → ${String(summary.heapEndMb)} MB (${String(summary.heapMaxMb)})`,
      ],
      [t('community.admin.perfNetwork'), `${String(summary.requests ?? 0)} / ${String(summary.kb ?? 0)} KB`],
    ]
    : [];

  return (
    <section className="flex flex-col gap-3 py-1">
      <Note>{t('community.admin.perfIntro')}</Note>
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          variant={recording ? 'default' : 'primary'}
          disabled={perf.status === 'sending'}
          onClick={() => {
            if (recording) void stopPerfSession(api.postPerfSession);
            else startPerfSession();
          }}
        >
          {recording ? t('community.admin.perfStop') : t('community.admin.perfStart')}
        </Button>
        <span className="font-v2-mono text-micro text-v2-ink-3" aria-live="polite">
          {recording && `${t('community.admin.perfRecording')} · ${formatClock(perf.seconds)}`}
          {perf.status === 'sending' && t('community.admin.perfSending')}
          {perf.status === 'sent' && t('community.admin.perfSent')}
          {perf.status === 'failed' && t('community.admin.perfFailed')}
        </span>
      </div>
      {perf.status === 'failed' && (
        <Button size="sm" onClick={() => { void retryPerfSession(api.postPerfSession); }}>
          {t('community.admin.perfRetry')}
        </Button>
      )}
      {rows.length > 0 && (
        <dl className="divide-y divide-v2-line rounded-control border border-v2-line bg-v2-panel">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-3 px-2.5 py-1.5">
              <dt className="text-micro text-v2-ink-2">{label}</dt>
              <dd className="font-v2-mono text-micro tabular-nums text-v2-ink">{value}</dd>
            </div>
          ))}
          {typeof summary?.worst1 === 'string' && (
            <div className="px-2.5 py-1.5">
              <dt className="text-micro text-v2-ink-2">{t('community.admin.perfWorst')}</dt>
              <dd className="mt-0.5 break-words font-v2-mono text-micro text-v2-warn">{summary.worst1}</dd>
            </div>
          )}
        </dl>
      )}
    </section>
  );
}

type GrantItem = PlanetSkinId | 'bundle';
type GrantOutcome = 'done' | 'owned' | { error: string };
interface GrantRow { skinId: PlanetSkinId; outcome: GrantOutcome }

const isGrantItem = (value: string): value is GrantItem =>
  value === 'bundle' || PLANET_SKIN_IDS.some((id) => id === value);

function SupporterForm() {
  const { t } = useTranslation();
  const api = useApi();
  const id = useId();
  const submitting = useRef(false);
  const [commander, setCommander] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ username: string; supporter: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ready = commander.trim().length >= 2 && !busy;

  const submit = async (supporter: boolean): Promise<void> => {
    if (!ready || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setResult(null);
    setError(null);
    const username = commander.trim();
    try {
      setResult(await api.setSupporter(username, supporter));
    } catch (fault) {
      setError(fault instanceof ApiError && fault.code === 'ACCOUNT_NOT_FOUND'
        ? t('community.admin.supporterNoAccount', { name: username }) : describeError(fault));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(event) => { event.preventDefault(); void submit(true); }}
      className="mx-auto flex w-full max-w-md flex-col gap-3 pt-1" aria-busy={busy}>
      <Note>{t('community.admin.supporterIntro')}</Note>
      <div className="flex items-center gap-2 rounded-control border border-chat-supporter/35 bg-v2-deep px-3 py-2 text-caption text-chat-supporter-ink">
        <HeartIcon className="size-4 shrink-0" />{t('chat.supporterBadge')}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className={LABEL}>{t('community.admin.supporterCommander')}</label>
        <input id={id} value={commander} maxLength={32} autoComplete="off" disabled={busy}
          onChange={(event) => { setCommander(event.currentTarget.value); setResult(null); setError(null); }}
          className={FIELD} />
      </div>
      <Button type="submit" variant="primary" size="lg" full disabled={!ready}>
        {busy ? t('community.admin.supporterWorking') : t('community.admin.supporterGrant')}
      </Button>
      <Button type="button" variant="ghost" size="lg" full disabled={!ready}
        onClick={() => { void submit(false); }}>{t('community.admin.supporterRevoke')}</Button>
      {error !== null && <p role="alert" className="text-caption text-v2-warn">{error}</p>}
      {result !== null && <p role="status" className="text-caption text-chat-supporter-ink">
        {t(result.supporter ? 'community.admin.supporterGranted' : 'community.admin.supporterRevoked', { name: result.username })}
      </p>}
    </form>
  );
}

/**
 * A SHOPIER ORDER, GRANTED BY HAND (owner 2026-09-27: "Manuel + admin formu"). Shopier's page
 * knows nothing of the account, so the owner reads the commander from the order note and
 * grants here. The server keeps the order number beside the grant; sending it again is a
 * replay, never a second look. The set is its four looks, each answered on its own row —
 * one already owned does not stop the other three — but an unknown commander stops the lot.
 */
function SkinGrantForm() {
  const { t } = useTranslation();
  const api = useApi();
  const ids = { commander: useId(), item: useId(), order: useId() };
  const [commander, setCommander] = useState('');
  const [item, setItem] = useState<GrantItem | ''>('');
  const [order, setOrder] = useState('');
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<GrantRow[]>([]);
  const [missing, setMissing] = useState<string | null>(null);
  // A username is 2–32 characters and a Shopier order number is never shorter than three.
  const ready = commander.trim().length >= 2 && item !== '' && order.trim().length >= 3 && !busy;

  const submit = async (event: SyntheticEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!ready) return;
    const name = commander.trim();
    const skins: readonly PlanetSkinId[] = item === 'bundle' ? SKIN_COLLECTIONS.elemental.ids : [item];
    setBusy(true);
    setRows([]);
    setMissing(null);
    const done: GrantRow[] = [];
    for (const skinId of skins) {
      try {
        await api.grantSkin(name, skinId, order.trim());
        done.push({ skinId, outcome: 'done' });
      } catch (error) {
        if (error instanceof ApiError && error.code === 'ACCOUNT_NOT_FOUND') {
          setMissing(name);
          break;
        }
        done.push({
          skinId,
          outcome: error instanceof ApiError && error.code === 'SKIN_ALREADY_OWNED' ? 'owned' : { error: describeError(error) },
        });
      }
      setRows([...done]);
    }
    setBusy(false);
  };

  return (
    <form onSubmit={(event) => { void submit(event); }} className="mx-auto flex w-full max-w-md flex-col gap-3 pt-1">
      <Note>{t('community.admin.grantIntro')}</Note>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.commander} className={LABEL}>{t('community.admin.grantCommander')}</label>
        <input id={ids.commander} value={commander} maxLength={32} autoComplete="off"
          onChange={(event) => { setCommander(event.currentTarget.value); }}
          placeholder={t('community.admin.grantCommanderHint')} className={FIELD} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.item} className={LABEL}>{t('community.admin.grantItem')}</label>
        <select id={ids.item} value={item} className={FIELD}
          onChange={(event) => {
            const next = event.currentTarget.value;
            setItem(isGrantItem(next) ? next : '');
          }}>
          <option value="" disabled>{t('community.admin.grantPick')}</option>
          <optgroup label={t(SKIN_COLLECTIONS.elemental.nameKey)}>
            <option value="bundle">{t('community.admin.grantBundle')}</option>
            {SKIN_COLLECTIONS.elemental.ids.map((id) => <option key={id} value={id}>{t(PLANET_SKIN_CATALOG[id].nameKey)}</option>)}
          </optgroup>
          <optgroup label={t(SKIN_COLLECTIONS.country.nameKey)}>
            {SKIN_COLLECTIONS.country.ids.map((id) => <option key={id} value={id}>{t(PLANET_SKIN_CATALOG[id].nameKey)}</option>)}
          </optgroup>
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.order} className={LABEL}>{t('community.admin.grantOrder')}</label>
        <input id={ids.order} value={order} maxLength={120} autoComplete="off" spellCheck={false}
          onChange={(event) => { setOrder(event.currentTarget.value); }}
          className={`${FIELD} font-v2-mono`} />
      </div>
      <Button type="submit" variant="primary" size="lg" full disabled={!ready}
        icon={<Icon id="i-gift" className="size-4" />}>
        {busy ? t('community.admin.granting') : t('community.admin.grantSubmit')}
      </Button>
      {missing !== null && (
        <p role="alert" className="flex items-start gap-1.5 text-caption text-v2-warn">
          <Icon id="i-warn" className="mt-0.5 size-3.5 shrink-0" />
          {t('community.admin.grantNoAccount', { name: missing })}
        </p>
      )}
      {rows.length > 0 && (
        <ol aria-label={t('community.admin.grantResults')}
          className="divide-y divide-v2-line rounded-control border border-v2-line bg-v2-panel">
          {rows.map(({ skinId, outcome }) => (
            <li key={skinId} className="flex items-center justify-between gap-2 px-2.5 py-2 text-caption">
              <span className="font-semibold" style={{ color: PLANET_SKIN_CATALOG[skinId].accent }}>
                {t(PLANET_SKIN_CATALOG[skinId].nameKey)}
              </span>
              {outcome === 'done' ? (
                <span className="flex items-center gap-1 text-v2-self">
                  <Icon id="i-check" className="size-3.5" />{t('community.admin.grantDone')}
                </span>
              ) : outcome === 'owned' ? (
                <span className="text-v2-ink-2">{t('community.admin.grantOwned')}</span>
              ) : (
                <span className="text-right text-v2-warn">{outcome.error}</span>
              )}
            </li>
          ))}
        </ol>
      )}
    </form>
  );
}
