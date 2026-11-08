import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAdviceMemory } from '../src/starter/tutorial/adviceMemory.js';

afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

/** Plan F3 (N1): what the player picked from the advisor's offers, kept per ship on this device. */
describe('the advisor remembers what the player chose', () => {
  it('starts with nothing chosen and nothing offered yet', () => {
    const { result } = renderHook(() => useAdviceMemory('memory-a'));
    expect(result.current[0]).toEqual({ pick: null, shown: false });
  });

  it('keeps a pick for its own ship, across a remount', () => {
    const first = renderHook(() => useAdviceMemory('memory-b'));
    act(() => { first.result.current[1]({ pick: 'collect', shown: true }); });
    expect(first.result.current[0]).toEqual({ pick: 'collect', shown: true });
    first.unmount();
    expect(renderHook(() => useAdviceMemory('memory-b')).result.current[0]).toEqual({ pick: 'collect', shown: true });
    expect(renderHook(() => useAdviceMemory('memory-c')).result.current[0]).toEqual({ pick: null, shown: false });
  });

  it('tells every reader of the same ship at once', () => {
    const one = renderHook(() => useAdviceMemory('memory-d'));
    const two = renderHook(() => useAdviceMemory('memory-d'));
    act(() => { one.result.current[1]({ pick: 'repair:AEGIS:1', shown: true }); });
    expect(two.result.current[0].pick).toBe('repair:AEGIS:1');
  });

  it('still remembers this visit when the device refuses to store it', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    const { result } = renderHook(() => useAdviceMemory('memory-e'));
    act(() => { result.current[1]({ pick: 'mine', shown: true }); });
    expect(result.current[0]).toEqual({ pick: 'mine', shown: true });
  });

  it('reads a stored value it does not understand as nothing chosen', () => {
    localStorage.setItem('astera.starter.advice.memory-f', '{"pick":7}');
    expect(renderHook(() => useAdviceMemory('memory-f')).result.current[0]).toEqual({ pick: null, shown: false });
    localStorage.setItem('astera.starter.advice.memory-g', 'not json');
    expect(renderHook(() => useAdviceMemory('memory-g')).result.current[0]).toEqual({ pick: null, shown: false });
  });

  it('keeps nothing without a ship', () => {
    const { result } = renderHook(() => useAdviceMemory(null));
    act(() => { result.current[1]({ pick: 'collect', shown: true }); });
    expect(result.current[0]).toEqual({ pick: null, shown: false });
    expect(localStorage.length).toBe(0);
  });
});
