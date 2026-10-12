/**
 * Human-operated live check before gameplay integration. This server has no game
 * routes or database connection and binds only to loopback. Never log credentials
 * or CAPTCHA tokens; only the provider's validated outcome may leave the handler.
 *
 * Run from the repository root:
 * pnpm --filter @astera/server exec tsx src/cli/hcaptcha-preview.ts
 */
import Fastify from 'fastify';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { z } from 'zod';

interface PreviewOptions {
  siteKey: string;
  secret: string;
  origin: string;
  fetcher?: typeof fetch;
}

const credentialsSchema = z.object({
  siteKey: z.string().trim().uuid(),
  secret: z.string().trim().min(1),
  origin: z.string().url(),
});
const tokenSchema = z.object({ token: z.string().min(1).max(8192) }).strict();
const outcomeSchema = z.object({
  success: z.boolean(),
  'error-codes': z.array(z.string()).optional(),
});
interface Outcome { success: boolean; errorCodes: string[] }

export function createHcaptchaPreview(options: PreviewOptions) {
  const { siteKey, secret, origin } = credentialsSchema.parse(options);
  const expectedHost = new URL(origin).host;
  const fetcher = options.fetcher ?? fetch;
  const app = Fastify({ logger: false, bodyLimit: 10_240 });
  let lastOutcome: Outcome | undefined;

  app.addHook('onRequest', async (request, reply) => {
    reply.header('cache-control', 'no-store');
    reply.header('referrer-policy', 'no-referrer');
    reply.header('x-content-type-options', 'nosniff');
    reply.header('x-frame-options', 'DENY');
    if (request.headers.host !== expectedHost
      || (request.method === 'POST' && request.headers.origin !== origin)) {
      return reply.code(403).send({ error: 'LOCAL_PREVIEW_ONLY' });
    }
  });

  app.get('/', async (_request, reply) => reply.type('text/html; charset=utf-8').send(previewHtml(siteKey)));
  app.get('/status', (_request, reply) => reply.send(lastOutcome ? { attempted: true, ...lastOutcome } : { attempted: false }));
  app.post('/verify', async (request, reply) => {
    const input = tokenSchema.safeParse(request.body);
    if (!input.success) return reply.code(400).send({ error: 'INVALID_CAPTCHA_TOKEN' });
    try {
      const response = await fetcher('https://api.hcaptcha.com/siteverify', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret, sitekey: siteKey, response: input.data.token }),
        signal: AbortSignal.timeout(10_000),
        redirect: 'error',
      });
      if (!response.ok) throw new Error('Provider unavailable');
      const outcome = outcomeSchema.parse(await response.json());
      lastOutcome = { success: outcome.success, errorCodes: outcome['error-codes'] ?? [] };
      return lastOutcome;
    } catch {
      lastOutcome = { success: false, errorCodes: ['verification-unavailable'] };
      return reply.code(502).send(lastOutcome);
    }
  });
  return app;
}

