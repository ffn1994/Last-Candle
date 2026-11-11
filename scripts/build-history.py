"""
Extract the historical windows used by the game from the public monthly
S&P 500 dataset (Robert Shiller's data via github.com/datasets/s-and-p-500,
ODC-PDDL public domain). Writes src/data/history.json.

Usage:
  curl -o data.csv https://raw.githubusercontent.com/datasets/s-and-p-500/main/data/data.csv
  python3 scripts/build-history.py data.csv
"""
import csv, json, sys, os

ERAS = [
    # id, start month, months
    (101, '1928-06', 46),  # 1929 crash and the Great Depression
    (102, '1972-01', 46),  # 1973–74 stagflation bear market
    (103, '1985-06', 46),  # 1987 crash
    (104, '1999-01', 46),  # dot-com bubble and bust
    (105, '2006-10', 46),  # global financial crisis
    (106, '2019-01', 46),  # pandemic crash, recovery, 2022 bear market
]

rows = list(csv.DictReader(open(sys.argv[1])))
index = {r['Date'][:7]: i for i, r in enumerate(rows)}
out = []
for era_id, start, n in ERAS:
    i0 = index[start]
    months = []
    for r in rows[i0:i0 + n]:
        months.append({
            'm': r['Date'][:7],
            'p': round(float(r['SP500']), 2),          # monthly average index level
            'e': round(float(r['Earnings']), 3),       # trailing 12-month earnings
            'cpi': round(float(r['Consumer Price Index']), 3),
            # CPI 12 months earlier, for year-over-year inflation
            'cpi12': round(float(rows[index[r['Date'][:7]] - 12]['Consumer Price Index']), 3),
            'y': round(float(r['Long Interest Rate']), 2),  # 10-year Treasury yield
            'cape': round(float(r['PE10']), 2),
        })
    assert len(months) == n and all(m['p'] > 0 and m['e'] > 0 and m['cpi'] > 0 for m in months), era_id
    out.append({'id': era_id, 'start': start, 'months': months})

dst = os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'history.json')
json.dump(out, open(dst, 'w'), separators=(',', ':'))
print('wrote', dst, sum(len(e['months']) for e in out), 'months')
