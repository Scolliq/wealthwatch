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
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=240');

  const { symbol } = req.query;
  if (!symbol) {
    return res.status(400).json({ error: 'Missing symbol parameter' });
  }

  try {
    const url = `https://query2.finance.yahoo.com/v7/finance/options/${encodeURIComponent(symbol)}`;
    const data = await yahooFetch(url);
    const result = data.optionChain?.result?.[0];

    if (!result) {
      return res.status(404).json({ error: 'No options data found for ' + symbol });
    }

    const options = result.options?.[0] || {};
    const calls = options.calls || [];
    const puts = options.puts || [];
    const currentPrice = result.quote?.regularMarketPrice || 0;
    const expirationDate = options.expirationDate
      ? new Date(options.expirationDate * 1000).toISOString().split('T')[0]
      : null;

    // Total OI across all strikes
    const totalCallOI = calls.reduce((s, c) => s + (c.openInterest || 0), 0);
    const totalPutOI = puts.reduce((s, c) => s + (c.openInterest || 0), 0);
    const putCallRatio = totalCallOI > 0 ? totalPutOI / totalCallOI : null;

    // Near-the-money distribution: strikes within ±25% of current price
    const lo = currentPrice * 0.75;
    const hi = currentPrice * 1.25;

    const callDist = calls
      .filter(c => c.strike >= lo && c.strike <= hi)
      .map(c => ({ strike: c.strike, oi: c.openInterest || 0, volume: c.volume || 0 }));

    const putDist = puts
      .filter(p => p.strike >= lo && p.strike <= hi)
      .map(p => ({ strike: p.strike, oi: p.openInterest || 0, volume: p.volume || 0 }));

    return res.json({
      symbol,
      currentPrice,
      totalCallOI,
      totalPutOI,
      putCallRatio,
      expirationDate,
      callDist,
      putDist,
    });

  } catch (err) {
    return res.status(502).json({ error: 'Failed to fetch options data', details: err.message });
  }
};
