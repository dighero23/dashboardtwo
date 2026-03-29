export type TickerData = {
  id: string;
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  ath3y: number;
  athPct: number; // negative = below ATH
  targetPrice: number | null;
  targetPct: number | null; // (price - target) / target * 100
  earningsDate: string | null; // ISO date string
  earningsDays: number | null;
  hasAlert: boolean;
};

function calcAthPct(price: number, ath: number) {
  return ((price - ath) / ath) * 100;
}

function calcTargetPct(price: number, target: number) {
  return ((price - target) / target) * 100;
}

function daysUntil(isoDate: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(isoDate);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

const RAW = [
  { id: "1", symbol: "AAPL",  name: "Apple Inc.",             price: 189.5,  changePct: -1.24, ath3y: 232.15, target: 175.0,  earningsDate: "2026-04-30" },
  { id: "2", symbol: "NVDA",  name: "NVIDIA Corporation",     price: 824.6,  changePct:  2.87, ath3y: 974.0,  target: 800.0,  earningsDate: "2026-05-21" },
  { id: "3", symbol: "MSFT",  name: "Microsoft Corporation",  price: 415.2,  changePct:  0.43, ath3y: 468.35, target: 400.0,  earningsDate: "2026-04-29" },
  { id: "4", symbol: "AMZN",  name: "Amazon.com Inc.",        price: 198.9,  changePct: -0.71, ath3y: 242.52, target: 185.0,  earningsDate: "2026-05-01" },
  { id: "5", symbol: "TSLA",  name: "Tesla Inc.",             price: 172.3,  changePct: -3.15, ath3y: 409.97, target: 150.0,  earningsDate: "2026-04-22" },
  { id: "6", symbol: "META",  name: "Meta Platforms Inc.",    price: 578.4,  changePct:  1.62, ath3y: 638.4,  target: 550.0,  earningsDate: "2026-04-30" },
  { id: "7", symbol: "GOOGL", name: "Alphabet Inc.",          price: 163.5,  changePct:  0.18, ath3y: 207.05, target: null,   earningsDate: "2026-04-29" },
  { id: "8", symbol: "BRK.B", name: "Berkshire Hathaway",    price: 457.3,  changePct:  0.55, ath3y: 501.45, target: 440.0,  earningsDate: null },
  { id: "9", symbol: "JPM",   name: "JPMorgan Chase & Co.",  price: 241.8,  changePct:  1.03, ath3y: 268.75, target: null,   earningsDate: "2026-04-11" },
  { id: "10", symbol: "VOO",  name: "Vanguard S&P 500 ETF",  price: 519.4,  changePct: -0.38, ath3y: 579.2,  target: 500.0,  earningsDate: null },
];

export const MOCK_TICKERS: TickerData[] = RAW.map((r) => ({
  id: r.id,
  symbol: r.symbol,
  name: r.name,
  price: r.price,
  changePct: r.changePct,
  ath3y: r.ath3y,
  athPct: calcAthPct(r.price, r.ath3y),
  targetPrice: r.target,
  targetPct: r.target !== null ? calcTargetPct(r.price, r.target) : null,
  earningsDate: r.earningsDate,
  earningsDays: r.earningsDate ? daysUntil(r.earningsDate) : null,
  hasAlert: r.target !== null,
}));

export const LAST_UPDATED = new Date();
