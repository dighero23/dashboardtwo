// Static ticker list — replaces Supabase `tickers` table for Phase 1b.
// Phase 1c: this data comes from Supabase with live CRUD.

export interface TickerConfig {
  id: string;
  symbol: string;       // Display symbol: "BRK.B"
  yahooSymbol: string;  // Yahoo Finance symbol: "BRK-B"
  name: string;
  sortOrder: number;
  // Mock target prices — replaced by Supabase `alerts` table in Phase 1c
  targetPrice: number | null;
}

export const TICKER_LIST: TickerConfig[] = [
  { id: "1",  symbol: "AAPL",  yahooSymbol: "AAPL",  name: "Apple Inc.",            sortOrder: 1,  targetPrice: 175.0  },
  { id: "2",  symbol: "NVDA",  yahooSymbol: "NVDA",  name: "NVIDIA Corporation",    sortOrder: 2,  targetPrice: 800.0  },
  { id: "3",  symbol: "MSFT",  yahooSymbol: "MSFT",  name: "Microsoft Corporation", sortOrder: 3,  targetPrice: 400.0  },
  { id: "4",  symbol: "AMZN",  yahooSymbol: "AMZN",  name: "Amazon.com Inc.",       sortOrder: 4,  targetPrice: 185.0  },
  { id: "5",  symbol: "TSLA",  yahooSymbol: "TSLA",  name: "Tesla Inc.",            sortOrder: 5,  targetPrice: 150.0  },
  { id: "6",  symbol: "META",  yahooSymbol: "META",  name: "Meta Platforms Inc.",   sortOrder: 6,  targetPrice: 550.0  },
  { id: "7",  symbol: "GOOGL", yahooSymbol: "GOOGL", name: "Alphabet Inc.",         sortOrder: 7,  targetPrice: null   },
  { id: "8",  symbol: "BRK.B", yahooSymbol: "BRK-B", name: "Berkshire Hathaway",   sortOrder: 8,  targetPrice: 440.0  },
  { id: "9",  symbol: "JPM",   yahooSymbol: "JPM",   name: "JPMorgan Chase & Co.", sortOrder: 9,  targetPrice: null   },
  { id: "10", symbol: "VOO",   yahooSymbol: "VOO",   name: "Vanguard S&P 500 ETF", sortOrder: 10, targetPrice: 500.0  },
];

export function getYahooSymbol(symbol: string): string {
  return TICKER_LIST.find((t) => t.symbol === symbol)?.yahooSymbol ?? symbol;
}
