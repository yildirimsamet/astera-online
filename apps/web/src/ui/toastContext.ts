import { createContext } from 'react';

/**
 * THE TOAST CONTEXTS, IN A MODULE THAT IMPORTS REACT ALONE (owner, 2026-11-17, ek-3).
 *
 * They used to be created in `Toast.tsx`, which imports the kit: on the dev server every kit
 * edit re-ran it and minted a new context while the root's provider kept the old one, and the
 * next consumer to render threw "useToast called outside ToastProvider". Nothing the game edits
 * re-runs this file, so the context the provider and its consumers share stays one object.
 */
export type ToastTone = 'info' | 'warn' | 'error';
export const ToastContext = createContext<((text: string, tone?: ToastTone) => void) | null>(null);
export const ToastSilenceContext = createContext<((keepErrors?: boolean) => () => void) | null>(null);
