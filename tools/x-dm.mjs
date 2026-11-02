/**
 * Sends one announcement as an X direct message to a hand-kept list of handles,
 * through getxapi (https://docs.getxapi.com/docs/dm/dm-send).
 *
 *   pnpm dm --message "Akşam 19:00 reset geliyor"          # dry run: who, cost, duration
 *   pnpm dm --message-file .x-dm/sezon.txt --send          # really sends
 *   pnpm dm --message-file a.txt --message-file b.txt ...  # variants, dealt round-robin
 *
 * Everything private lives in the git-ignored `.x-dm/`:
 *   .x-dm/.env            GETXAPI_KEY, X_AUTH_TOKEN (the x.com `auth_token` cookie),
 *                         optional X_CT0 + X_TWID (both or neither)
 *   .x-dm/recipients.txt  one handle per line, `@` optional, `#` starts a comment line
 *   .x-dm/sent.jsonl      append-only log; a rerun of the same texts on the same day (or
 *                         with the same --campaign) skips every handle already sent
 *
 * Sends are sequential with a randomised 1–3 min gap: X flags bursts as automation (226).
 * An account-level failure (bad key/token, locked account, daily DM limit, the 226
 * automation flag) stops the run; retrying into 226 only deepens the flag.
 */
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const ENDPOINT = 'https://api.getxapi.com/twitter/dm/send';
const COST_PER_CALL = 0.002;
const MAX_TEXT = 10_000;
const MAX_ATTEMPTS = 3;
const HANDLE = /^[A-Za-z0-9_]{1,15}$/;

export function parseRecipients(text) {
  const usernames = [], invalid = [], seen = new Set();
  text.split(/\r?\n/).forEach((raw, index) => {
    const value = raw.trim();
    if (!value || value.startsWith('#')) return;
    const handle = value.replace(/^@/, '');
    if (!HANDLE.test(handle)) { invalid.push({ line: index + 1, value }); return; }
    const key = handle.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    usernames.push(handle);
  });
  return { usernames, invalid };
}

export function validateText(text) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Mesaj boş.');
  if (trimmed.length > MAX_TEXT) throw new Error(`Mesaj ${trimmed.length} karakter; X en fazla ${MAX_TEXT} kabul eder.`);
  return trimmed;
}

/** Same texts on the same local day are one campaign; tomorrow's identical reminder is a new one. */
export function campaignId(texts, date) {
  const text = Array.isArray(texts) ? texts.join('\u0000') : texts;
  const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return `${day}:${createHash('sha256').update(text).digest('hex').slice(0, 12)}`;
}

/** Outcome per the getxapi error reference: retry transient, skip this recipient, or stop everything. */
export function classify(status, body) {
  if (status >= 200 && status < 300) return 'sent';
  if (status === 429) return body?.twitter_error_code === 502 ? 'abort' : 'retry';
  if (body?.twitter_error_code === 226) return 'abort';
  if (status === 0 || status >= 500) return 'retry';
  if (status === 403 || status === 404) return 'skip';
  return 'abort';
}

export async function sendDm({ fetchImpl = fetch, apiKey, authToken, ct0, twid, username, text }) {
  const payload = { auth_token: authToken, recipient_username: username, text, ...(ct0 && twid ? { ct0, twid } : {}) };
  let status = 0, body;
  try {
    const res = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    status = res.status;
    body = await res.json().catch(() => ({ error: `HTTP ${status}, JSON olmayan yanıt` }));
  } catch (error) {
    body = { error: error instanceof Error ? error.message : String(error) };
  }
  return { outcome: classify(status, body), status, body };
}

const failure = (username, result) => ({
  username, status: result.status, error: result.body?.error ?? null, twitterErrorCode: result.body?.twitter_error_code ?? null,
});

export async function runCampaign({
  usernames, texts, send, sleep, record, report, campaign, now = () => new Date(),
  alreadySent = new Set(), gapMs, jitterMs, random = Math.random,
}) {
  const summary = { sent: 0, failed: 0, skippedAlreadySent: 0, aborted: null };
  const pending = usernames.filter(username => !alreadySent.has(username.toLowerCase()));
  summary.skippedAlreadySent = usernames.length - pending.length;

  for (const [index, username] of pending.entries()) {
    const variant = index % texts.length;
    let result;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      result = await send(username, texts[variant]);
      if (result.outcome !== 'retry' || attempt === MAX_ATTEMPTS) break;
      const wait = Number(result.body?.retry_after) > 0 ? Number(result.body.retry_after) * 1000 : 5000 * 3 ** (attempt - 1);
      report(`  ${username}: HTTP ${result.status}, ${Math.round(wait / 1000)} sn sonra tekrar (${attempt}/${MAX_ATTEMPTS - 1})`);
      await sleep(wait);
    }

    if (result.outcome === 'abort') {
      summary.aborted = failure(username, result);
      report(`✖ ${username}: HTTP ${result.status} ${result.body?.error ?? ''} — hesap düzeyi hata, gönderim durduruldu.`);
      return summary;
    }

    const at = now().toISOString();
    if (result.outcome === 'sent') {
      summary.sent++;
      record({ at, campaign, username, status: 'sent', variant, messageId: result.body?.data?.id ?? null });
      report(`✔ ${index + 1}/${pending.length} ${username}`);
    } else {
      summary.failed++;
      const { status, error, twitterErrorCode } = failure(username, result);
      record({ at, campaign, username, status: 'failed', variant, httpStatus: status, error, twitterErrorCode });
      report(`✖ ${index + 1}/${pending.length} ${username}: HTTP ${status}${twitterErrorCode ? ` (X ${twitterErrorCode})` : ''} ${error ?? ''}`);
    }

    if (index < pending.length - 1) await sleep(gapMs + Math.round(random() * jitterMs));
  }
  return summary;
}

