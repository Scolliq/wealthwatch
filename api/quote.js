const https = require('https');

function yahooFetch(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error('Yahoo HTTP ' + res.statusCode));
          return;
        }
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Bad JSON from Yahoo')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

// Extract previous close robustly from a v8/chart result
function extractPrevClose(chartResult) {
  const meta = chartResult.meta || {};
  const rawCloses = (
    chartResult.indicators &&
    chartResult.indicators.quote &&
    chartResult.indicators.quote[0] &&
    chartResult.indicators.quote[0].close
  ) || [];
  const closes = rawCloses.filter(v => v !== null && v !== undefined && v > 0);

  // meta.previousClose is the most direct source
  if (meta.previousClose) return meta.previousClose;

  // Second-to-last valid close = yesterday's close
  // (last close = today's intraday or final close = regularMarketPrice)
  if (closes.length >= 2) return closes[closes.length - 2];

  return null;
}

// Fetch a single symbol via v8/chart and return a normalised quote object
async function fetchOneQuote(sym, range) {
  range = range || '5d';
  const data = await yahooFetch(
    'https://query1.finance.yahoo.com/v8/finance/chart/' +
    encodeURIComponent(sym) + '?interval=1d&range=' + encodeURIComponent(range)
  );
  const result = data.chart && data.chart.result && data.chart.result[0];
  if (!result) throw new Error('No chart result for ' + sym);

  const meta = result.meta;
  const ind = result.indicators && result.indicators.quote && result.indicators.quote[0];
  const price = meta.regularMarketPrice;
  const prevClose = extractPrevClose(result);
  const changePct = (price && prevClose) ? ((price - prevClose) / prevClose) * 100 : null;

  return {
    symbol: sym,
    shortName: meta.shortName || meta.longName || meta.symbol || sym,
    longName: meta.longName,
    regularMarketPrice: price,
    regularMarketPreviousClose: prevClose,
    regularMarketChangePercent: changePct,
    regularMarketDayHigh: meta.regularMarketDayHigh ||
      (ind && ind.high ? Math.max.apply(null, ind.high.filter(Boolean)) : null),
    regularMarketDayLow: meta.regularMarketDayLow ||
      (ind && ind.low ? Math.min.apply(null, ind.low.filter(Boolean)) : null),
    regularMarketOpen: meta.regularMarketOpen ||
      (ind && ind.open ? ind.open.filter(Boolean).pop() : null),
    regularMarketVolume: meta.regularMarketVolume,
    marketCap: meta.marketCap || null,
    // debug fields (stripped in production responses)
    _prevCloseSource: meta.previousClose ? 'meta.previousClose' : 'closes[-2]',
    _closesCount: ((result.indicators && result.indicators.quote && result.indicators.quote[0] && result.indicators.quote[0].close) || []).filter(Boolean).length,
  };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');

  const { symbols, type, range, debug } = req.query;

  if (!symbols) {
    return res.status(400).json({ error: 'Missing symbols parameter' });
  }

  // ── Chart / long-chart mode ──────────────────────────────────────────────────
  if (type === 'chart' || type === 'chartlong') {
    try {
      const sym = symbols.split(',')[0];
      const r = (type === 'chartlong' && range) ? range : '1mo';
      const data = await yahooFetch(
        'https://query1.finance.yahoo.com/v8/finance/chart/' +
        encodeURIComponent(sym) + '?interval=1d&range=' + encodeURIComponent(r)
      );
      return res.json(data);
    } catch (err) {
      return res.status(502).json({ error: 'Chart fetch failed', details: err.message });
    }
  }

  // ── Quote mode: fetch each symbol via v8/chart in parallel ─────────────────
  const syms = symbols.split(',').map(s => s.trim()).filter(Boolean);

  try {
    const results = await Promise.allSettled(syms.map(s => fetchOneQuote(s, '5d')));

    const quotes = [];
    const errors = [];

    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        const q = r.value;
        // Remove debug fields unless debug mode requested
        if (!debug) {
          delete q._prevCloseSource;
          delete q._closesCount;
        }
        quotes.push(q);
      } else {
        errors.push({ symbol: syms[i], error: r.reason && r.reason.message });
      }
    });

    if (quotes.length === 0) {
      return res.status(502).json({ error: 'All symbol fetches failed', errors });
    }

    const response = { quoteResponse: { result: quotes } };
    if (debug) response._errors = errors;
    return res.json(response);

  } catch (err) {
    return res.status(502).json({ error: 'Quote fetch failed', details: err.message });
  }
};
