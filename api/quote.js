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

// Extract previous close from v8/chart result — tries multiple sources
function extractPrevClose(chartResult) {
  const meta = chartResult.meta || {};
  const closes = (
    chartResult.indicators &&
    chartResult.indicators.quote &&
    chartResult.indicators.quote[0] &&
    chartResult.indicators.quote[0].close || []
  ).filter(v => v !== null && v !== undefined && v > 0);

  // meta.previousClose is the most direct (not always present)
  if (meta.previousClose) return meta.previousClose;

  // Second-to-last close in the series = yesterday's close
  // (last entry is today's intraday or final close = regularMarketPrice)
  if (closes.length >= 2) return closes[closes.length - 2];

  return null;
}

// Fetch v8/chart for a symbol and build a quote-compatible object
async function fetchChartQuote(sym) {
  const data = await yahooFetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=5d`
  );
  const result = data.chart && data.chart.result && data.chart.result[0];
  if (!result) throw new Error('No chart result for ' + sym);

  const meta = result.meta;
  const indicators = result.indicators && result.indicators.quote && result.indicators.quote[0];
  const prevClose = extractPrevClose(result);
  const price = meta.regularMarketPrice;

  return {
    symbol: sym,
    shortName: meta.shortName || meta.symbol || sym,
    longName: meta.longName,
    regularMarketPrice: price,
    regularMarketPreviousClose: prevClose,
    regularMarketChangePercent: (prevClose && price)
      ? ((price - prevClose) / prevClose) * 100
      : null,
    regularMarketDayHigh: meta.regularMarketDayHigh ||
      (indicators && indicators.high ? Math.max.apply(null, indicators.high.filter(Boolean)) : null),
    regularMarketDayLow: meta.regularMarketDayLow ||
      (indicators && indicators.low ? Math.min.apply(null, indicators.low.filter(Boolean)) : null),
    regularMarketOpen: meta.regularMarketOpen ||
      (indicators && indicators.open ? indicators.open.filter(Boolean).pop() : null),
    regularMarketVolume: meta.regularMarketVolume,
    marketCap: meta.marketCap || null,
  };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');

  const { symbols, type } = req.query;

  if (!symbols) {
    return res.status(400).json({ error: 'Missing symbols parameter' });
  }

  // ── Chart mode ──────────────────────────────────────────────────────────────
  if (type === 'chart' || type === 'chartlong') {
    try {
      const sym = symbols.split(',')[0];
      const range = (type === 'chartlong' && req.query.range) ? req.query.range : '1mo';
      const data = await yahooFetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=${encodeURIComponent(range)}`
      );
      return res.json(data);
    } catch (err) {
      return res.status(502).json({ error: 'Chart fetch failed', details: err.message });
    }
  }

  // ── Quote mode: try v7 first, then fall back to per-symbol v8/chart ─────────
  const syms = symbols.split(',');

  try {
    const data = await yahooFetch(
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`
    );

    const results = data.quoteResponse && data.quoteResponse.result;
    if (!Array.isArray(results) || results.length === 0) {
      throw new Error('Empty v7 response');
    }

    // For any symbol where change% is missing/zero, supplement from v8/chart
    const needsChart = results.filter(q =>
      q.regularMarketPrice && !q.regularMarketChangePercent
    );

    if (needsChart.length > 0) {
      const chartResults = await Promise.allSettled(
        needsChart.map(q => fetchChartQuote(q.symbol))
      );
      chartResults.forEach((r, i) => {
        if (r.status !== 'fulfilled') return;
        const q = needsChart[i];
        const cq = r.value;
        if (cq.regularMarketChangePercent !== null) {
          q.regularMarketChangePercent = cq.regularMarketChangePercent;
        }
        if (!q.regularMarketPreviousClose && cq.regularMarketPreviousClose) {
          q.regularMarketPreviousClose = cq.regularMarketPreviousClose;
        }
      });
    }

    return res.json(data);

  } catch (err) {
    // v7 failed entirely — use v8/chart for all symbols
    try {
      const chartResults = await Promise.allSettled(syms.map(fetchChartQuote));
      const quotes = chartResults
        .map((r, i) => r.status === 'fulfilled' ? r.value : null)
        .filter(Boolean);

      if (quotes.length > 0) {
        return res.json({ quoteResponse: { result: quotes } });
      }
    } catch (e) {
      // fall through
    }

    return res.status(502).json({ error: 'Failed to fetch from Yahoo Finance', details: err.message });
  }
};
