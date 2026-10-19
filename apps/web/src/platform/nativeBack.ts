import { useEffect, type RefObject } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { runtime } from './runtime.js';

const BACK = 'astera:native-back';

/** Native navigation has its own event: a sheet's Back can differ from Escape/Close. */
export function useNativeBack(panel: RefObject<Element | null>, onBack: (() => void) | undefined, enabled = true): void {
  useEffect(() => {
    const node = panel.current;
    if (!enabled || !node || !onBack) return;
    const back = (event: Event): void => {
      // A nested modal may bubble through this panel. It never closes its parent.
      if (event.target !== node || event.defaultPrevented) return;
      event.preventDefault();
      onBack();
    };
    node.addEventListener(BACK, back);
    return () => { node.removeEventListener(BACK, back); };
  }, [panel, onBack, enabled]);
}

/** One process-lifetime listener; web/iOS keep their own OS navigation. */
export function startAndroidBack(): () => void {
  if (runtime() !== 'android' || !Capacitor.isPluginAvailable('App')) return () => undefined;
  let active = true;
  let ownsHandler = false;
  const handle = App.addListener('backButton', () => {
    if (!active) return;
    const panels = document.querySelectorAll('[role="dialog"], [role="alertdialog"]');
    const top = panels[panels.length - 1]
      ?? document.querySelector('[data-native-back-layer="popover"]')
      ?? document.querySelector('[data-native-back-layer="context"]');
    const event = new Event(BACK, { cancelable: true, bubbles: true });
    top?.dispatchEvent(event);
    // Required forms without a Back preserve their state when the app goes behind.
    if (!event.defaultPrevented) void App.minimizeApp().catch(() => { console.warn('Android back could not minimize the app'); });
  });
  void handle.then(() => {
    if (!active) return;
    // Until JS is listening, the disabled plugin leaves Back with the OS.
    ownsHandler = true;
    return App.toggleBackButtonHandler({ enabled: true });
  }).catch(() => { console.warn('Android back listener unavailable'); });
  return () => {
    active = false;
    if (ownsHandler) void App.toggleBackButtonHandler({ enabled: false }).catch(() => { /* Bridge already gone. */ });
    void handle.then(listener => listener.remove()).catch(() => { /* The bridge may already be gone. */ });
  };
}
