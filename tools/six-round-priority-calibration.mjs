/** Prioritize average escaped share at ratios 2 and 3; observe close fights later. */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mulberry32 } from '../packages/rules/src/rng.ts';
import { prepareRoundEngine } from './distributed-damage-model.mjs';
import { SIX_BALANCED } from './six-round-retreat-calibration.mjs';
import { aggregateSamples, buildCases, summarizeBattle } from './distributed-damage-study.mjs';
import { buildMainCases } from './combat-four-rounds-study.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const policy=(id,chance,threshold=.60,thirdChance=.40,thirdThreshold=.75)=>{
  const rows=structuredClone(SIX_BALANCED.rows);
  rows[2].weak={chance,threshold};rows[3].weak={chance:thirdChance,threshold:thirdThreshold};
  return {id,rows};
};
export const PRIORITY_POLICIES=[{id:'reference',rows:structuredClone(SIX_BALANCED.rows)},
  policy('p25',.25),policy('p275',.275),policy('p30',.30),
  policy('early25',.25,.65,.35,.80),policy('early275',.275,.65,.40,.80)];
const gap=(n,lo,hi)=>Math.max(lo-n,0,n-hi);
export function priorityScore(rows,id){
  const cells=[];
  for(const ratio of [2,3])for(const shieldLevel of [0,4]){
    const group=rows.filter(r=>r.ratio===ratio&&r.shieldLevel===shieldLevel);
    assert.ok(group.length>0);
    const escaped=group.reduce((sum,r)=>sum+r.outcomes[id].weak.escape.reduce((s,n)=>s+n,0),0)/group.length;
    const strongControl=group.reduce((sum,r)=>sum+r.outcomes[id].controls[r.strongSide==='DEFENCE'?'DEFENDER':'ATTACKER'],0)/group.length;
    const [lo,hi]=ratio===2?[.15,.25]:[.20,.30];
    cells.push({ratio,shieldLevel,escaped,strongControl,lo,hi});
  }
  const violation=cells.reduce((sum,c)=>sum+gap(c.escaped,c.lo,c.hi)**2+gap(c.strongControl,.95,1)**2,0);
  const centering=cells.reduce((sum,c)=>sum+(c.escaped-(c.lo+c.hi)/2)**2,0);
  return {feasible:violation===0,violation,centering,cells};
}

export async function runPriority(stage='screen'){
  const screening=stage==='screen',started=Date.now();
  let policies=PRIORITY_POLICIES;
  if(!screening){
    const screen=JSON.parse(readFileSync(resolve(ROOT,'docs/evidence/six-round-priority-screen-2026-10-23.json'),'utf8'));
    const chosen=screen.ranking.find(p=>p.id!=='reference').id;
    policies=PRIORITY_POLICIES.filter(p=>p.id==='reference'||p.id===chosen);
  }
  const engines=[];for(const p of policies)engines.push(await prepareRoundEngine(p.rows,6));
  const cases=screening?buildCases([20,100]).filter(c=>[2,3].includes(c.ratio)&&c.strongSide==='ATTACK'):buildMainCases();
  const rows=[];let battles=0,maxRssMiB=0;
  for(let i=0;i<cases.length;i++){
    const input=cases[i],trials=screening?50:input.size>=200?10:input.size>=100?20:input.size>=50?40:100;
    const a=[{contributionId:'a',playerId:'a',fleet:input.attacker,tech:{tech:input.tech}}];
    const d=[{stackId:'host',playerId:'d',fleet:input.defender,tech:{tech:input.tech}}];
    const samples=policies.map(()=>[]);
    for(let n=0;n<trials;n++){
      const seed=Math.imul(n+1,0x9e3779b1)^(screening?0xA1622023:0xA1632023)^i;
      let firstLosses,firstResult;
      for(let p=0;p<policies.length;p++){
        const r=engines[p].candidate(a,d,0,mulberry32(seed),true,true);
        const losses=[r.rounds[0]?.attackerLosses,r.rounds[0]?.defenderLosses];
        if(p===0){firstLosses=losses;firstResult=r;}else{
          assert.deepEqual(losses,firstLosses);
          if(input.ratio<2)assert.deepEqual(r,firstResult);
        }
        const summary=summarizeBattle(input,r,engines[p].trace,5);
        for(const side of ['attacker','defender'])assert.ok(Math.abs(summary[side].active+summary[side].escape.reduce((s,n)=>s+n,0)-summary[side].physical)<1e-10);
        assert.ok(r.rounds.every(turn=>turn.round!==6||turn.retreats.length===0));
        samples[p].push(summary);battles++;
      }
    }
    rows.push({...input,trials,outcomes:Object.fromEntries(policies.map((p,j)=>[p.id,aggregateSamples(samples[j],5)]))});
    if(i%10===9){maxRssMiB=Math.max(maxRssMiB,Math.round(process.memoryUsage().rss/1048576));console.log(JSON.stringify({stage,progress:i+1,cases:cases.length,battles,seconds:(Date.now()-started)/1000,maxRssMiB}));}
  }
  const ranking=policies.map(p=>({id:p.id,...priorityScore(rows,p.id)})).sort((a,b)=>a.violation-b.violation||a.centering-b.centering);
  const metadata={stage,createdAt:new Date().toISOString(),battles,seconds:(Date.now()-started)/1000,maxRssMiB,
    rounds:6,retreatRounds:[1,2,3,4,5],shipStatsChanged:false,sourceHash:engines[0].sourceHash,
    objective:'First average weak escaped share 15..25% at 2x and 20..30% at 3x, separately for shield0/4; observe 1/1.5, do not optimize them.',
    sampling:'Screen sizes20/100, stronger attacker, 50 seeds. Held-out validation sizes20/50/100/200, both directions,100/40/20/10 seeds.',
    weighting:'Equal weight per composition/size/direction/shield/ratio case. No per-battle quota.',
    limits:'CPUQuota100%, MemoryMax2G, MemorySwapMax0, heap1536MiB, v8-pool-size1.'};
  const output=resolve(ROOT,`docs/evidence/six-round-priority-${stage}-2026-10-23.json`);
  mkdirSync(resolve(output,'..'),{recursive:true});writeFileSync(output,JSON.stringify({metadata,policies,ranking,rows},null,2)+'\n');
  console.log(JSON.stringify({output,ranking,...metadata}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await runPriority(process.argv.find(a=>a.startsWith('--stage='))?.slice(8)??'screen');
