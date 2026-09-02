import { createRoot } from 'react-dom/client';
import { LazyMotion, domMax } from 'motion/react';
import * as I from './ui/icons/index.js';
import { HullMark } from './ui/icons/hulls.js';
import {
  ArtWell,
  Bars,
  Button,
  Chip,
  EmptyState,
  Meter,
  GradeStamp,
  IconButton,
  Plate,
  PriceTag,
  Progress,
  Readout,
  ResourcePill,
  SectionHead,
  Skeleton,
  Stat,
} from './ui/kit/index.js';
import { instrumentArt, HULL_ART, planetArt, buildingArt, nextBuildingArt } from './ui/assets.js';
import { Sheet } from './ui/kit/index.js';
import { UpgradeRow } from './ui/UpgradeRow.js';
import './styles.css';

/**
 * A kitchen sink for the chrome system. Development only — `preview.html` is not part
 * of the app and is never linked from it. It exists so the material can be judged as
 * a set, at real phone size, before it is spread across eight screens.
 */

const ICONS: [string, (p: I.IconProps) => React.ReactNode][] = [
  ['alloy', I.AlloyIcon],
  ['crystal', I.CrystalIcon],
  ['planet', I.PlanetIcon],
  ['galaxy', I.GalaxyIcon],
  ['intel', I.IntelIcon],
  ['core', I.CoreIcon],
  ['refinery', I.RefineryIcon],
  ['extractor', I.ExtractorIcon],
  ['vault', I.VaultIcon],
  ['shipyard', I.ShipyardIcon],
  ['ring', I.RingIcon],
  ['telescope', I.TelescopeIcon],
  ['radar', I.RadarIcon],
  ['aegis', I.AegisIcon],
  ['veil', I.VeilIcon],
  ['drill', I.DrillIcon],
  ['incoming', I.IncomingIcon],
  ['returned', I.ReturnedIcon],
  ['raided', I.RaidedIcon],
  ['scan', I.ScanIcon],
  ['disrupted', I.DisruptedIcon],
  ['shielded', I.ShieldedIcon],
  ['lock', I.LockIcon],
  ['clock', I.ClockIcon],
  ['bell', I.BellIcon],
  ['homeworld', I.HomeworldIcon],
  ['arrow', I.ArrowIcon],
  ['chevron', I.ChevronIcon],
];

/**
 * The two layout faults the owner photographed, kept as a standing check.
 *
 * Both are pure layout, so they can be judged here without a season, an account
 * or a running API — which is the point: they were shipped because judging them
 * needed a live game, and nobody looked.
 */
function LayoutChecks() {
  return (
    <>
      <section>
        <SectionHead label="Sheet · sticky child" aside="must not cover the header" />
        <div className="relative h-[300px] overflow-hidden rounded-chip border border-line-soft">
          <div className="absolute inset-0">
            <Sheet title="Marrow-81" eyebrow="Your planet" onClose={() => undefined}>
              <div className="sticky top-0 -mx-4 grid grid-cols-4 gap-1 border-y border-line-soft bg-deep/95 px-4 py-2">
                {['Grow', 'See', 'Defend', 'Reach'].map((t) => (
                  <span key={t} className="legend py-2 text-center">
                    {t}
                  </span>
                ))}
              </div>
              {Array.from({ length: 14 }, (_, i) => (
                <p key={i} className="py-3 text-body text-dim">
                  Scroll me — row {String(i + 1)}
                </p>
              ))}
            </Sheet>
          </div>
        </div>
      </section>

      <section>
        <SectionHead label="UpgradeRow · long name" aside="must not truncate" />
        <Plate className="p-0">
          <UpgradeRow
            art={buildingArt('CORE', 2)}
            nextArt={nextBuildingArt('CORE', 2)}
            name="Command Core"
            level={2}
            role="Nothing may exceed the Core. It is the ceiling for everything."
            gain={{ label: 'Build ceiling', now: 'L2', next: 'L3' }}
            cost={{ alloy: 578, crystal: 152 }}
            held={{ alloy: 900, crystal: 400 }}
            income={{ alloyPerHour: 116, crystalPerHour: 40 }}
            verb="raise"
            onAct={() => undefined}
          />
          <UpgradeRow
            art={buildingArt('VAULT', 1)}
            name="Vault"
            level={1}
            role="Protects a floor of your stock from any raid."
            gain={{ label: 'Safe from any raid', now: '600', next: '780' }}
            cost={{ alloy: 4200, crystal: 900 }}
            held={{ alloy: 900, crystal: 400 }}
            income={{ alloyPerHour: 116, crystalPerHour: 40 }}
            verb="raise"
            onAct={() => undefined}
          />
        </Plate>
      </section>
    </>
  );
}

