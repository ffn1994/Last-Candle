import { describe, expect, it } from 'vitest';
import { bollinger, ema, macd, rsi, sma } from './indicators';

describe('indicators', () => {
  it('sma', () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  });
  it('ema seeds with sma then smooths', () => {
    const e = ema([1, 2, 3, 4, 5], 3);
    expect(e.slice(0, 2)).toEqual([null, null]);
    expect(e[2]).toBeCloseTo(2);
    expect(e[3]).toBeCloseTo(3); // 4*0.5 + 2*0.5
    expect(e[4]).toBeCloseTo(4);
  });
  it('bollinger bands are symmetric around the sma', () => {
    const v = [2, 4, 4, 4, 5, 5, 7, 9];
    const b = bollinger(v, 8, 2);
    expect(b.mid[7]).toBeCloseTo(5);
    expect(b.upper[7]).toBeCloseTo(9); // population sd = 2
    expect(b.lower[7]).toBeCloseTo(1);
  });
  it('rsi is 100 on a straight rise, 0 on a straight fall, ~50 when flat-ish', () => {
    const up = Array.from({ length: 30 }, (_, i) => 100 + i);
    expect(rsi(up)[29]).toBe(100);
    const down = up.slice().reverse();
    expect(rsi(down)[29]).toBeCloseTo(0);
    const zig = Array.from({ length: 40 }, (_, i) => 100 + (i % 2));
    expect(rsi(zig)[39]!).toBeGreaterThan(40);
    expect(rsi(zig)[39]!).toBeLessThan(60);
  });
  it('macd histogram = line − signal', () => {
    const v = Array.from({ length: 80 }, (_, i) => 100 + Math.sin(i / 5) * 10 + i * 0.2);
    const m = macd(v);
    expect(m.line[24]).toBeNull();
    expect(m.line[25]).not.toBeNull();
    expect(m.signal[33]).not.toBeNull();
    for (let i = 33; i < 80; i++) expect(m.hist[i]).toBeCloseTo(m.line[i]! - m.signal[i]!);
  });
});