function previewHtml(siteKey: string): string {
  // The sitekey is a UUID validated above. The secret is never passed here.
  return `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Astera Online · hCaptcha denemesi</title>
<style>
:root{color-scheme:dark;font-family:Arial,sans-serif;background:#050910;color:#eaf1fb}
*{box-sizing:border-box}body{margin:0;min-height:100svh;display:grid;place-items:center;padding:24px 16px;background:radial-gradient(ellipse at 20% 10%,#17344688,transparent 65%),radial-gradient(ellipse at 85% 85%,#18284a88,transparent 60%),#050910}
main{width:min(100%,480px);padding:32px 24px;background:linear-gradient(145deg,#111e2bea,#0b121dea);border:1px solid #b0d9ff22;border-radius:20px;box-shadow:0 24px 100px #0008}
.brand{margin:0;color:#9ae1ee;font-size:11px;letter-spacing:.24em;font-weight:700}.tag{margin-top:16px;display:inline-block;border:1px solid #7cc8da33;border-radius:20px;padding:6px 10px;color:#acc5d8;font-size:11px}
h1{margin:20px 0 12px;font-size:clamp(24px,5vw,32px);letter-spacing:-.035em;line-height:1.15}p{font-size:14px;line-height:1.6;color:#acc0d5;margin:0 0 20px}
.widget{min-height:144px;display:grid;place-items:center;margin:24px 0}.status{border:1px solid #8eb7d833;border-radius:12px;padding:16px;font-size:14px;line-height:1.6;overflow-wrap:anywhere;background:#0a131f;min-height:76px}
.status[data-state=success]{border-color:#72d6a866;color:#acedd0;background:#0e251d}.status[data-state=error]{border-color:#e68b8266;color:#f5b5ad;background:#281817}
button{margin-top:16px;width:100%;min-height:44px;border:1px solid #9be1f155;border-radius:10px;background:#183541;color:#d7f6ff;font-weight:700;cursor:pointer}button:hover{background:#214654}button:focus-visible{outline:2px solid #9be1f1;outline-offset:3px}
.note{margin:20px 0 0;font-size:12px;color:#8399ae}code{font-family:monospace;color:#c9e7ed}
</style></head><body><main>
<div class="brand">ASTERA ONLINE</div><span class="tag">Yerel bağlantı denemesi</span>
<h1>Güvenlik doğrulamasını dene</h1>
<p>Aşağıdaki CAPTCHA kontrolünü tamamla. Sunucunun aldığı doğrulama sonucu burada görünecek.</p>
<div class="widget"><div class="h-captcha" data-sitekey="${siteKey}" data-theme="dark" data-size="compact" data-hl="tr" data-callback="captchaSolved" data-error-callback="captchaError" data-expired-callback="captchaExpired"></div></div>
<div id="status" class="status" role="status" aria-live="polite" data-state="waiting">CAPTCHA kontrolünü tamamlaman bekleniyor.</div>
<button type="button" onclick="location.reload()">Yeniden dene</button>
<p class="note">Bu deneme oyun içinde işlem yapmaz. Gizli anahtar yalnız yerel sunucuda kullanılır.</p>
</main><script>
const statusNode=document.getElementById('status');
function showStatus(message,state){statusNode.textContent=message;statusNode.dataset.state=state;}
window.captchaSolved=async function(token){
  showStatus('Cevap sunucuda doğrulanıyor…','pending');
  try{
    const response=await fetch('/verify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token})});
    const result=await response.json();
    if(response.ok&&result.success===true){showStatus('Doğrulama başarılı. hCaptcha sunucusu success: true döndürdü.','success');}
    else{showStatus('Doğrulama başarısız. '+(Array.isArray(result.errorCodes)?result.errorCodes.join(', '):'Cevap doğrulanamadı.')+' Yeniden dene düğmesine bas.','error');}
  }catch{showStatus('Yerel sunucuya ulaşılamadı. Sayfayı yenileyip tekrar dene.','error');}
};
window.captchaError=function(){showStatus('CAPTCHA yüklenemedi. hCaptcha panelinde hcaptcha.localtest.me alan adına izin verildiğini kontrol et. Ardından yeniden dene.','error');};
window.captchaExpired=function(){if(statusNode.dataset.state!=='success')showStatus('CAPTCHA cevabının süresi doldu. Yeniden dene düğmesine bas.','error');};
</script><script src="https://js.hcaptcha.com/1/api.js" async defer onerror="captchaError()"></script></body></html>`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const env = parseEnv(readFileSync(new URL('../../../../.env', import.meta.url), 'utf8'));
  const origin = 'http://hcaptcha.localtest.me:4319';
  const app = createHcaptchaPreview({
    siteKey: env.HCAPTCHA_SITE_KEY ?? '',
    secret: env.HCAPTCHA_SECRET ?? '',
    origin,
  });
  await app.listen({ host: '127.0.0.1', port: 4319 });
  console.log(`hCaptcha preview: ${origin}`);
}
