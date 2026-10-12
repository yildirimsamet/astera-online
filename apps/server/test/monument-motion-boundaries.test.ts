import { expect,it } from 'vitest';
import { monumentFlight } from '../src/services/monumentMotion.js';
import {monumentMotion,interceptMotion} from '@astera/rules';

it('refuses a continuous meeting that rounds onto the exclusive season cutoff',()=>{
  const point={x:6000,y:0,z:0},from={x:4500,y:0,z:0};
  const m=monumentMotion(point,0);
  const root=interceptMotion(from,113,m,0,1e9)!;
  const endsAt=new Date(Math.ceil(root.arriveAt));
  expect(()=>monumentFlight(from,point,{rulesetVersion:17,startsAt:new Date(0),endsAt},113,new Date(0))).toThrow();
});
