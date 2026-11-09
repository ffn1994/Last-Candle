export const fmtMoney = (n: number) =>
  `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

export const fmtSignedMoney = (n: number) => `${n >= 0 ? '+' : ''}${fmtMoney(n)}`;

export const fmtPct = (n: number, digits = 1) => `${n >= 0 ? '+' : ''}${n.toFixed(digits)}%`;

export const priceDigits = (p: number) => (p < 1 ? 4 : p < 20 ? 3 : 2);
export const fmtPrice = (p: number) => p.toFixed(priceDigits(p));

export const fmtUnits = (n: number) =>
  n.toLocaleString('en-US', { maximumFractionDigits: n < 10 ? 2 : 0 });
