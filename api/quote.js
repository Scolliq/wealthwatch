const https = require('https');

function yahooFetch(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Yahoo returned ${res.statusCode}`));
          return;
        }
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Invalid JSON from Yahoo')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');

  const { symbols, type, range } = req.query;

  if (!symbols) {
    return res.status(400).json({ error: 'Missing symbols parameter' });
  }

  try {
    if (type === 'chart') {
      // Single symbol chart data
      const sym = symbols.split(',')[0];
      const validRanges = ['1d','5d','1mo','3mo','6mo','1y','2y','5y','10y','ytd','max'];
      const r = validRanges.includes(range) ? range : '1mo';
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=${r}`;
      const data = await yahooFetch(url);
      return res.json(data);
    }

    // Default: quote data for multiple symbols
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`;
    const data = await yahooFetch(url);
    return res.json(data);

  } catch (err) {
    // Try v8 chart as fallback for quotes (extract price from chart meta)
    if (type !== 'chart') {
      try {
        const syms = symbols.split(',');
        const results = await Promise.allSettled(
          syms.map(s =>
            yahooFetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?interval=1d&range=5d`)
          )
        );

        const quotes = [];
        results.forEach((r, i) => {
          if (r.status === 'fulfilled' && r.value.chart?.result?.[0]) {
            const meta = r.value.chart.result[0].meta;
            const indicators = r.value.chart.result[0].indicators?.quote?.[0];
            quotes.push({
              symbol: syms[i],
              shortName: meta.shortName || meta.symbol || syms[i],
              longName: meta.longName,
              regularMarketPrice: meta.regularMarketPrice,
              regularMarketChangePercent: meta.previousClose
                ? ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100
                : 0,
              regularMarketDayHigh: meta.regularMarketDayHigh || (indicators?.high ? Math.max(...indicators.high.filter(Boolean)) : null),
              regularMarketDayLow: meta.regularMarketDayLow || (indicators?.low ? Math.min(...indicators.low.filter(Boolean)) : null),
              regularMarketPreviousClose: meta.previousClose,
              regularMarketOpen: meta.regularMarketOpen || (indicators?.open ? indicators.open.filter(Boolean).pop() : null),
              regularMarketVolume: meta.regularMarketVolume,
              marketCap: meta.marketCap || null,
            });
          }
        });

        if (quotes.length > 0) {
          return res.json({ quoteResponse: { result: quotes } });
        }
      } catch (e) {
        // Fall through to error
      }
    }

    return res.status(502).json({ error: 'Failed to fetch from Yahoo Finance', details: err.message });
  }
};
