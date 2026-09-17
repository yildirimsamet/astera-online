/* global window */
/*
 * This classic script is deliberately parser-blocking and first-party. The
 * AdSense tag that follows it is async: consent defaults must enter dataLayer
 * before that loader has any chance to read storage.
 *
 * Keep the four fields aligned with the fallback in lib/analytics.ts. Google
 * CMP writes updates after a visitor chooses, when its Consent Mode settings
 * are enabled in the AdSense account.
 */
(function () {
  window.dataLayer ??= [];
  window.gtag ??= function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied'
  });
  window.__asteraConsentDefaults = true;
}());
