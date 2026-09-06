import { Component, useState, type ErrorInfo, type ReactNode } from 'react';
import i18n from '../i18n/index.js';
import { copyText } from '../lib/clipboard.js';
import { Button } from '../ui/kit/index.js';
import {
  crashReportText,
  describeCrash,
  rememberCrash,
  type CrashRecord,
} from './crashReport.js';

/**
 * THE APP HAD NO FLOOR, AND A PLAYER FELL THROUGH IT.
 *
 * Owner report: a commander taps a world, the screen goes black, and only
 * reloading the page brings it back. `grep -rn "ErrorBoundary" apps/web/src`
 * returned nothing at all, and that is the whole mechanism: one throw inside one
 * render unmounts the ENTIRE React tree, React leaves an empty `#root` behind,
 * and what the player is looking at is the body's own dark ground. It is not a
 * frozen scene and not a slow request — there is nothing on the page.
 *
 * A boundary is the floor. It catches the throw, keeps the crash inside itself,
 * and puts up a screen the player can act on.
 *
 * AND IT IS ALSO THE MEASUREMENT, which is why it was built before any fix.
 * The owner's instruction was to learn the cause before choosing an action, and
 * a boundary answers the question by DIVIDING it:
 *
 *   · the black screen becomes this fallback → it was a React render error, and
 *     the report names the file, the type and the message;
 *   · the black screen stays black with nothing on it → it was NOT a React
 *     error. A boundary cannot see a lost WebGL context, an event-handler throw
 *     or a rejected promise, so a silent black screen after this ships rules the
 *     first out and points at the canvas.
 *
 * Either answer is worth more than a guess, and neither costs the player their
 * session.
 *
 * `i18n.t` DIRECTLY, NOT `useTranslation`. The fallback must not depend on a
 * context that may be part of what just failed, and the instance is already in
 * memory before React paints (`i18n/index.ts`). The trade is that a language
 * change would not repaint this screen — nothing on it can change the language,
 * so there is nothing to repaint.
 */

interface Props {
  readonly children: ReactNode;
  /**
   * Injected by the test, which cannot navigate. Production reloads the page.
   */
  readonly onReload?: () => void;
}

interface State {
  readonly record: CrashRecord | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { record: null };

  /**
   * BOTH HOOKS, AND THEY DO DIFFERENT JOBS.
   *
   * This one is what React guarantees will run, so it is what puts the fallback
   * on screen — but it is called during rendering and is handed no component
   * stack. `componentDidCatch` below has the stack and is where the record is
   * written, so the screen is never waiting on the reporting to succeed.
   */
  static getDerivedStateFromError(error: unknown): State {
    return { record: describeCrash(error, null) };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    const record = describeCrash(error, info.componentStack ?? null);
    rememberCrash(record);
    this.setState({ record });
  }

  override render(): ReactNode {
    const { record } = this.state;
    if (record === null) return this.props.children;
    return <CrashScreen record={record} onReload={this.props.onReload ?? reloadPage} />;
  }
}

const reloadPage = (): void => {
  window.location.reload();
};

type CopyState = 'idle' | 'done' | 'failed';

/**
 * ONE FACT, ONE CONTROL, AND THE DETAIL BEHIND A TAP.
 *
 * The player is told what happened and that the galaxy is untouched — which is
 * true, because the server is the only authority and this failure never left the
 * phone. Then one control, because a crashed 3D scene cannot be trusted to
 * re-mount into a good state: a "try again" that re-renders the same broken
 * screen would crash again in front of them, so reload is the honest recovery
 * and the only one offered.
 *
 * THE TECHNICAL DETAIL FOLDS; THE CONTROLS DO NOT. A stack trace is prose for
 * somebody who is not in the room, and prose folds. Copy does not fold, because
 * a player on a phone cannot open a console and that control is the entire route
 * from their crash to the person who can fix it.
 */
function CrashScreen({ record, onReload }: { record: CrashRecord; onReload: () => void }) {
  const [open, setOpen] = useState(false);
  const [copy, setCopy] = useState<CopyState>('idle');
  const report = crashReportText(record);

  return (
    <main
      /*
        ABOVE EVERYTHING, INCLUDING THE LOADING COVER at `z-[60]`. A screen whose
        job is to be the only thing visible cannot share a rung with the things
        it covers.
      */
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center overflow-y-auto bg-void px-8 py-10"
      role="alert"
    >
      <div className="flex w-full max-w-xs flex-col items-center text-center">
        <p className="legend">{i18n.t('crash.title')}</p>
        <p className="mt-2 text-body text-dim">{i18n.t('crash.body')}</p>

        <Button variant="primary" size="lg" full onClick={onReload} className="mt-5">
          {i18n.t('crash.reload')}
        </Button>

        {/* The two diagnostic controls, on one line and both quiet. */}
        <div className="mt-3 flex items-center justify-center gap-4">
          <button
            type="button"
            aria-expanded={open}
            className="text-caption text-faint underline-offset-2 hover:underline"
            onClick={() => { setOpen(!open); }}
          >
            {open ? i18n.t('crash.detailHide') : i18n.t('crash.detailShow')}
          </button>
          <button
            type="button"
            className="text-caption text-faint underline-offset-2 hover:underline"
            onClick={() => {
              void copyText(report).then((ok) => { setCopy(ok ? 'done' : 'failed'); });
            }}
          >
            {i18n.t('crash.copy')}
          </button>
        </div>

        {copy !== 'idle' && (
          <p className="mt-1.5 text-micro text-faint">
            {copy === 'done' ? i18n.t('crash.copied') : i18n.t('crash.copyFailed')}
          </p>
        )}

        {open && (
          /*
            Its own scroll box, both ways. A stack trace is wider than 375px and
            longer than the screen, and the page body must never scroll sideways.
          */
          <pre className="mt-3 max-h-56 w-full overflow-auto whitespace-pre-wrap break-words rounded-cell bg-black/30 p-2 text-left text-micro text-faint">
            {report}
          </pre>
        )}
      </div>
    </main>
  );
}
