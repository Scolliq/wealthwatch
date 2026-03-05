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

  const { symbols, type, range, interval } = req.query;

  if (!symbols) {
    return res.status(400).json({ error: 'Missing symbols parameter' });
  }

  try {
    if (type === 'chart') {
      const sym = symbols.split(',')[0];
      const r = range || '1mo';
      const i = interval || '1d';
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=${i}&range=${r}`;
      const data = await yahooFetch(url);
      return res.json(data);
    }

    if (type === 'history') {
      // Fetch daily closes for multiple symbols (for correlation/beta calc)
      const syms = symbols.split(',').slice(0, 20);
      const r = range || '6mo';
      const results = await Promise.allSettled(
        syms.map(s =>
          yahooFetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?interval=1d&range=${r}`)
        )
      );

      const history = {};
      results.forEach((result, idx) => {
        if (result.status === 'fulfilled' && result.value.chart?.result?.[0]) {
          const r = result.value.chart.result[0];
          const timestamps = r.timestamp || [];
          const closes = r.indicators?.quote?.[0]?.close || [];
          history[syms[idx]] = {
            timestamps,
            closes,
            currency: r.meta?.currency || 'USD',
          };
        }
      });

      return res.json({ history });
    }

    if (type === 'summary') {
      // Fetch summary data including dividend info for multiple symbols
      const syms = symbols.split(',').slice(0, 20);
      const results = await Promise.allSettled(
        syms.map(s =>
          yahooFetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?interval=1d&range=5d`)
        )
      );

      const summaries = {};
      results.forEach((result, idx) => {
        if (result.status === 'fulfilled' && result.value.chart?.result?.[0]) {
          const meta = result.value.chart.result[0].meta;
          summaries[syms[idx]] = {
            price: meta.regularMarketPrice,
            previousClose: meta.previousClose,
            currency: meta.currency,
            exchangeName: meta.exchangeName,
            instrumentType: meta.instrumentType,
          };
        }
      });

      // Also try v7 for richer quote data (dividends, etc.)
      try {
        const v7url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(syms.join(','))}`;
        const v7data = await yahooFetch(v7url);
        const v7quotes = v7data.quoteResponse?.result || [];
        v7quotes.forEach(q => {
          if (summaries[q.symbol]) {
            summaries[q.symbol] = {
              ...summaries[q.symbol],
              trailingAnnualDividendRate: q.trailingAnnualDividendRate,
              trailingAnnualDividendYield: q.trailingAnnualDividendYield,
              dividendDate: q.dividendDate,
              exDividendDate: q.exDividendDate,
              trailingPE: q.trailingPE,
              forwardPE: q.forwardPE,
              beta: q.beta,
              fiftyTwoWeekHigh: q.fiftyTwoWeekHigh,
              fiftyTwoWeekLow: q.fiftyTwoWeekLow,
              marketCap: q.marketCap,
              shortName: q.shortName,
            };
          }
        });
      } catch (e) {
        // v7 enrichment is optional
      }

      return res.json({ summaries });
    }

    // Default: quote data for multiple symbols
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`;
    const data = await yahooFetch(url);
    return res.json(data);

  } catch (err) {
    // Try v8 chart as fallback for quotes (extract price from chart meta)
    if (type !== 'chart' && type !== 'history' && type !== 'summary') {
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