function Preview() {
  return (
    <div className="mx-auto max-w-[390px] space-y-8 px-4 py-6">
      <LayoutChecks />

      <section>
        <SectionHead label="Icons · 20px" aside="the list size" />
        <Plate className="grid grid-cols-7 gap-y-4 p-3">
          {ICONS.map(([name, Icon]) => (
            <div key={name} className="flex flex-col items-center gap-1">
              <span className="text-dim">
                <Icon className="size-5" />
              </span>
              <span className="text-micro text-faint">{name}</span>
            </div>
          ))}
        </Plate>
      </section>

      <section>
        <SectionHead label="Icons · 36px" />
        <Plate className="grid grid-cols-7 gap-y-3 p-3">
          {ICONS.map(([name, Icon]) => (
            <span key={name} className="flex justify-center text-crystal">
              <Icon className="size-9" />
            </span>
          ))}
        </Plate>
      </section>

      <section>
        <SectionHead label="Hulls · silhouettes" aside="wasp ▸ bulwark ▸ lance" />
        <Plate className="flex items-end justify-around p-3">
          {(['DART', 'PIKE', 'RAMPART', 'COURIER', 'BASTION'] as const).map((h) => (
            <div key={h} className="flex flex-col items-center gap-2">
              <span className="text-bone">
                <HullMark hull={h} className="size-11" />
              </span>
              <span className="text-micro text-faint">{h}</span>
            </div>
          ))}
        </Plate>
      </section>

      <section>
        <SectionHead label="Resource pills" />
        <div className="flex gap-2">
          <ResourcePill kind="alloy" value={584} cap={720} rate={58} />
          <ResourcePill kind="crystal" value={224} cap={224} rate={20} />
        </div>
      </section>

      <section>
        <SectionHead label="Slabs" />
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button variant="primary">Raise</Button>
            <Button>Build</Button>
            <Button variant="ghost">Later</Button>
            <Button disabled>Locked</Button>
          </div>
          <Button variant="commit" size="lg" full>
            Launch · cannot be recalled
          </Button>
          <div className="flex gap-2">
            <IconButton ariaLabel="signals" badge>
              <I.BellIcon className="size-5" />
            </IconButton>
            <IconButton ariaLabel="home" tone="ghost">
              <I.HomeworldIcon className="size-5" />
            </IconButton>
            <IconButton ariaLabel="alert" tone="primary" badge="threat">
              <I.IncomingIcon className="size-5" />
            </IconButton>
          </div>
        </div>
      </section>

      <section>
        <SectionHead label="Plates & tones" />
        <div className="space-y-2">
          <Plate className="p-4" tone="threat">
            <Chip tone="threat" icon={<I.IncomingIcon className="size-3" />}>
              Threat
            </Chip>
            <p className="mt-2 text-body text-bone">Nothing is defending this planet</p>
            <p className="mt-1 text-caption text-dim">508 above your vault floor.</p>
          </Plate>
          <Plate className="p-4" tone="opportunity">
            <Chip tone="opportunity">Window</Chip>
            <p className="mt-2 text-body text-bone">KESTREL-0 has no fleet at home</p>
          </Plate>
          <Plate cut className="p-4" tone="lit">
            <p className="legend">Cut plate · accent only</p>
            <Readout size="lg" tone="crystal" glow>
              3,748
            </Readout>
          </Plate>
        </div>
      </section>

      <section>
        <SectionHead label="Art wells" aside="I1 · art dims, copy never" />
        <Plate className="flex items-end gap-3 p-3">
          <ArtWell src={instrumentArt('TELESCOPE', 3)} size="lg" />
          <ArtWell src={HULL_ART.RAMPART} size="md" />
          <ArtWell src={HULL_ART.PIKE} size="md" locked />
          <ArtWell src={null} size="md" fallback={<HullMark hull="BASTION" className="size-9" />} />
        </Plate>
      </section>

      <section>
        <SectionHead label="Readings" />
        <Plate className="space-y-3 p-4">
          <div className="flex justify-between">
            <Stat label="Power" value="3,748" size="lg" />
            <Stat label="At risk" value="508" tone="threat" size="lg" align="right" />
          </div>
          <Progress have={390} need={620} label="saving for Vault L4" />
          <Meter value={9} cap={10} cells={12} tone="alloy" />
          <div className="flex items-center gap-3">
            <span className="text-clarity-clear">
              <Bars lit={4} />
            </span>
            <PriceTag alloy={2500} crystal={620} have={{ alloy: 584, crystal: 900 }} />
          </div>
          <div className="flex gap-2">
            <GradeStamp grade="DECISIVE" favourable />
            <GradeStamp grade="REPELLED" favourable={false} />
          </div>
        </Plate>
      </section>

      <section>
        <SectionHead label="Empty & loading" />
        <div className="space-y-2">
          <EmptyState
            icon={<I.TelescopeIcon className="size-7" />}
            title="You have no Telescope"
            action={<Button variant="primary" size="sm">Install one</Button>}
          >
            Extends the area where moving craft can be identified, and lets you watch
            a planet&apos;s fleet status silently.
          </EmptyState>
          <Plate className="flex gap-3 p-3">
            <Skeleton className="size-[74px]" />
            <div className="flex-1 space-y-2 py-2">
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </Plate>
        </div>
      </section>

      <section>
        <SectionHead label="Planet renders in sockets" />
        <div className="flex gap-2">
          <ArtWell src={planetArt('a')} size="lg" />
          <ArtWell src={planetArt('bb')} size="lg" />
          <ArtWell src={planetArt('ccc')} size="lg" locked />
        </div>
      </section>
    </div>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <LazyMotion features={domMax} strict>
      <Preview />
    </LazyMotion>,
  );
}
