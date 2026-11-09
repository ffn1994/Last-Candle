import { useEffect, useMemo, useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { ar } from '../i18n/ar';
import { defaultStop, positionSize, validateOpen } from '../game/engine';
import { fmtMoney, fmtPrice, fmtUnits, priceDigits } from '../format';
import type { OpenParams, RoundState, Side } from '../game/types';
import { isRevenge } from '../game/nerves';

const RISKS = [0.5, 1, 2, 5];

interface Props {
  side: Side | null;
  round: RoundState;
  price: number;
  atr: number;
  holdMs?: number;
  onClose: () => void;
  onConfirm: (p: OpenParams) => void;
  /** Whether this entry/stop counts as a trade based on the player's own analysis. */
  analysisFor?: (side: Side, stop: number | null) => boolean;
  /** an earnings report / rate decision is due within 3 candles */
  eventSoon?: boolean;
}

export function TradeSheet({ side, round, price, atr, holdMs, onClose, onConfirm, analysisFor, eventSoon }: Props) {
  const [risk, setRisk] = useState(1);
  const [stop, setStop] = useState('');
  const [tp, setTp] = useState('');
  const [noStop, setNoStop] = useState(false);
  const digits = priceDigits(price);

  useEffect(() => {
    if (!side) return;
    setRisk(1);
    setStop(defaultStop(side, price, atr).toFixed(digits));
    setTp('');
    setNoStop(false);
  }, [side, price, atr, digits]);

  const stopNum = noStop ? null : parseFloat(stop);
  const tpNum = tp.trim() === '' ? null : parseFloat(tp);
  const params: OpenParams | null = side
    ? { side, riskPct: risk, stop: stopNum !== null && Number.isFinite(stopNum) ? stopNum : null, tp: tpNum !== null && Number.isFinite(tpNum) ? tpNum : null }
    : null;
  const stopMissing = !noStop && (stopNum === null || !Number.isFinite(stopNum));
  const error = params ? (stopMissing ? 'badStop' : validateOpen(round, params, price)) : null;

  const calc = useMemo(() => {
    if (!params) return null;
    const dist = params.stop !== null ? Math.abs(price - params.stop) : 2 * atr;
    const size = positionSize(round.cash, risk, price, dist, round.mode);
    return { size, notional: size * price, maxLoss: size * dist };
  }, [params, price, atr, round.cash, round.mode, risk]);

  const nudge = (mult: number) => side && setStop(defaultStop(side, price, atr * (mult / 2)).toFixed(digits));

  return (
    <BottomSheet open={!!side} onClose={onClose} title={side === 'long' ? <span className="text-up">{ar.trade.titleLong}</span> : <span className="text-down">{ar.trade.titleShort}</span>}>
      <div className="space-y-5 pb-2">
        <div className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2 text-sm">
          <span className="text-muted">{ar.game.entry}</span>
          <span className="num font-semibold">{fmtPrice(price)}</span>
        </div>

        {eventSoon && (
          <p className="rounded-xl border border-gold/40 bg-gold/10 px-3 py-2 text-sm text-gold">{ar.fund.eventSoon}</p>
        )}
        {isRevenge(round) && (
          <p className="rounded-xl border border-down/40 bg-down/10 px-3 py-2 text-sm text-down">⚠ {ar.trade.revengeWarn}</p>
        )}

        <section>
          <h3 className="mb-2 text-sm text-muted">{ar.trade.riskPerTrade}</h3>
          <div className="grid grid-cols-4 gap-2">
            {RISKS.map((r) => {
              const active = r === risk;
              const high = r >= 5;
              return (
                <button
                  key={r} type="button" onClick={() => setRisk(r)}
                  className={`h-11 rounded-xl border text-base font-semibold transition ${
                    active ? (high ? 'border-down bg-down text-white' : 'border-gold bg-gold text-bg')
                      : high ? 'border-down/60 text-down' : 'border-border bg-surface-2'}`}
                >
                  <span className="num">{r}%</span>
                </button>
              );
            })}
          </div>
          {risk >= 5 && <p className="mt-2 text-sm font-semibold text-down">⚠ {ar.trade.highRisk}</p>}
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm text-muted">{ar.trade.stopLoss}</h3>
            <span className="text-xs text-muted">{ar.trade.stopHint}</span>
          </div>
          <div className="flex gap-2">
            <input
              type="number" inputMode="decimal" dir="ltr" disabled={noStop}
              value={noStop ? '' : stop} onChange={(e) => setStop(e.target.value)}
              className="num h-12 min-w-0 flex-1 rounded-xl border border-down/50 bg-surface-2 px-3 text-lg outline-none focus:border-down disabled:opacity-40"
            />
            {[1, 2, 3].map((m) => (
              <button key={m} type="button" disabled={noStop} onClick={() => nudge(m)}
                className="h-12 w-12 rounded-xl border border-border bg-surface-2 text-sm disabled:opacity-40">
                <span className="num">{m}×</span>
              </button>
            ))}
          </div>
          <label className="mt-3 flex cursor-pointer items-center gap-3 text-sm">
            <input type="checkbox" checked={noStop} onChange={(e) => setNoStop(e.target.checked)} className="h-5 w-5 accent-[#EA3943]" />
            <span>{ar.trade.noStop}</span>
            {noStop && <span className="rounded-md bg-down px-2 py-0.5 text-xs font-bold text-white">{ar.game.reckless}</span>}
          </label>
          {noStop && <p className="mt-2 text-sm text-down">{ar.trade.noStopWarn}</p>}
        </section>

        <section>
          <h3 className="mb-2 text-sm text-muted">{ar.trade.takeProfit}</h3>
          <input
            type="number" inputMode="decimal" dir="ltr" placeholder={ar.game.none}
            value={tp} onChange={(e) => setTp(e.target.value)}
            className="num h-12 w-full rounded-xl border border-up/40 bg-surface-2 px-3 text-lg outline-none focus:border-up"
          />
        </section>

        {calc && (
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-surface-2 p-3 text-center text-sm">
            <div><div className="text-muted">{ar.trade.positionSize}</div><div className="num font-semibold">{fmtUnits(calc.size)}</div></div>
            <div><div className="text-muted">{ar.trade.notional}</div><div className="num font-semibold">{fmtMoney(calc.notional)}</div></div>
            <div><div className="text-muted">{ar.trade.maxLoss}</div><div className="num font-semibold text-down">{noStop ? '∞' : fmtMoney(-calc.maxLoss)}</div></div>
          </div>
        )}

        {!error && side && params && analysisFor?.(side, params.stop) && (
          <p className="rounded-xl border border-up/40 bg-up/10 px-3 py-2 text-sm text-up">{ar.trade.analysisHint}</p>
        )}
        {error && error !== 'hasPosition' && <p className="text-sm text-down">{ar.trade.errors[error]}</p>}

        <div className="flex gap-3">
          <Button
            variant={side === 'long' ? 'buy' : 'sell'} className="flex-[2]" disabled={!!error} primary
            holdMs={holdMs}
            onClick={() => params && onConfirm(params)}
          >
            {ar.trade.confirm}{holdMs ? <span className="text-xs font-normal opacity-80">({ar.game.holdHint})</span> : null}
          </Button>
          <Button variant="secondary" className="flex-1" onClick={onClose}>{ar.trade.cancel}</Button>
        </div>
      </div>
    </BottomSheet>
  );
}
