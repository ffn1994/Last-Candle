/**
 * Historical markets: the real month-by-month path of the S&P 500 (Robert
 * Shiller's public-domain data, see scripts/build-history.py), played as 200
 * weekly candles. Each candle-month ends on the real monthly level; the weeks
 * inside a month are simulated by the realistic generator, with volatility
 * taken from how turbulent those months really were.
 */
import raw from './history.json';
import type { NewsEvent, Scenario, Segment } from './scenarios';

export interface HistMonth {
  m: string; // YYYY-MM
  p: number; // index level (monthly average)
  e: number; // trailing 12-month earnings per share
  cpi: number;
  cpi12: number; // CPI 12 months earlier
  y: number; // 10-year Treasury yield, %
  cape: number; // Shiller cyclically adjusted P/E
}

interface HistEra { id: number; start: string; months: HistMonth[] }

const ERAS = raw as HistEra[];
const CANDLES = 200;

/** Name (revealed at the end) and real events, worded so they don't give the year away. */
const META: Record<number, { name: string; news: [month: string, text: string][] }> = {
  101: {
    name: 'الكساد الكبير 1928–1932',
    news: [
      ['1929-10', 'انهيار حاد في البورصة وموجة بيع مذعورة'],
      ['1930-06', 'قانون رسوم جمركية جديد يشعل حرب تجارية'],
      ['1931-09', 'دولة كبرى تتخلى عن ربط عملتها بالذهب'],
    ],
  },
  102: {
    name: 'الركود التضخمي 1972–1975',
    news: [
      ['1973-10', 'حظر نفطي يرفع أسعار النفط أضعاف'],
      ['1974-08', 'استقالة رئيس الدولة وسط فضيحة سياسية'],
    ],
  },
  103: {
    name: 'انهيار 1987',
    news: [
      ['1985-09', 'اتفاق دولي لخفض قيمة الدولار'],
      ['1987-10', 'هبوط تاريخي: السوق يخسر أكثر من 20% في يوم واحد'],
    ],
  },
  104: {
    name: 'فقاعة الدوت كوم 1999–2002',
    news: [
      ['2000-03', 'مؤشر شركات التقنية يسجل قمة تاريخية'],
      ['2001-01', 'البنك المركزي يبدأ خفض الفائدة بشكل مفاجئ'],
      ['2001-09', 'هجمات إرهابية تغلق الأسواق عدة أيام'],
      ['2001-12', 'إفلاس شركة طاقة عملاقة بعد فضيحة محاسبية'],
    ],
  },
  105: {
    name: 'الأزمة المالية العالمية 2006–2010',
    news: [
      ['2007-08', 'أزمة في سوق الرهن العقاري عالي المخاطر'],
      ['2008-03', 'إنقاذ بنك استثماري كبير من الانهيار'],
      ['2008-09', 'بنك استثماري كبير يعلن إفلاسه'],
      ['2008-10', 'إقرار خطة إنقاذ حكومية ضخمة للبنوك'],
      ['2009-03', 'البنك المركزي يعلن شراء سندات بمئات المليارات'],
    ],
  },
  106: {
    name: 'الجائحة والتضخم 2019–2022',
    news: [
      ['2020-03', 'فيروس جديد يتحول لجائحة والفائدة تنخفض للصفر'],
      ['2020-11', 'إعلان نجاح لقاح بنسبة فعالية عالية'],
      ['2022-03', 'البنك المركزي يبدأ رفع الفائدة لمواجهة التضخم'],
    ],
  },
};

/** First candle of month k, and the candle on which it closes. */
export const monthStart = (k: number, n: number) => Math.round((k * CANDLES) / n);
export const monthEnd = (k: number, n: number) => Math.round(((k + 1) * CANDLES) / n) - 1;

function toScenario(era: HistEra): Scenario {
  const { months } = era;
  const n = months.length;
  const absRet = months.map((m, k) => (k === 0 ? 0 : Math.abs(Math.log(m.p / months[k - 1].p))));
  const segments: Segment[] = months.map((m, k) => {
    const len = monthEnd(k, n) - monthStart(k, n) + 1;
    const near = [absRet[k - 1] ?? 0, absRet[k], absRet[k + 1] ?? 0];
    const local = near.reduce((a, b) => a + b, 0) / near.length;
    // weekly volatility: a calm floor plus how violent the surrounding months really were
    const vol = Math.max(0.01, Math.min(0.06, 0.008 + (0.55 * local) / Math.sqrt(len)));
    return { len, mult: k === 0 ? 1 : m.p / months[k - 1].p, vol };
  });
  const news: NewsEvent[] = META[era.id].news.map(([month, text]) => {
    const k = months.findIndex((m) => m.m === month);
    return { at: monthStart(k, n), text };
  });
  return { id: era.id, name: META[era.id].name, start: months[0].p, segments, news };
}

export const HISTORICAL: Scenario[] = ERAS.map(toScenario);
export const isHistoricalId = (id: number) => ERAS.some((e) => e.id === id);
export const historicalMonths = (id: number) => ERAS.find((e) => e.id === id)?.months ?? null;
