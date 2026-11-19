/**
 * A PAGE TRANSLATOR MUST NOT BE ABLE TO CRASH A SCREEN (Sentry WEB-4, 2026-11-19).
 *
 * Chrome Translate (and similar extensions) swap the text nodes React rendered for wrappers of their
 * own. React still holds the original node, so the next update that removes it — or inserts beside
 * it — throws `NotFoundError` and the screen falls into its error boundary. A player whose phone
 * speaks a language the game does not (Italian → Turkish fallback) is exactly who translates.
 *
 * The well-known guard (facebook/react#11538): when the node is no longer where React thinks, the
 * removal is already done and the insertion goes to the end. An ordinary page never takes either
 * branch. Translation stays allowed; `translate="no"` would cost those players the translator.
 */
export function tolerateForeignDomEdits(): () => void {
  const proto = Node.prototype;
  const { removeChild, insertBefore } = proto; // eslint-disable-line @typescript-eslint/unbound-method -- re-bound with call below
  proto.removeChild = function guardedRemove<T extends Node>(this: Node, child: T): T {
    if (child.parentNode === this) removeChild.call(this, child);
    return child;
  };
  proto.insertBefore = function guardedInsert<T extends Node>(this: Node, node: T, child: Node | null): T {
    insertBefore.call(this, node, child !== null && child.parentNode !== this ? null : child);
    return node;
  };
  return () => { proto.removeChild = removeChild; proto.insertBefore = insertBefore; };
}
