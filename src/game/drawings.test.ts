import { describe, expect, it } from 'vitest';
import { distToSegment, fibPrices, hitTest, rayEnd, snapPrice, type Drawing, type Projector } from './drawings';

// simple projector: 10px per candle, 1px per price unit, y grows downward from 200
const proj: Projector = { toXY: (pt) => ({ x: pt.i * 10, y: 200 - pt.p }), width: 1000 };
const toY = (p: number) => 200 - p;

describe('drawings geometry', () => {
  it('fibonacci levels run from b (0) back to a (1)', () => {
    const f = fibPrices(100, 200);
    expect(f[0]).toEqual({ level: 0, price: 200 });
    expect(f.find((x) => x.level === 0.5)!.price).toBe(150);
    expect(f.find((x) => x.level === 0.618)!.price).toBeCloseTo(138.2);
    expect(f[f.length - 1]).toEqual({ level: 1, price: 100 });
  });
  it('magnet snaps to the nearest OHLC within the threshold only', () => {
    const c = { time: 0, open: 100, high: 120, low: 90, close: 110 };
    expect(snapPrice(c, 118, toY)).toBe(120);
    expect(snapPrice(c, 91, toY)).toBe(90);
    expect(snapPrice(c, 160, toY)).toBe(160); // too far: unchanged
    expect(snapPrice(undefined, 150, toY)).toBe(150);
  });
  it('distance to segment clamps to the endpoints', () => {
    expect(distToSegment({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(5);
    expect(distToSegment({ x: 20, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(10);
  });
  it('rays extend to the edge in their direction', () => {
    expect(rayEnd({ x: 0, y: 100 }, { x: 10, y: 90 }, 1000)).toEqual({ x: 1000, y: -900 }); // slope −1
    expect(rayEnd({ x: 100, y: 100 }, { x: 90, y: 100 }, 1000)).toEqual({ x: 0, y: 100 });
  });
  it('hit testing finds the right drawing, top-most first', () => {
    const ds: Drawing[] = [
      { id: 'h', kind: 'hline', a: { i: 0, p: 150 } },
      { id: 't', kind: 'trend', a: { i: 10, p: 100 }, b: { i: 20, p: 120 } },
      { id: 'r', kind: 'rect', a: { i: 30, p: 100 }, b: { i: 40, p: 140 } },
      { id: 'y', kind: 'ray', a: { i: 50, p: 10 }, b: { i: 60, p: 20 } },
    ];
    expect(hitTest(ds, { x: 999, y: 52 }, proj)).toBe('h'); // y=50 for price 150
    expect(hitTest(ds, { x: 150, y: 90 }, proj)).toBe('t'); // midpoint of the trend line
    expect(hitTest(ds, { x: 350, y: 80 }, proj)).toBe('r'); // inside the rectangle
    expect(hitTest(ds, { x: 900, y: 150 }, proj)).toBe('y'); // far along the ray
    expect(hitTest(ds, { x: 150, y: 10 }, proj)).toBeNull();
  });
});
