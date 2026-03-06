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
        resolve({ status: res.statusCode, body: data.slice(0, 2000) });
      });
    });
    req.on('error', e => resolve({ status: 0, error: e.message }));
    req.setTimeout(8000, () => { req.destroy(); resolve({ status: 0, error: 'Timeout' }); });
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const sym = (req.query.symbol || 'AAPL').toUpperCase();

  // Test both Yahoo endpoints
  const [v7, v8_5d, v8_1mo] = await Promise.all([
    yahooFetch('https://query1.finance.yahoo.com/v7/finance/quote?symbols=' + sym),
    yahooFetch('https://query1.finance.yahoo.com/v8/finance/chart/' + sym + '?interval=1d&range=5d'),
    yahooFetch('https://query1.finance.yahoo.com/v8/finance/chart/' + sym + '?interval=1d&range=1mo'),
  ]);

  // Parse v8 5d to extract key fields
  let v8Parsed = null;
  try {
    const d = JSON.parse(v8_5d.body);
    const r = d.chart && d.chart.result && d.chart.result[0];
    if (r) {
      const meta = r.meta;
      const closes = ((r.indicators && r.indicators.quote && r.indicators.quote[0] && r.indicators.quote[0].close) || []).filter(Boolean);
      v8Parsed = {
        price: meta.regularMarketPrice,
        previousClose: meta.previousClose,
        chartPreviousClose: meta.chartPreviousClose,
        closesCount: closes.length,
        lastFourCloses: closes.slice(-4),
        computedPrevClose: meta.previousClose || (closes.length >= 2 ? closes[closes.length - 2] : null),
        computedChangePct: (() => {
          const pc = meta.previousClose || (closes.length >= 2 ? closes[closes.length - 2] : null);
          return pc ? (((meta.regularMarketPrice - pc) / pc) * 100).toFixed(3) + '%' : null;
        })(),
      };
    }
  } catch (e) { v8Parsed = { parseError: e.message }; }

  return res.json({
    symbol: sym,
    v7: { status: v7.status, preview: v7.body.slice(0, 300) },
    v8_5d: { status: v8_5d.status, parsed: v8Parsed },
    v8_1mo: { status: v8_1mo.status, preview: v8_1mo.body.slice(0, 200) },
  });
};
