/** Bounded geometry audit, not production movement or a season/economy simulation.
 * Rotation order matches DysonShells: RY * RX (shared identity initial tilt).
 * Run: nice -n 10 node --import tsx tools/monument-two-axis-audit.mjs
 */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { createRequire } from 'node:module';
import { MONUMENT_SEASON_DEFAULTS, MULTI_WORLD, GALAXY, TRAVEL,
  generateGalaxy, distance, travelExact } from '../packages/rules/src/index.ts';
const { Quaternion, Vector3 } = createRequire(new URL('../apps/web/package.json', import.meta.url))('three');

const seed = 20261012;
const points = MONUMENT_SEASON_DEFAULTS.positions;
const origins = generateGalaxy(seed, MULTI_WORLD.capitalSlots).slots.filter((_, i) => i % 4 === 0);
const speed = 113;
const v = 1 / travelExact(1, speed);
const maxFlight = travelExact(MONUMENT_SEASON_DEFAULTS.radius + GALAXY.radius, speed);
const times = Array.from({ length: 48 }, (_, i) => ((i * 0.6180339887498949) % 1) * (30 * 1440 - maxFlight));
const length = p => Math.hypot(p.x, p.y, p.z);
function motion(p, t, config) {
  const wy = 2*Math.PI/(config.yHours*60), wx = 2*Math.PI/(config.xHours*60);
  const cy = Math.cos(wy*t), sy = Math.sin(wy*t), cx = Math.cos(wx*t), sx = Math.sin(wx*t);
  const a = p.y*cx-p.z*sx, b = p.y*sx+p.z*cx;
  const at = { x:p.x*cy+b*sy, y:a, z:-p.x*sy+b*cy };
  const velocity = { x:wy*at.z+wx*a*sy, y:-wx*b, z:-wy*at.x+wx*a*cy };
  return { at, velocity };
}
function meeting(from, p, now, config) {
  // For rotation p'=omega×p and fixed origin a:
  // |d|p-a|/dt| = |omega·(a×p)|/|p-a| <= |omega| |a|.
  // This sharper radial bound guarantees a unique root even when the
  // monument's total surface speed exceeds the fleet speed.
  const omega = Math.hypot(2*Math.PI/(config.yHours*60),2*Math.PI/(config.xHours*60));
  assert.ok(v > omega*length(from), 'This audit requires a proven strictly decreasing root function');
  let lo=0, hi=maxFlight*(1+1e-12);
  for(let i=0;i<48;i++) {
    const mid=(lo+hi)/2;
    if(distance(from,motion(p,now+mid,config).at)>v*mid) lo=mid; else hi=mid;
  }
  const minutes=(lo+hi)/2;
  const initial=motion(p,now,config), end=motion(p,now+minutes,config);
  const displacement={x:end.at.x-initial.at.x,y:end.at.y-initial.at.y,z:end.at.z-initial.at.z};
  const initialVelocity=length(initial.velocity);
  assert.ok(initialVelocity>1e-8);
  const signedForward=(displacement.x*initial.velocity.x+displacement.y*initial.velocity.y+displacement.z*initial.velocity.z)/initialVelocity;
  assert.ok(Math.abs(distance(from,end.at)/v-minutes)<1e-7);
  assert.ok(Math.abs(length(end.at)-6000)<1e-7);
  return { from, initial:initial.at, at:end.at, now, minutes,
    initialDistance:distance(from,initial.at), distanceRatio:distance(from,end.at)/distance(from,initial.at),
    horizontalDegrees:360*minutes/(config.yHours*60),verticalDegrees:360*minutes/(config.xHours*60),
    chordAngleDegrees:Math.acos(Math.max(-1,Math.min(1,(initial.at.x*end.at.x+initial.at.y*end.at.y+initial.at.z*end.at.z)/6000**2)))*180/Math.PI,
    signedForward, initialVelocity };
}
const stats=values=>{
  const s=[...values].sort((a,b)=>a-b);
  return {min:s[0],mean:s.reduce((a,b)=>a+b,0)/s.length,p50:s[Math.floor((s.length-1)*.5)],p95:s[Math.floor((s.length-1)*.95)],max:s.at(-1)};
};
const summarize=rows=>({count:rows.length,minutes:stats(rows.map(r=>r.minutes)),
  horizontalDegrees:stats(rows.map(r=>r.horizontalDegrees)),verticalDegrees:stats(rows.map(r=>r.verticalDegrees)),
  chordAngleDegrees:stats(rows.map(r=>r.chordAngleDegrees)),distanceRatio:stats(rows.map(r=>r.distanceRatio)),
  behindInitialTangent:rows.filter(r=>r.signedForward< -1e-7).length,
  eitherAxisCompletesTurn:rows.filter(r=>r.horizontalDegrees>=360||r.verticalDegrees>=360).length});
const configurations=[{yHours:8,xHours:8},{yHours:8,xHours:8*233/150},{yHours:8,xHours:16},
  {yHours:12,xHours:12*233/150}];
