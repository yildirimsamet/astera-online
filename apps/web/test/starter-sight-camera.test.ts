import {renderHook} from '@testing-library/react';
import {useSightRequest} from '../src/galaxy/OpeningViews.js';
import {expect,it} from 'vitest';
import { starterSightDistance } from '../src/galaxy/follow.js';
it('waits for the opening camera to finish, then fits a complete sensor sphere on a phone',()=>{
 const ready={radius:9,fov:45,aspect:350/812,sceneReady:true,openingReady:true,covered:false};
 for(const blocked of [{...ready,sceneReady:false},{...ready,openingReady:false},{...ready,covered:true}])expect(starterSightDistance(blocked)).toBeNull();
 const distance=starterSightDistance(ready);
 const halfFov=Math.atan(Math.tan(Math.PI/8)*350/812);
 expect(distance).not.toBeNull();expect(distance!*Math.sin(halfFov)).toBeGreaterThanOrEqual(9*1.5);
});

it('requeues the overview after late home coordinates arrive, while identical galaxy refreshes leave the chosen view alone',()=>{
 const invalidate=()=>undefined;
 const view=renderHook(({x,covered,homeSignal})=>useSightRequest(9,[x,0,0],covered,invalidate,homeSignal),{initialProps:{x:0,covered:true,homeSignal:0}});
 view.result.current.current=undefined;
 view.rerender({x:10,covered:false,homeSignal:0});expect(view.result.current.current).toBe(9);
 view.result.current.current=undefined;
 view.rerender({x:10,covered:false,homeSignal:0});expect(view.result.current.current).toBeUndefined();
 view.rerender({x:10,covered:false,homeSignal:1});expect(view.result.current.current).toBe(9);
 view.result.current.current=undefined;
 view.rerender({x:10,covered:false,homeSignal:1});expect(view.result.current.current).toBeUndefined();
});

