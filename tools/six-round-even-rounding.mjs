/** Round escape parameters, never observed results, then compare identical battles. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mulberry32 } from '../packages/rules/src/rng.ts';
import { prepareRoundEngine } from './distributed-damage-model.mjs';
import { aggregateSamples, buildCases, summarizeBattle } from './distributed-damage-study.mjs';
import { PRIORITY_POLICIES, priorityScore } from './six-round-priority-calibration.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
export function roundEvenFraction(value){
  if(!Number.isFinite(value)||value<0||value>1)throw new RangeError('percentage must be finite and between zero and one');
  // Epsilon handles decimal ties such as 29% without binary-float tie reversal.
  return Math.round((value*100+1e-9)/2)*2/100;
}
export function roundEscapePolicy(policy){
  const side=s=>({chance:roundEvenFraction(s.chance),threshold:roundEvenFraction(s.threshold)});
  return {id:`${policy.id}-even`,rows:policy.rows.map(row=>({...row,weak:side(row.weak),strong:side(row.strong)}))};
}

export async function runEvenRounding(){
  const started=Date.now(),original=PRIORITY_POLICIES.find(p=>p.id==='early275');
  const policies=[original,roundEscapePolicy(original)],engines=[];
  for(const p of policies)engines.push(await prepareRoundEngine(p.rows,6));
  const cases=buildCases([20,100]),rows=[];
  let battles=0,maxRssMiB=0;
  for(let i=0;i<cases.length;i++){
    const input=cases[i],trials=30,samples=[[],[]];
    const a=[{contributionId:'a',playerId:'a',fleet:input.attacker,tech:{tech:input.tech}}];
    const d=[{stackId:'host',playerId:'d',fleet:input.defender,tech:{tech:input.tech}}];
    for(let n=0;n<trials;n++){
      const seed=Math.imul(n+1,0x9e3779b1)^0xE6E62023^i;
      let baseline;
      for(let p=0;p<policies.length;p++){
        const r=engines[p].candidate(a,d,0,mulberry32(seed),true,true);
        if(p===0)baseline=r;else{
          assert.deepEqual(r.rounds[0]?.attackerLosses,baseline.rounds[0]?.attackerLosses);
          assert.deepEqual(r.rounds[0]?.defenderLosses,baseline.rounds[0]?.defenderLosses);
          if(input.ratio===1)assert.deepEqual(r,baseline);
        }
        const summary=summarizeBattle(input,r,engines[p].trace,5);
        for(const side of ['attacker','defender'])assert.ok(Math.abs(summary[side].active+summary[side].escape.reduce((s,c)=>s+c,0)-summary[side].physical)<1e-10);
        assert.ok(r.rounds.every(turn=>turn.round!==6||turn.retreats.length===0));
        samples[p].push(summary);battles++;
      }
    }
    rows.push({...input,trials,outcomes:Object.fromEntries(policies.map((p,j)=>[p.id,aggregateSamples(samples[j],5)]))});
    if(i%20===19){maxRssMiB=Math.max(maxRssMiB,Math.round(process.memoryUsage().rss/1048576));console.log(JSON.stringify({progress:i+1,cases:cases.length,battles,seconds:(Date.now()-started)/1000,maxRssMiB}));}
  }
  const checks=policies.map(p=>({id:p.id,...priorityScore(rows,p.id)}));
  const metadata={createdAt:new Date().toISOString(),battles,seconds:(Date.now()-started)/1000,maxRssMiB,rounds:6,retreatRounds:[1,2,3,4,5],
    rounding:'Nearest even integer percentage; ties upward. Only escape chance/HP windows, not ratio tiers or observed outcomes.',
    unchanged:'Ship stats, base shield25%, research bonuses, damage distribution, cargo/collector protection.',
    sampling:'200 cases, sizes20/100, all five profiles, shield0/4, both directions, 30 fresh paired seeds per case. Equal case weights.',
    limits:'CPUQuota100%,MemoryMax2G,MemorySwapMax0,heap1536MiB,v8-pool-size1.'};
  const output=resolve(ROOT,'docs/evidence/six-round-even-rounding-2026-10-23.json');
  mkdirSync(resolve(output,'..'),{recursive:true});writeFileSync(output,JSON.stringify({metadata,policies,checks,rows},null,2)+'\n');
  console.log(JSON.stringify({output,checks,...metadata}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await runEvenRounding();