const scenarios=[];
for(const config of configurations) {
  const omega=Math.hypot(2*Math.PI/(config.yHours*60),2*Math.PI/(config.xHours*60));
  assert.ok(v>omega*GALAXY.radius);
  // Numeric derivative and rigid-body invariants independently check the evaluator.
  let derivativeMaxError=0, radiusMaxError=0, separationMaxError=0, quaternionMaxError=0;
  for(const t of times) {
    const moved=points.map(p=>motion(p,t,config).at);
    for(let i=0;i<points.length;i++) {
      radiusMaxError=Math.max(radiusMaxError,Math.abs(length(moved[i])-6000));
      const p=points[i], h=1e-3;
      const q=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),2*Math.PI*t/(config.yHours*60))
        .multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),2*Math.PI*t/(config.xHours*60)));
      quaternionMaxError=Math.max(quaternionMaxError,distance(moved[i],new Vector3(p.x,p.y,p.z).applyQuaternion(q)));
      const before=motion(p,t-h,config).at,after=motion(p,t+h,config).at;
      derivativeMaxError=Math.max(derivativeMaxError,distance(motion(p,t,config).velocity,
        {x:(after.x-before.x)/(2*h),y:(after.y-before.y)/(2*h),z:(after.z-before.z)/(2*h)}));
      for(let j=0;j<i;j++) separationMaxError=Math.max(separationMaxError,Math.abs(distance(points[i],points[j])-distance(moved[i],moved[j])));
    }
  }
  assert.ok(radiusMaxError<1e-7&&separationMaxError<1e-7&&derivativeMaxError<1e-4&&quaternionMaxError<1e-7);
  const rows=[];const start=performance.now();
  for(const from of origins) for(const p of points) for(const now of times) rows.push(meeting(from,p,now,config));
  const solverWallMs=performance.now()-start;
  const behind=rows.filter(r=>r.signedForward< -1e-7);
  // A separate scan checks all initial X phases and every feasible flight
  // duration band, independent of the sampled origins. Initial Y cancels by
  // rotational invariance. This is finite numerical coverage, not a proof.
  let denseMinForward=Infinity, denseBehind=0;
  const minFlight=travelExact(MONUMENT_SEASON_DEFAULTS.radius-GALAXY.radius,speed);
  const phaseSteps=1024,durationSteps=256;
  for(const p of points) for(let phase=0;phase<phaseSteps;phase++) {
    const now=phase*config.xHours*60/phaseSteps;
    const initial=motion(p,now,config);
    const initialSpeed=length(initial.velocity);
    assert.ok(initialSpeed>1e-8);
    for(let step=0;step<=durationSteps;step++) {
      const dt=minFlight+(maxFlight-minFlight)*step/durationSteps;
      const end=motion(p,now+dt,config).at;
      const forward=((end.x-initial.at.x)*initial.velocity.x+(end.y-initial.at.y)*initial.velocity.y
        +(end.z-initial.at.z)*initial.velocity.z)/initialSpeed;
      denseMinForward=Math.min(denseMinForward,forward);
      if(forward< -1e-7) denseBehind++;
    }
  }
  scenarios.push({...config,maxDistanceDerivative:omega*GALAXY.radius,
    maxMonumentSurfaceSpeed:omega*6000,uniqueRootSpeedThreshold:omega*GALAXY.radius*TRAVEL.distanceFactor,
    all:summarize(rows),nearUnder3000:summarize(rows.filter(r=>r.initialDistance<=3000)),
    checks:{derivativeMaxError,radiusMaxError,separationMaxError,quaternionMaxError},solverWallMs,
    denseForwardCheck:{phaseSteps,durationSteps:durationSteps+1,cases:points.length*phaseSteps*(durationSteps+1),
      minFlight,maxFlight,minSignedForward:denseMinForward,behind:denseBehind,
      caveat:'Numerical grid over X phase and all feasible durations, not an interval-certified proof'},
    worstBehind:behind.length?behind.reduce((a,b)=>a.signedForward<b.signedForward?a:b):null,
    worstDistanceRatio:rows.reduce((a,b)=>a.distanceRatio>b.distanceRatio?a:b)});
}
const output={scope:'Finite geometric queries across sampled launch phases; no economy simulation or production changes',
  seed,origins:origins.length,monuments:points.length,launchTimes:times,
  assumption:'Actual effective catalogue fleet speed 113; source travelExact distanceFactor used. Equal weight per sampled origin/monument/time, not observed gameplay.',
  speed,travelDistanceFactor:TRAVEL.distanceFactor,fleetUnitsPerMinute:v,maxFlightMinutes:maxFlight,
  model:'RY(2*pi*t/Py) * RX(2*pi*t/Px) * initialPosition; same rigid transform for all eight monuments',scenarios};
await mkdir('docs/evidence',{recursive:true});
const file='docs/evidence/monument-two-axis-audit-2026-10-12.json';
await writeFile(file,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output,null,2));
console.log(file);