function sentIn(logPath, campaign) {
  if (!existsSync(logPath)) return new Set();
  const handles = new Set();
  for (const line of readFileSync(logPath, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const entry = JSON.parse(line);
    if (entry.campaign === campaign && entry.status === 'sent') handles.add(String(entry.username).toLowerCase());
  }
  return handles;
}

async function main() {
  const { values } = parseArgs({ options: {
    message: { type: 'string' },
    'message-file': { type: 'string', multiple: true },
    campaign: { type: 'string' },
    list: { type: 'string', default: '.x-dm/recipients.txt' },
    log: { type: 'string', default: '.x-dm/sent.jsonl' },
    env: { type: 'string', default: '.x-dm/.env' },
    gap: { type: 'string', default: '60' },
    jitter: { type: 'string', default: '120' },
    send: { type: 'boolean', default: false },
  } });

  if (existsSync(values.env)) process.loadEnvFile(values.env);
  if (!values.message === !values['message-file']) throw new Error('--message veya --message-file verin (yalnız biri).');
  const texts = values.message ? [validateText(values.message)]
    : values['message-file'].map(path => validateText(readFileSync(path, 'utf8')));
  const gapMs = Number(values.gap) * 1000, jitterMs = Number(values.jitter) * 1000;
  if (!(gapMs >= 0 && jitterMs >= 0)) throw new Error('--gap ve --jitter saniye cinsinden sayı olmalı.');

  if (!existsSync(values.list)) throw new Error(`Alıcı listesi yok: ${values.list}`);
  const { usernames, invalid } = parseRecipients(readFileSync(values.list, 'utf8'));
  if (invalid.length) {
    for (const entry of invalid) console.error(`  satır ${entry.line}: "${entry.value}"`);
    throw new Error(`${invalid.length} geçersiz kullanıcı adı var; listeyi düzeltin, hiçbir şey gönderilmedi.`);
  }

  const campaign = values.campaign ?? campaignId(texts, new Date());
  const alreadySent = sentIn(values.log, campaign);
  const pending = usernames.filter(username => !alreadySent.has(username.toLowerCase())).length;
  const minutes = Math.ceil((Math.max(pending - 1, 0) * (gapMs + jitterMs / 2)) / 60_000);

  texts.forEach((text, index) => console.log(`Mesaj ${index + 1}/${texts.length} (${text.length} karakter):\n  ${text.replaceAll('\n', '\n  ')}`));
  console.log(`Kampanya ${campaign} · ${usernames.length} alıcı, ${alreadySent.size} zaten gönderilmiş, ${pending} bekliyor`);
  console.log(`Tahmini maliyet ≈ $${(pending * COST_PER_CALL).toFixed(3)} · süre ≈ ${minutes} dk`);
  if (!values.send) { console.log('Deneme modu: hiçbir şey gönderilmedi. Göndermek için --send ekleyin.'); return; }

  const apiKey = process.env.GETXAPI_KEY, authToken = process.env.X_AUTH_TOKEN;
  if (!apiKey || !authToken) throw new Error(`GETXAPI_KEY ve X_AUTH_TOKEN gerekli (${values.env}).`);
  mkdirSync(dirname(values.log), { recursive: true });

  const summary = await runCampaign({
    usernames, texts, campaign, alreadySent, gapMs, jitterMs,
    send: (username, text) => sendDm({ apiKey, authToken, ct0: process.env.X_CT0, twid: process.env.X_TWID, username, text }),
    sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
    record: entry => appendFileSync(values.log, `${JSON.stringify(entry)}\n`),
    report: line => console.log(line),
  });
  console.log(`Bitti: ${summary.sent} gönderildi, ${summary.failed} başarısız, ${summary.skippedAlreadySent} önceden gönderilmişti.`);
  if (summary.aborted) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch(error => { console.error(`Hata: ${error instanceof Error ? error.message : error}`); process.exitCode = 1; });
}
