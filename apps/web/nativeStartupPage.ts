import { createHash } from 'node:crypto';
import { PUBLISHER_ORIGIN } from './src/lib/publisherPages.js';
import { NATIVE_STARTUP_PATH } from './mobileBuild.js';

/** ES5 on purpose: this runs before the game on renderers too old for its JS/CSS. */
export const nativeCompatibilityScript = `(function(){var ready=false;try{ready=typeof CSS!=="undefined"&&typeof CSS.supports==="function"&&CSS.supports("color","color-mix(in oklab, white, black)")&&CSS.supports("color","oklch(70% 0.1 180)")&&typeof Object.hasOwn==="function"&&typeof Array.prototype.at==="function";}catch(ignored){}if(!ready)location.replace("/${NATIVE_STARTUP_PATH}");}());`;

const languageScript = `(function(){var tr=(navigator.language||"").toLowerCase().indexOf("tr")===0;document.documentElement.lang=tr?"tr":"en";var nodes=document.querySelectorAll("[data-startup-language]");for(var i=0;i<nodes.length;i++)nodes[i].hidden=nodes[i].getAttribute("data-startup-language")!==(tr?"tr":"en");}());`;

/** No app bootstrap, native bridge, credentials or API dependency on the recovery surface. */
export function nativeStartupHtml(): string {
  const hash = createHash('sha256').update(languageScript).digest('base64');
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; script-src 'sha256-${hash}'; base-uri 'none'; object-src 'none'; form-action 'none'">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Astera Online</title>
<style>
*{box-sizing:border-box}html{background:#05070d;color:#e8f0f8;font-family:Arial,sans-serif}body{margin:0;min-height:100vh;background:radial-gradient(ellipse at 15% 10%,rgba(30,120,120,.2),transparent 65%),radial-gradient(ellipse at 95% 80%,rgba(40,65,110,.2),transparent 70%)}[hidden]{display:none!important}main{width:100%;max-width:480px;margin:0 auto;padding:48px 22px;padding-top:calc(32px + env(safe-area-inset-top));padding-bottom:calc(28px + env(safe-area-inset-bottom))}.brand{display:flex;align-items:center;gap:12px;letter-spacing:.18em;font-size:18px}.brand img{width:40px;height:40px}.online{color:#25dfca;font-size:11px;letter-spacing:.2em;margin-top:5px}.card{margin-top:36px;padding:24px 20px;border:1px solid #294452;border-radius:18px;background:rgba(10,19,31,.92);box-shadow:0 16px 48px rgba(0,0,0,.3);border-top:2px solid #25dfca}.eyebrow{color:#25dfca;font-size:11px;letter-spacing:.16em;text-transform:uppercase;margin:0 0 14px}h1{font-size:28px;line-height:1.15;letter-spacing:-.02em;margin:0 0 16px}p{font-size:15px;line-height:1.65;color:#adbdce;margin:0 0 20px}.actions{display:flex;flex-direction:column;gap:10px}a{color:#dcebf5;text-decoration:none}.action{display:block;padding:14px 12px;border:1px solid #355363;border-radius:11px;min-height:48px;text-align:center;line-height:1.35;font-size:14px;font-weight:bold}.action.primary{background:#25dfca;border-color:#25dfca;color:#06151a}.contact{display:inline-block;margin-top:22px;line-height:1.5;text-decoration:underline;text-underline-offset:4px}a:focus{outline:2px solid #e8f0f8;outline-offset:4px}.note{font-size:12px;line-height:1.6;color:#8f9fb2;margin:22px 0 0}
</style></head><body><main data-native-startup>
<div class="brand"><img src="/assets/images/logos/logo-mark.png" alt=""><div>ASTERA<div class="online">ONLINE</div></div></div>
<section class="card" data-startup-language="tr" lang="tr" hidden>
<p class="eyebrow">Galaksiye dönmeden önce</p><h1>Uygulama açılamadı</h1>
<p>Önce uygulamayı kapatıp yeniden aç. Sorun sürerse Android’de System WebView ve Chrome’u, iPhone veya iPad’de sistem yazılımını güncelle.</p>
<div class="actions"><a class="action primary" href="https://play.google.com/store/apps/details?id=com.google.android.webview">Android · WebView’ı güncelle</a><a class="action" href="https://support.apple.com/tr-tr/118575">iPhone / iPad · Güncelleme yardımı</a></div>
<a class="contact" href="${PUBLISHER_ORIGIN}/iletisim.html">Hâlâ açılmıyor mu? Bize ulaş</a><p class="note">Güncelleme tamamlanınca Astera’yı yeniden aç.</p>
</section>
<section class="card" data-startup-language="en" lang="en">
<p class="eyebrow">Before returning to the galaxy</p><h1>The app couldn’t open</h1>
<p>Close the app and open it again. If the problem continues, update System WebView and Chrome on Android, or the system software on iPhone and iPad.</p>
<div class="actions"><a class="action primary" href="https://play.google.com/store/apps/details?id=com.google.android.webview">Android · Update WebView</a><a class="action" href="https://support.apple.com/en-us/118575">iPhone / iPad · Update help</a></div>
<a class="contact" href="${PUBLISHER_ORIGIN}/contact.html">Still can’t open? Contact us</a><p class="note">Once the update finishes, open Astera again.</p>
</section></main><script>${languageScript}</script></body></html>`;
}
