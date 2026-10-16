import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

/** Real React screens with deterministic API-shaped fixtures; no game database writes. */
export async function verifyHonor(output, states = ['leaderboard', 'dominion-prizes', 'segmented', 'commander', 'success', 'breakdown', 'weak-target', 'defence', 'archive', 'long-score', 'target-weak', 'target-upper', 'target-related']) {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch();
  const measurements = [];
  try {
    for (const width of [350, 1280]) for (const language of ['tr', 'en', 'de', 'fr', 'es', 'ja']) {
      const page = await browser.newPage({ viewport: { width, height: 812 }, locale: language });
      await page.addInitScript(language => localStorage.setItem('astera.language', language), language);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.routeWebSocket('**/*', () => undefined);
      await page.goto(`${process.env.WEB ?? 'http://localhost:5173'}/v2-gallery.html?view=leaderboard&lng=${language}`);
      await page.locator('[data-v2-leaderboard]').waitFor();
      await page.evaluate(async language => {
        const resources = performance.getEntriesByType('resource').map(entry => entry.name);
        const url = path => resources.findLast(name => new URL(name).pathname === path) ?? path;
        const react = resources.find(name => /\/react\.js\?/.test(name));
        const dom = resources.find(name => /\/react-dom_client\.js\?/.test(name));
        const query = resources.find(name => /\/@tanstack_react-query\.js\?/.test(name));
        if (!react || !dom || !query) throw new Error('Missing gallery runtime');
        const [{ default: { createElement: h } }, { default: { createRoot } }, { QueryClient, QueryClientProvider },
          { Api }, { ApiProvider }, { LeaderboardScreen }, { CommanderCard }, { ReportScene }, { Sheet },
          { SeasonArchiveScreen }, { RankingScores }, { RankBadge }, { Segmented: LegacySegments },
          { Segmented: V2Segments }, { HonorTargetCard }, { StrategicReportSheet }, { StrikeSheet }, { default: i18n }] = await Promise.all([
          import(react), import(dom), import(query), import(url('/src/api/client.ts')), import(url('/src/api/context.tsx')),
          import(url('/src/screens/LeaderboardScreen.tsx')), import(url('/src/v2/hud/CommanderCard.tsx')),
          import(url('/src/v2/hud/ReportScene.tsx')), import(url('/src/v2/kit/Sheet.tsx')),
          import(url('/src/screens/SeasonArchiveScreen.tsx')), import(url('/src/ui/RankingScores.tsx')),
          import(url('/src/galaxy/RankBadge.tsx')), import(url('/src/ui/kit/Segmented.tsx')),
          import(url('/src/v2/kit/Segmented.tsx')), import(url('/src/ui/HonorTargetCard.tsx')),
          import(url('/src/screens/BattleReports.tsx')), import(url('/src/galaxy/FocusPanel.tsx')), import(url('/src/i18n/index.ts')),
        ]);
        await i18n.changeLanguage(language);
        const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
        const rows = [
          { playerId: 'rival', username: 'Andromeda Expedition Commander', score: 146_000_000, rank: 1, dominion: 1_500_000 },
          { playerId: 'me', username: 'Kestrel', score: 120_500_001, rank: 2, dominion: 84_500 },
          { playerId: 'returning', username: 'Orion', score: -250_000, rank: 4, dominion: -5_000 },
          { playerId: 'micro', username: 'Vantage', score: -1, rank: 3, dominion: 100 },
        ].sort((a, b) => a.rank - b.rank).map(row => ({ ...row, honor: row.score, country: 'TR', skinId: null, planetName: 'Bellwether',
          clan: { id: 'nova', tag: 'NOVA', name: 'Nova Expedition' } }));
        client.setQueryData(['leaderboard'], { ranking: 'HONOR', honorEnabled: true, honorSoloCredit: true, ladder: rows, you: rows[1],
          honorReward: { rank: 2, honor: rows[1].score, nominal: { alloy: 3500, crystal: 2500, deuterium: 500 },
            reward: { alloy: 3442, crystal: 2459, deuterium: 491 }, fullThreshold: 122_500_000 } });
        client.setQueryData(['leaderboard', 'DOMINION'], { ranking: 'DOMINION', honorEnabled: true,
          ladder: rows.map(row => ({ ...row, score: row.dominion })), you: { ...rows[1], score: rows[1].dominion } });
        const seasonId = '11111111-1111-4111-8111-111111111111';
        const season = { seasonId, ordinal: 12, shard: 'EU-1', shardName: 'Vantage', status: 'frozen',
          startsAt: new Date('2026-10-01'), endsAt: new Date('2026-10-14') };
        client.setQueryData(['season'], { ...season, honorSoloCredit: true, seasonReward: { ranking: 'HONOR', sourceSeasonId: 'previous',
          displayRank: 2, rewardPlace: 2, programVersion: 1, alloy: 34, crystal: 24, deuterium: 4 },
          seasonRewards: { version: 1, minimumDominion: 1,
          tiers: [[2000, 1500, 300], [1750, 1250, 250], [1500, 1000, 200], [1250, 750, 150],
            [1000, 500, 100], [750, 250, 50], [600, 175, 25], [450, 150, 15], [250, 75, 10], [200, 50, 5]]
            .map(([alloy, crystal, deuterium], index) => ({ place: index + 1, alloy, crystal, deuterium })) } });
        client.setQueryData(['seasonArchive'], { pages: [{ cycles: [{ ...season, galaxies: [season] }], nextCursor: null }], pageParams: [undefined] });
        // Use the exported key builder rather than duplicating archive cache names.
        const { keys } = await import(url('/src/api/keys.ts'));
        client.setQueryData(keys.seasonArchive, { pages: [{ cycles: [{ ...season, galaxies: [season] }], nextCursor: null }], pageParams: [undefined] });
        client.setQueryData(keys.archivedLeaderboard(seasonId), { season, record: null, ladder: rows.map((row, index) => ({
          resultId: `22222222-2222-4222-8222-${String(index + 1).padStart(12, '0')}`, rank: 4 - index,
          honorRank: row.rank, honorScore: row.honor, dominion: row.dominion, commanderName: row.username,
          country: row.country, title: 'Frontier Hand', self: row.playerId === 'me', reward: null,
        })) });
        const archivedBoard = client.getQueryData(keys.archivedLeaderboard(seasonId));
        const profileId = archivedBoard.ladder[1].resultId;
        const seedProfile = zero => client.setQueryData(keys.seasonCommanderProfile(profileId), {
          selected: { ...season, resultId: profileId, closedAt: season.endsAt, endReason: 'SCHEDULED_END',
            commanderName: 'Kestrel', planetName: 'Bellwether', country: 'TR', rank: 3, commanders: 4,
            honorRank: zero ? 1 : 2, honorScore: zero ? 0 : 120_500_001, honorCommanders: 4, dominion: 84_500,
            title: zero ? 'Commander' : 'Vanguard', recap: { commanderName: 'Kestrel', planetName: 'Bellwether',
              battles: 0, attacks: 0, defences: 0, rival: null, biggestRaid: null },
            stats: null, averages: null, legacyStats: null, legacyAverages: null, reward: null },
          career: { completedSeasons: 1, bestRank: zero ? null : 2, championships: 0, podiums: zero ? 0 : 1,
            topTen: zero ? 0 : 1, competitionTotals: { seasonsCovered: 1, battles: 0, attacks: 0, defences: 0,
              damageDealt: 0, damageTaken: 0 }, totals: null, seasons: [] },
        });
        const api = new Api({ fetch: async input => { throw new Error(`Unexpected fixture request: ${String(input)}`); } });
        const old = document.getElementById('root');
        old.style.display = 'none';
        const mount = document.createElement('div');
        mount.className = 'v2-shell min-h-dvh bg-v2-void';
        mount.style.setProperty('--v2-top-h', '3.25rem');
        mount.style.setProperty('--v2-dock-h', '0px');
        document.body.append(mount);
        const root = createRoot(mount);
        const noop = () => undefined;
        const report = { id: 'battle', missionId: 'mission', at: new Date(), grade: 'DECISIVE', attacking: true,
          opponentName: 'Vantage', opponentPlanet: 'Bellwether', opponentPlanetId: 'opponent', neutral: false,
          yourPlanet: 'Kestrel', rounds: [], yourLosses: { DART: 1 }, theirLosses: { TALON: 8 },
          yourFleet: { DART: 20 }, theirFleet: {}, lootAlloy: 3100, lootCrystal: 1000, lootDeuterium: 240,
          dominion: 840, honor: { delta: 3_250_001, reason: 'COMBAT', breakdown: {
            teamDelta: 6_500_002, rawTeamDelta: 7_000_000, participants: 2, contributionPpm: 500_000,
            militaryDamage: 5800, permanentLoss: 600, weakTargetDebit: true,
          } }, shieldAbsorbed: 0, cargoLimited: false,
          defenceSalvage: {}, yourDamage: [], disruptedMinutes: 0, wreckValue: 0, fuelPaid: 100 };
        window.__honorShow = state => {
          if (state === 'opening') client.setQueryData(['leaderboard'], previous => ({ ...previous,
            honorStartsAt: new Date('2026-10-15T12:00:00Z') }));
          if (state.startsWith('profile-')) {
            const zero = state === 'profile-zero';
            seedProfile(zero);
            client.setQueryData(keys.archivedLeaderboard(seasonId), !zero ? archivedBoard : { ...archivedBoard,
              ladder: archivedBoard.ladder.map(row => ({ ...row, honorScore: 0, honorRank: 1, title: 'Commander' })) });
          }
          const strategic = { kind: 'STRATEGIC', id: 'strategic', missionId: 'bomb:one', at: new Date(), attacking: true,
            opponentName: 'Andromeda Expedition Commander', opponentPlanet: 'Bellwether', opponentPlanetId: 'target',
            yourPlanet: 'Kestrel', yourPlanetId: 'origin', outcome: 'FIRST_STRIKE', damage: 0, destroyedFleet: {},
            destroyedResources: { alloy: 0, crystal: 0, deuterium: 0 }, levelChanges: [], destroyedOrders: [],
            shieldDestroyed: 500, loyalty: null, trigger: null,
            honor: { delta: 995024, reason: 'TACTICAL', breakdown: { teamDelta: 995024, rawTeamDelta: 1000000,
              participants: 1, contributionPpm: 1000000, militaryDamage: 0, permanentLoss: 0, weakTargetDebit: false, tactical: true } },
          };
          const content = state === 'radiation' || state === 'emp' ? h(StrategicReportSheet, {
            report: { ...strategic, ...(state === 'radiation' ? { opponentPlanet: '', opponentPlanetId: null,
              radiation: { level: 1, monumentOrdinal: 1, activeUntil: new Date(Date.now() + 60000) } } : {}) }, onClose: noop,
          }) : state === 'emp-launch' ? h(StrikeSheet, { target: { id: 'target', intel: 'RESOLVED', kind: 'COLONY', name: 'Bellwether' }, onClose: noop, onConfirm: noop })
          : state.startsWith('target-') ? h('div', { className: 'p-3' }, h(HonorTargetCard, {
            value: { enabled: true, eligible: true, kind: state === 'target-weak' ? 'WEAK' : state === 'target-upper' ? 'UPPER' : 'PEER',
              militaryReturn: state === 'target-upper' ? 'HALF' : 'FULL', related: state === 'target-related',
              repeated: true, retaliation: state === 'target-weak', soloCredit: true },
          })) : state === 'segmented' ? h('div', { className: 'grid gap-5 p-3 font-v2-ui' },
            h('p', { className: 'text-body font-semibold text-v2-ink' }, i18n.t('leaderboard.honorPrimary')),
            h(LegacySegments, { label: i18n.t('leaderboard.rankingChoice'), value: 'HONOR', onSelect: noop, segments: [
              { id: 'HONOR', label: h('span', { className: 'text-body font-bold text-v2-ink' }, 'Honor') },
              { id: 'DOMINION', label: h('span', { className: 'text-caption font-normal text-v2-ink-2' }, i18n.t('leaderboard.score')) },
            ] }),
            h(LegacySegments, { label: i18n.t('community.feedback.kindLabel'), value: 'BUG', onSelect: noop,
              segments: ['bug', 'suggestion', 'praise'].map((key, index) => ({ id: ['BUG', 'SUGGESTION', 'PRAISE'][index], label: i18n.t(`community.feedback.kinds.${key}`) })) }),
            h(LegacySegments, { label: i18n.t('leaderboard.archive.profileViews'), role: 'tablist', value: 'season', onSelect: noop,
              segments: [{ id: 'season', label: i18n.t('leaderboard.archive.seasonTab', { ordinal: 12 }) }, { id: 'overall', label: i18n.t('leaderboard.archive.overall') }] }),
            h(V2Segments, { label: i18n.t('clan.tabs.label'), value: 'strength', onChange: noop,
              options: ['overview', 'strength', 'members', 'aid', 'war'].map(id => ({ id, label: i18n.t(id === 'war' ? 'clanWar.tab' : `clan.tabs.${id}`) })) }),
            h(V2Segments, { label: i18n.t('intel.shelf.label'), value: 'reports', onChange: noop,
              options: ['watch', 'reports', 'radar'].map(id => ({ id, label: i18n.t(`intel.shelf.${id}`), dot: id === 'reports' })) }),
            h(LegacySegments, { label: i18n.t('menu.qualityLabel'), value: 'balanced', onSelect: noop,
              segments: ['high', 'balanced', 'low'].map(id => ({ id, label: i18n.t(`menu.quality.${id}`) })) }),
            h(RankingScores, { honor: 120_500_001, dominion: 84_500 }))
            : state === 'long-score' ? h('div', { className: 'grid gap-3 p-3' },
            h(RankBadge, { rank: 1, honor: true }),
            h(RankingScores, { honor: Number.MAX_SAFE_INTEGER, dominion: Number.MIN_SAFE_INTEGER }),
            h(RankingScores, { honor: -1, dominion: 0, change: true }))
            : state === 'leaderboard' || state === 'opening' ? h(LeaderboardScreen, { onFocusPlanet: noop })
            : state === 'commander' ? h('div', { className: 'p-3' }, h(CommanderCard, { name: 'Kestrel', country: 'TR',
              clan: rows[1].clan, galaxy: 'Vantage', seasonDay: 12, rank: { place: 2, of: 240 },
              honor: { score: rows[1].score, dominion: rows[1].dominion }, worlds: { held: 3, max: 4 }, shield: null, now: Date.now() }))
            : state === 'archive' || state.startsWith('profile-') ? h(SeasonArchiveScreen, { key: state, onFocusPlanet: noop, initialSeasonId: seasonId })
            : h('div', { className: 'p-3' }, h(ReportScene, { report: { ...report,
              ...(state === 'weak-target' ? { honor: { delta: -250_000, reason: 'WEAK_TARGET' } } : {}),
              ...(state === 'defence' ? { attacking: false, honor: { delta: 0, reason: 'NO_GAIN' } } : {}),
              ...(state === 'shared' || state === 'shared-loss' ? { honor: {
                delta: state === 'shared' ? 0 : -100_000, reason: state === 'shared' ? 'SHARED_SIDE' : 'ATTACK_LOSS',
                breakdown: { teamDelta: state === 'shared' ? 0 : -200_000, rawTeamDelta: state === 'shared' ? 0 : -200_000,
                  participants: 2, contributionPpm: 500_000, militaryDamage: 5800, permanentLoss: state === 'shared' ? 0 : 2000,
                  weakTargetDebit: false, sharedPositiveBlocked: true },
              } } : {}),
            }, word: i18n.t('reports.verdict.title.attacking.DECISIVE') }));
          const surface = state === 'radiation' || state === 'emp' || state === 'emp-launch' ? content : h(Sheet,
            { title: state === 'commander' || state.startsWith('profile-') ? 'Kestrel' : state === 'leaderboard' || state === 'opening' || state === 'archive' ? 'Honor' : i18n.t('leaderboard.honorBattleResult'),
              eyebrow: i18n.t('leaderboard.honorPrimary'), onClose: noop, detents: ['full'], bleed: true }, content);
          root.render(h(QueryClientProvider, { client }, h(ApiProvider, { api }, surface)));
        };
        window.__honorShow('leaderboard');
        window.__honorLanguage = () => ({ language: i18n.resolvedLanguage, heading: i18n.t('leaderboard.honorPrimary'),
          rules: i18n.t('leaderboard.honorRules'), prizeHint: i18n.t('leaderboard.honorPrizeHint') });
      }, language);
      for (const state of states) {
        await page.evaluate(state => window.__honorShow(state === 'dominion-prizes' || state === 'prize-rules' ? 'leaderboard' : state), state);
        if (state === 'dominion-prizes') {
          await page.evaluate(async () => {
            const { default: i18n } = await import('/src/i18n/index.ts');
            const buttons = [...document.querySelectorAll('[data-v2-leaderboard] button')];
            buttons.find(button => button.textContent.trim() === i18n.t('leaderboard.score')).click();
          });
          await page.locator('[data-reward-standing]').waitFor();
          await page.evaluate(async () => {
            const { default: i18n } = await import('/src/i18n/index.ts');
            const buttons = [...document.querySelectorAll('button[aria-expanded]')];
            const button = buttons.find(button => button.textContent.includes(i18n.t('leaderboard.rewards.table')));
            if (button.getAttribute('aria-expanded') !== 'true') button.click();
          });
          await page.locator('#season-reward-tier-list').waitFor();
        }
        const panel = page.getByRole('dialog').last();
        await panel.locator(state.startsWith('target-') ? '[data-honor-target]' : state === 'dominion-prizes' ? '[data-dominion-score]' : state === 'emp-launch' ? '[data-strike-sheet]' : '[data-honor-score]').first().waitFor();
        if (state === 'breakdown') await panel.locator('[data-honor-result] summary').click();
        if (state === 'shared' || state === 'shared-loss' || state.startsWith('target-')) {
          assert(await panel.locator('[data-honor-shared-policy]').isVisible(), `${language}/${width}: shared policy missing`);
          assert(!/leaderboard\./.test(await panel.locator('[data-honor-shared-policy]').innerText()), `${language}/${width}: untranslated shared policy`);
        }
        if (state.startsWith('profile-')) {
          await panel.getByRole('button', { name: /Kestrel/ }).click();
          await panel.getByRole('heading', { name: /Kestrel/ }).last().waitFor();
          const topText = await page.evaluate(async () => {
            const resource = performance.getEntriesByType('resource').findLast(entry => new URL(entry.name).pathname === '/src/i18n/index.ts');
            const { default: i18n } = await import(resource?.name ?? '/src/i18n/index.ts');
            return i18n.t('leaderboard.archive.percentile', { share: 25, rank: '1', commanders: '4' });
          });
          if (state === 'profile-zero') assert(await panel.getByText(topText, { exact: true }).count() === 0,
            `${language}/${width}/${state}: zero Honor advertised as top-percent achievement`);
        }
        if (state === 'prize-rules') {
          const labels = await page.evaluate(() => window.__honorLanguage());
          await panel.locator('summary').filter({ hasText: labels.rules }).click();
          assert(await panel.getByText(labels.prizeHint, { exact: true }).isVisible(),
            `${language}/${width}/${state}: hidden or untranslated tied prize explanation`);
        }
        if (state === 'opening') {
          const boundary = panel.getByTestId('honor-opening');
          assert(await boundary.isVisible(), `${language}/${width}: missing visible Honor opening`);
          assert.equal(await boundary.locator('time').getAttribute('datetime'), '2026-10-15T12:00:00.000Z');
          assert(!/leaderboard\./.test(await boundary.innerText()), `${language}/${width}: untranslated opening rule`);
        }
        await page.waitForTimeout(200);
        const locale = await page.evaluate(() => window.__honorLanguage());
        assert.equal(locale.language, language, `${language}/${width}/${state}: wrong fixture language`);
        if (!['emp', 'radiation', 'emp-launch'].includes(state)) assert(await panel.getByText(locale.heading, { exact: true }).count() > 0,
          `${language}/${width}/${state}: untranslated heading`);
        if (['emp', 'radiation', 'emp-launch'].includes(state)) assert(!/leaderboard\.|reports\.|planet\./.test(await panel.innerText()), `${language}/${width}/${state}: untranslated tactical copy`);
        if (state === 'leaderboard' || state === 'dominion-prizes') {
          const receipt = panel.locator('[data-season-prize-receipt]');
          assert(await receipt.count() === 1, `${language}/${width}/${state}: missing delivery receipt`);
          assert(!/leaderboard\./.test(await receipt.innerText()), `${language}/${width}/${state}: untranslated receipt`);
          assert(await receipt.getByText('34', { exact: true }).count() === 1,
            `${language}/${width}/${state}: wrong delivered resource amount`);
        }
        const measured = await panel.evaluate(node => {
          const scores = [...node.querySelectorAll('[data-ranking-scores]')];
          return {
            fits: node.scrollWidth <= node.clientWidth && document.documentElement.scrollWidth <= innerWidth,
            headerVisible: node.getBoundingClientRect().top >= 0 && node.querySelector('header').getBoundingClientRect().bottom <= innerHeight,
            scoresFit: scores.every(score => score.scrollWidth <= score.clientWidth),
            segmentsFit: [...node.querySelectorAll('.v2-segmented-option')].every(segment => segment.scrollWidth <= segment.clientWidth),
            hierarchy: scores.filter(score => score.querySelector('[data-honor-score]') && score.querySelector('[data-dominion-score]'))
              .map(score => {
                const primary = getComputedStyle(score.querySelector('[data-honor-score]'));
                const secondary = getComputedStyle(score.querySelector('[data-dominion-score]'));
                return { size: parseFloat(primary.fontSize) - parseFloat(secondary.fontSize),
                  weight: Number(primary.fontWeight) - Number(secondary.fontWeight), primary: primary.color, secondary: secondary.color };
              }),
          };
        });
        await page.screenshot({ path: join(output, `${language}-${width}-${state}.png`) });
        assert(measured.fits && measured.scoresFit, `${language}/${width}/${state}: horizontal overflow`);
        assert(measured.segmentsFit, `${language}/${width}/${state}: clipped segmented label`);
        assert(measured.headerVisible, `${language}/${width}/${state}: inaccessible sheet heading`);
        assert(measured.hierarchy.every(item => item.size >= 2 && item.weight >= 200 && item.primary !== item.secondary),
          `${language}/${width}/${state}: Honor hierarchy missing`);
        measurements.push({ width, language, state, ...measured });
      }
      assert.deepEqual(errors, []);
      await page.close();
      console.log(`PASS Honor ${language}/${width}: ladder, success, weak target, defence and archive`);
    }
  } finally { await browser.close(); }
  await writeFile(join(output, 'measurements.json'), `${JSON.stringify(measurements, null, 2)}\n`);
}
