import { useMemo, useState, type ReactNode, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import { useAdminFeedback, usePublishAnnouncement } from '../api/queries.js';
import type { FeedbackKind } from '../api/schemas.js';
import { describeError } from '../i18n/errors.js';
import { RichContent } from '../ui/RichContent.js';
import { Button, EmptyState, Segmented, SkeletonText, Unreachable } from '../ui/kit/index.js';
import { BellIcon, SendIcon } from '../ui/icons/index.js';

type AdminTab = 'COMPOSE' | 'FEEDBACK';

const ADMIN_TAB_ID: Record<AdminTab, string> = {
  COMPOSE: 'admin-compose-tab',
  FEEDBACK: 'admin-feedback-tab',
};
const ADMIN_PANEL_ID: Record<AdminTab, string> = {
  COMPOSE: 'admin-compose-panel',
  FEEDBACK: 'admin-feedback-panel',
};

export default function AdminPanel() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<AdminTab>('COMPOSE');
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-2 py-3">
        <Segmented
          role="tablist"
          label={t('community.admin.tabsLabel')}
          value={tab}
          onSelect={setTab}
          tabId={(id) => ADMIN_TAB_ID[id]}
          panelId={(id) => ADMIN_PANEL_ID[id]}
          segments={[
            { id: 'COMPOSE', label: t('community.admin.composeTab') },
            { id: 'FEEDBACK', label: t('community.admin.feedbackTab') },
          ]}
        />
      </div>
      <div
        id={ADMIN_PANEL_ID[tab]}
        role="tabpanel"
        aria-labelledby={ADMIN_TAB_ID[tab]}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-6"
      >
        {tab === 'COMPOSE' ? <AnnouncementComposer /> : <AdminFeedbackList />}
      </div>
    </div>
  );
}

function AnnouncementComposer() {
  const { t } = useTranslation();
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
    <form onSubmit={submit} className="flex flex-col gap-5 pt-1">
      <p className="text-caption leading-relaxed text-dim">{t('community.admin.securityNote')}</p>
      <label className="flex flex-col gap-2">
        <span className="legend">{t('community.admin.titleLabel')}</span>
        <input
          value={title}
          maxLength={120}
          onChange={(event) => {
            setTitle(event.currentTarget.value);
            setPublished(false);
          }}
          className="field min-h-11"
          placeholder={t('community.admin.titlePlaceholder')}
        />
      </label>
      <div className="flex flex-col gap-2">
        <span className="legend">{t('community.admin.contentLabel')}</span>
        <RichTextEditor key={editorVersion} onChange={(value) => {
          setHtml(value);
          setPublished(false);
        }} />
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h3 className="legend">{t('community.admin.previewLabel')}</h3>
          <span className="rail-soft flex-1" />
          <span className="text-micro text-faint">{t('community.admin.previewHint')}</span>
        </div>
        <div className="grid gap-4 xl:grid-cols-[380px_minmax(720px,1fr)]">
          <PreviewFrame label={t('community.admin.mobilePreview')} widthClass="w-[360px]">
            <PreviewAnnouncement title={title} html={html} />
          </PreviewFrame>
          <PreviewFrame label={t('community.admin.desktopPreview')} widthClass="w-[720px]">
            <PreviewAnnouncement title={title} html={html} />
          </PreviewFrame>
        </div>
      </section>

      {publish.isError && (
        <p role="alert" className="text-caption text-threat-ink">{describeError(publish.error)}</p>
      )}
      {published && (
        <p role="status" className="rounded-chip border border-opportunity/30 bg-opportunity/10 px-3 py-2 text-caption text-opportunity">
          {t('community.admin.published')}
        </p>
      )}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        full
        disabled={!title.trim() || html === '<p></p>' || publish.isPending}
        icon={<SendIcon className="size-4" />}
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
        class: 'tiptap-editor min-h-52 px-2 py-3 focus:outline-none',
        role: 'textbox',
        'aria-label': t('community.admin.contentLabel'),
        'aria-multiline': 'true',
      },
    },
    onUpdate: ({ editor: current }) => { onChange(current.getHTML()); },
  });

  if (!editor) return <SkeletonText lines={5} />;

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
    <div className="overflow-hidden rounded-plate border border-line bg-deep">
      <div className="flex flex-wrap gap-1 border-b border-line-soft bg-void/70 p-2" role="toolbar" aria-label={t('community.admin.toolbarLabel')}>
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
      className={`rounded-chip px-3 py-2 text-label transition-colors ${active ? 'bg-crystal/15 text-crystal' : 'text-dim hover:bg-raised hover:text-bone'}`}
    >
      {label}
    </button>
  );
}

function PreviewFrame({ label, widthClass, children }: { label: string; widthClass: string; children: ReactNode }) {
  return (
    <div className="min-w-0 overflow-x-auto rounded-plate border border-line-soft bg-void p-3">
      <p className="legend mb-3">{label}</p>
      <div className={`${widthClass} min-h-64 rounded-plate border border-line bg-panel p-4`}>{children}</div>
    </div>
  );
}

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
  if (!feedback.data) return <SkeletonText lines={8} className="mt-3" />;
  if (feedback.data.feedback.length === 0) {
    return <div className="py-2"><EmptyState icon={<BellIcon className="size-7" />} title={t('community.admin.feedbackEmpty')} /></div>;
  }
  return (
    <ol className="flex flex-col gap-2 pt-1">
      {feedback.data.feedback.map((entry) => (
        <li key={entry.id} className="plate px-2 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="rounded-full bg-raised px-2 py-1 text-micro text-crystal">
              {t(feedbackLabelKey(entry.kind))}
            </span>
            <time className="text-micro text-faint" dateTime={entry.createdAt.toISOString()}>
              {dateFormat.format(entry.createdAt)}
            </time>
          </div>
          <p className="mt-3 whitespace-pre-wrap break-words text-body leading-relaxed text-bone">{entry.message}</p>
          <p className="mt-3 text-label text-faint">{entry.displayName} · @{entry.username}</p>
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
