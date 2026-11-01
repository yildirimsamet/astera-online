import { fireEvent, render } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { SchoolCamera } from '../src/onboarding/flightSchool/SchoolCamera.js';
import { createSchool, schoolGalaxy } from '../src/onboarding/flightSchool/world.js';
import { planetNodes } from '../src/galaxy/scene.js';
import { wasTap } from '../src/galaxy/tap.js';
import type { ReactNode } from 'react';
vi.mock('@react-three/fiber', async () => {
 const { PerspectiveCamera }=await import('three');
 const state={camera:new PerspectiveCamera(),invalidate:vi.fn(),gl:{domElement:document.createElement('canvas')}};
 return {useFrame:vi.fn(),useThree:(select:(s:typeof state)=>unknown)=>select(state)};
});
vi.mock('@react-three/drei',()=>({Html:({children}:{children:ReactNode})=><div>{children}</div>}));
vi.mock('../src/galaxy/tap.js',()=>({wasTap:vi.fn(()=>true),markHit:vi.fn()}));
const frame={at:0,from:36,to:45,center:{x:180,y:0,z:0},duration:2800,magnify:true};
it('draws selectable fog silhouettes until each world is discovered', () => {
 const w=createSchool(Date.now()),select=vi.fn();
 const nodes=planetNodes(schoolGalaxy(w).planets);
 const view=render(<SchoolCamera frame={frame} nodes={nodes} onSelect={select} />);
 const fog=document.querySelector('[data-school-fog="school-target"]');
 expect(fog).not.toBeNull();
 expect(document.querySelector('[data-school-fog="school-5"]')).toBeNull();
 fireEvent.pointerUp(fog!);expect(select).toHaveBeenCalledWith('school-target');
 w.instruments.TELESCOPE=1;
 view.rerender(<SchoolCamera frame={frame} nodes={planetNodes(schoolGalaxy(w).planets)} onSelect={select} />);
 expect(document.querySelector('[data-school-fog="school-target"]')).toBeNull();
 view.rerender(<SchoolCamera frame={{...frame,to:55}} nodes={planetNodes(schoolGalaxy(w).planets)} onSelect={select} />);
 expect(document.querySelector('[data-school-fog="school-5"]')).not.toBeNull();
});
it('does not interpret turning the galaxy as choosing a fogged world', () => {
 vi.mocked(wasTap).mockReturnValueOnce(false);
 const select=vi.fn();render(<SchoolCamera frame={frame} nodes={planetNodes(schoolGalaxy(createSchool(Date.now())).planets)} onSelect={select} />);
 fireEvent.pointerUp(document.querySelector('[data-school-fog="school-target"]')!);
 expect(select).not.toHaveBeenCalled();
});
