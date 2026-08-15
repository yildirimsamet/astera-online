/**
 * Where to point a phone.
 *
 * The dev machine's address is handed out by DHCP, so it changes — and the box
 * also carries half a dozen Docker bridge addresses that look exactly like real
 * ones in `ifconfig`. Guessing wrong costs a few minutes of "why won't it load",
 * every time. This prints the one address a phone on the same WiFi can actually
 * reach, and a QR code so nobody has to type it.
 *
 *   pnpm phone
 */
import { networkInterfaces } from 'node:os';
import { spawnSync } from 'node:child_process';

const PORT = process.env.PORT ?? '5173';

/**
 * Docker's default pools. Real, routable, and useless to a phone.
 *
 * @param {string} address
 * @returns {boolean}
 */
const isDockerBridge = (address) => /^172\.(1[6-9]|2\d|3[01])\./.test(address);

const candidates = Object.entries(networkInterfaces())
  .flatMap(([name, addresses]) => (addresses ?? []).map((entry) => ({ name, ...entry })))
  .filter((entry) => entry.family === 'IPv4' && !entry.internal)
  .filter((entry) => !isDockerBridge(entry.address))
  // A wireless interface is the likely answer when a phone is involved.
  .sort((a, b) => Number(b.name.startsWith('w')) - Number(a.name.startsWith('w')));

const best = candidates[0];

if (!best) {
  console.error('No LAN address found. Is this machine on WiFi?');
  process.exit(1);
}

const url = `http://${best.address}:${PORT}/`;

console.log('');
console.log(`  Open this on your phone, on the same WiFi:\n`);
console.log(`      ${url}   (${best.name})`);
if (candidates.length > 1) {
  console.log(`\n  Other interfaces: ${candidates.slice(1).map((c) => c.address).join(', ')}`);
}

// Optional. Present on most Linux boxes, absent on plenty of others.
const qr = spawnSync('qrencode', ['-t', 'UTF8', '-m', '2', url], { encoding: 'utf8' });
if (qr.status === 0) console.log(`\n${qr.stdout}`);

console.log('  The API is proxied through this same address — nothing else to start.');
console.log('  If it will not load: check the phone is on the same network, and that');
console.log('  the router does not have client isolation turned on.\n');
