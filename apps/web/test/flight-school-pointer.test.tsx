import { act, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SchoolPointer } from '../src/onboarding/flightSchool/SchoolPointer.js';
afterEach(() => { vi.useRealTimers(); });
it('waits for a settled control and never flashes on the previous menu during a transition', () => {
 vi.useFakeTimers();vi.spyOn(performance,'now').mockImplementation(()=>Date.now());
 vi.spyOn(window,'requestAnimationFrame').mockImplementation(fn => window.setTimeout(() => { fn(performance.now()); },16));
 vi.spyOn(window,'cancelAnimationFrame').mockImplementation(id => { clearTimeout(id); });
 const first=document.createElement('button'), next=document.createElement('button');document.body.append(first,next);
 vi.spyOn(first,'getBoundingClientRect').mockReturnValue(new DOMRect(30,120,100,44));
 vi.spyOn(next,'getBoundingClientRect').mockReturnValue(new DOMRect(30,300,100,44));
 let target: Element|null=first;
 const view=render(<SchoolPointer targets={() => target ? [target] : []} />);
 act(()=>{vi.advanceTimersByTime(250);});
 expect(document.querySelector('[data-school-highlight]')).toHaveStyle({visibility:'visible'});
 target=next;act(()=>{vi.advanceTimersByTime(32);});
 expect(document.querySelector('[data-school-highlight]')).toHaveStyle({visibility:'hidden'});
 target=null;act(()=>{vi.advanceTimersByTime(250);});
 expect(document.querySelector('[data-school-highlight]')).toHaveStyle({visibility:'hidden'});
 view.unmount();first.remove();next.remove();
});
it('scrolls the sheet body to a clipped target instead of scrolling the entire screen', () => {
 vi.useFakeTimers();vi.spyOn(performance,'now').mockImplementation(()=>Date.now());vi.spyOn(window,'requestAnimationFrame').mockImplementation(fn => window.setTimeout(()=>{fn(performance.now());},16));
 vi.spyOn(window,'cancelAnimationFrame').mockImplementation(id=>{clearTimeout(id);});
 const body=document.createElement('div');body.dataset.sheetBody='';const button=document.createElement('button');body.append(button);document.body.append(body);
 vi.spyOn(body,'getBoundingClientRect').mockReturnValue(new DOMRect(0,250,350,180));
 vi.spyOn(button,'getBoundingClientRect').mockReturnValue(new DOMRect(20,500,100,44));
 const scroll=vi.fn();body.scrollBy=scroll;
 const view=render(<SchoolPointer targets={()=>[button]} />);
 act(()=>{vi.advanceTimersByTime(250);});
 expect(scroll).toHaveBeenCalled();
 expect(document.querySelector('[data-school-highlight]')).toHaveStyle({visibility:'hidden'});
 view.unmount();body.remove();
});
it('repositions a target when the coach or phone resize reduces the same sheet viewport', () => {
 vi.useFakeTimers();vi.spyOn(performance,'now').mockImplementation(()=>Date.now());
 vi.spyOn(window,'requestAnimationFrame').mockImplementation(fn=>window.setTimeout(()=>{fn(performance.now());},16));
 vi.spyOn(window,'cancelAnimationFrame').mockImplementation(id=>{clearTimeout(id);});
 const body=document.createElement('div');body.dataset.sheetBody='';const button=document.createElement('button');body.append(button);document.body.append(body);
 let height=300;vi.spyOn(body,'getBoundingClientRect').mockImplementation(()=>new DOMRect(0,250,350,height));
 vi.spyOn(button,'getBoundingClientRect').mockReturnValue(new DOMRect(20,300,100,44));
 const scroll=vi.fn();body.scrollBy=scroll;
 const view=render(<SchoolPointer targets={()=>[button]} />);
 act(()=>{vi.advanceTimersByTime(250);});expect(scroll).not.toHaveBeenCalled();
 height=80;act(()=>{vi.advanceTimersByTime(600);});expect(scroll).toHaveBeenCalled();
 view.unmount();body.remove();
});

it('keeps the hand and highlight visible after fractional native scroll rounding', () => {
 vi.useFakeTimers();vi.spyOn(performance,'now').mockImplementation(()=>Date.now());
 vi.spyOn(window,'requestAnimationFrame').mockImplementation(fn=>window.setTimeout(()=>{fn(performance.now());},16));
 vi.spyOn(window,'cancelAnimationFrame').mockImplementation(id=>{clearTimeout(id);});
 const body=document.createElement('div');body.dataset.sheetBody='';const sticky=document.createElement('div');sticky.dataset.categoryBar='';
 const button=document.createElement('button');body.append(sticky,button);document.body.append(body);
 vi.spyOn(body,'getBoundingClientRect').mockReturnValue(new DOMRect(1,258.6875,348,277.3125));
 vi.spyOn(sticky,'getBoundingClientRect').mockReturnValue(new DOMRect(1,258.6875,348,62));
 vi.spyOn(button,'getBoundingClientRect').mockReturnValue(new DOMRect(10,330.390625,330,96));
 body.scrollBy=vi.fn();
 const view=render(<SchoolPointer targets={()=>[button]} />);
 act(()=>{vi.advanceTimersByTime(700);});
 expect(document.querySelector('[data-school-highlight]')).toHaveStyle({visibility:'visible'});
 expect(document.querySelector('img[src$="tutorial-hand-icon.png"]')?.parentElement).toHaveStyle({visibility:'visible'});
 view.unmount();body.remove();
});

it('frames the visible part of an oversized card without pointing under the dock', () => {
 vi.useFakeTimers();vi.spyOn(performance,'now').mockImplementation(()=>Date.now());
 vi.spyOn(window,'requestAnimationFrame').mockImplementation(fn=>window.setTimeout(()=>{fn(performance.now());},16));
 vi.spyOn(window,'cancelAnimationFrame').mockImplementation(id=>{clearTimeout(id);});
 const body=document.createElement('div');body.dataset.sheetBody='';const button=document.createElement('button');body.append(button);document.body.append(body);
 vi.spyOn(body,'getBoundingClientRect').mockReturnValue(new DOMRect(0,300,350,180));
 vi.spyOn(button,'getBoundingClientRect').mockReturnValue(new DOMRect(10,310,330,240));body.scrollBy=vi.fn();
 const view=render(<SchoolPointer targets={()=>[button]} />);
 act(()=>{vi.advanceTimersByTime(700);});
 expect(document.querySelector('[data-school-highlight]')).toHaveStyle({visibility:'visible',height:'170px'});
 view.unmount();body.remove();
});

it('hides both marks while a loading cover owns the screen', () => {
 vi.useFakeTimers();vi.spyOn(performance,'now').mockImplementation(()=>Date.now());
 vi.spyOn(window,'requestAnimationFrame').mockImplementation(fn=>window.setTimeout(()=>{fn(performance.now());},16));
 vi.spyOn(window,'cancelAnimationFrame').mockImplementation(id=>{clearTimeout(id);});
 const button=document.createElement('button');document.body.append(button);
 vi.spyOn(button,'getBoundingClientRect').mockReturnValue(new DOMRect(20,300,100,44));
 const view=render(<SchoolPointer targets={()=>[button]} />);act(()=>{vi.advanceTimersByTime(400);});
 const cover=document.createElement('div');cover.dataset.loadingScreen='';document.body.append(cover);
 act(()=>{vi.advanceTimersByTime(100);});
 expect(document.querySelector('[data-school-highlight]')).toHaveStyle({visibility:'hidden'});
 expect(document.querySelector('img[src$="tutorial-hand-icon.png"]')?.parentElement).toHaveStyle({visibility:'hidden'});
 view.unmount();button.remove();cover.remove();
});

it('shows a short production countdown immediately instead of spending it on a smooth scroll', () => {
 vi.useFakeTimers();vi.spyOn(performance,'now').mockImplementation(()=>Date.now());
 vi.spyOn(window,'requestAnimationFrame').mockImplementation(fn=>window.setTimeout(()=>{fn(performance.now());},16));
 vi.spyOn(window,'cancelAnimationFrame').mockImplementation(id=>{clearTimeout(id);});
 const body=document.createElement('div');body.dataset.sheetBody='';const queue=document.createElement('div');queue.dataset.queueLane='';body.append(queue);document.body.append(body);
 vi.spyOn(body,'getBoundingClientRect').mockReturnValue(new DOMRect(0,250,350,180));
 vi.spyOn(queue,'getBoundingClientRect').mockReturnValue(new DOMRect(20,-200,300,70));
 const scroll=vi.fn();body.scrollBy=scroll;const view=render(<SchoolPointer targets={()=>[queue]} showHand={false} />);
 act(()=>{vi.advanceTimersByTime(32);});expect(scroll).toHaveBeenCalledWith({top:-460,behavior:'instant'});
 view.unmount();body.remove();
});
