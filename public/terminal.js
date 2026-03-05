// ═══════════════════════════════════════════════════════════
// WealthWatch Terminal — TUI-style CLI with live market data
// ═══════════════════════════════════════════════════════════

(function () {
  'use strict';

  const output = document.getElementById('output');
  const input  = document.getElementById('cmd-input');
  const commandHistory = [];
  let historyIndex = -1;

  // ─── Data fetching ──────────────────────────────────────

  const API_BASE = '/api/quote';

  const cache = {};
  const CACHE_TTL = 30000; // 30 seconds

  function getCached(key) {
    const entry = cache[key];
    if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
    return null;
  }

  function setCache(key, data) {
    cache[key] = { data, ts: Date.now() };
  }

  async function fetchQuotes(symbols) {
    const key = 'quotes:' + symbols.join(',');
    const cached = getCached(key);
    if (cached) return cached;

    const res = await fetch(`${API_BASE}?symbols=${symbols.join(',')}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const results = json.quoteResponse?.result || [];

    const data = {};
    results.forEach(q => {
      data[q.symbol] = {
        name: q.shortName || q.longName || q.symbol,
        price: q.regularMarketPrice,
        change: q.regularMarketChangePercent,
        high: q.regularMarketDayHigh,
        low: q.regularMarketDayLow,
        prevClose: q.regularMarketPreviousClose,
        vol: fmtVol(q.regularMarketVolume),
        cap: fmtCap(q.marketCap),
        open: q.regularMarketOpen,
      };
    });

    setCache(key, data);
    return data;
  }

  async function fetchChartData(symbol) {
    const key = 'chart:' + symbol;
    const cached = getCached(key);
    if (cached) return cached;

    const res = await fetch(`${API_BASE}?symbols=${symbol}&type=chart`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const result = json.chart?.result?.[0];
    if (!result) throw new Error('No chart data');

    const closes = result.indicators.quote[0].close.filter(v => v != null);
    const meta = result.meta;

    const data = { closes, name: meta.shortName || symbol, price: meta.regularMarketPrice };
    setCache(key, data);
    return data;
  }

  function fmtVol(v) {
    if (!v) return '—';
    if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B';
    if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
    if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
    return String(v);
  }

  function fmtCap(v) {
    if (!v) return '—';
    if (v >= 1e12) return (v / 1e12).toFixed(2) + 'T';
    if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B';
    if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
    return String(v);
  }

  // ─── Mock data (fallback) ──────────────────────────────

  const mockData = {
    AAPL:      { name: 'Apple Inc.',          price: 189.84, change: 1.24,  high: 191.02, low: 187.33, vol: '52.3M',  cap: '2.94T' },
    NVDA:      { name: 'NVIDIA Corporation',  price: 721.33, change: 3.87,  high: 728.50, low: 712.10, vol: '41.8M',  cap: '1.78T' },
    MSFT:      { name: 'Microsoft Corp.',     price: 415.20, change: 1.15,  high: 418.90, low: 411.05, vol: '22.1M',  cap: '3.08T' },
    TSLA:      { name: 'Tesla Inc.',          price: 231.45, change: -2.14, high: 238.20, low: 229.80, vol: '78.4M',  cap: '735B' },
    GOOGL:     { name: 'Alphabet Inc.',       price: 152.87, change: 0.82,  high: 154.10, low: 151.22, vol: '28.7M',  cap: '1.91T' },
    AMZN:      { name: 'Amazon.com Inc.',     price: 178.12, change: -0.31, high: 180.44, low: 176.88, vol: '34.2M',  cap: '1.86T' },
    META:      { name: 'Meta Platforms',      price: 501.33, change: 2.08,  high: 507.12, low: 498.60, vol: '18.5M',  cap: '1.28T' },
    AMD:       { name: 'AMD Inc.',            price: 168.90, change: -1.42, high: 172.33, low: 167.15, vol: '45.1M',  cap: '273B' },
    SPY:       { name: 'SPDR S&P 500 ETF',   price: 584.23, change: 1.24,  high: 586.10, low: 581.05, vol: '68.2M',  cap: '538B' },
    'BTC-USD': { name: 'Bitcoin',             price: 67843,  change: 2.31,  high: 68900,  low: 66200,  vol: '28.4B',  cap: '1.33T' },
    'ETH-USD': { name: 'Ethereum',            price: 3521,   change: 1.87,  high: 3580,   low: 3455,   vol: '14.1B',  cap: '423B' },
  };

  const indexSymbols = {
    '^GSPC':  'S&P 500',
    '^DJI':   'DOW 30',
    '^IXIC':  'NASDAQ',
    '^RUT':   'RUSSELL 2K',
    '^VIX':   'VIX',
  };

  const cryptoSymbols = ['BTC-USD', 'ETH-USD', 'SOL-USD'];
  const stockSymbols  = ['AAPL', 'NVDA', 'MSFT', 'TSLA', 'GOOGL', 'AMZN', 'META', 'AMD'];
  const watchlistSymbols = ['MSFT', 'GOOGL', 'AMZN', 'META', 'AMD'];

  // ─── Rendering ────────────────────────────────────────

  function print(html) {
    const div = document.createElement('div');
    div.className = 'line';
    div.innerHTML = html;
    output.appendChild(div);
  }

  function printBlank() {
    const div = document.createElement('div');
    div.className = 'line-blank';
    output.appendChild(div);
  }

  function printRaw(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    output.appendChild(div);
  }

  function scrollToBottom() {
    const tb = document.getElementById('terminal');
    tb.scrollTop = tb.scrollHeight;
    input.focus();
  }

  function printLines(lines) {
    lines.forEach(l => { if (l === '') printBlank(); else print(l); });
    printBlank();
    bindSlashCommands();
    scrollToBottom();
  }

  // Loading indicator
  let loadingEl = null;
  function showLoading(msg) {
    loadingEl = document.createElement('div');
    loadingEl.className = 'line';
    loadingEl.innerHTML = `<span class="c-dim loading-dots">${msg}</span>`;
    output.appendChild(loadingEl);
    scrollToBottom();
  }

  function hideLoading() {
    if (loadingEl) { loadingEl.remove(); loadingEl = null; }
  }

  function bindSlashCommands() {
    output.querySelectorAll('.slash-cmd:not([data-bound])').forEach(el => {
      el.dataset.bound = '1';
      el.addEventListener('click', () => {
        const cmd = el.textContent.trim();
        input.value = cmd;
        runCommand(cmd);
      });
    });
  }

  function sc(cmd) { return `<span class="slash-cmd">${cmd}</span>`; }
  function dim(t)  { return `<span class="c-dim">${t}</span>`; }
  function bright(t) { return `<span class="c-bright c-bold">${t}</span>`; }

  // ─── TUI Panel builder ──────────────────────────────────

  function panel(title, content, badge) {
    const b = badge ? `<span class="tui-badge">${badge}</span>` : '';
    return `<div class="tui-panel"><div class="tui-panel-title">${title}${b}</div><div class="tui-panel-body">${content}</div></div>`;
  }

  function table(headers, rows, footerRow) {
    let h = '<tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr>';
    let r = rows.map(row =>
      '<tr>' + row.map(cell => `<td>${cell}</td>`).join('') + '</tr>'
    ).join('');
    let f = '';
    if (footerRow) {
      f = '<tr class="tui-row-total">' + footerRow.map(cell => `<td>${cell}</td>`).join('') + '</tr>';
    }
    return `<table class="tui-table"><thead>${h}</thead><tbody>${r}${f}</tbody></table>`;
  }

  function tag(type, text) { return `<span class="tag tag-${type}">${text}</span>`; }
  function pos(t)  { return `<span class="positive">${t}</span>`; }
  function neg(t)  { return `<span class="negative">${t}</span>`; }
  function tn(t)   { return `<span class="ticker-name">${t}</span>`; }

  // ─── Formatting ─────────────────────────────────────────

  function fmtPrice(p) {
    if (p == null) return '—';
    return p >= 1000 ? '$' + p.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '$' + p.toFixed(2);
  }

  function fmtChange(c) {
    if (c == null) return dim('—');
    const s = c >= 0 ? '+' : '';
    const cls = c >= 0 ? 'positive' : 'negative';
    const arrow = c >= 0 ? '▲' : '▼';
    return `<span class="${cls}">${s}${c.toFixed(2)}% ${arrow}</span>`;
  }

  function sparkline(closes) {
    if (!closes || closes.length < 2) return dim('—');
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = max - min || 1;
    const bars = '▁▂▃▄▅▆▇█';
    const spark = closes.slice(-14).map(v => {
      const idx = Math.round(((v - min) / range) * (bars.length - 1));
      return bars[idx];
    }).join('');
    // color based on trend
    const trend = closes[closes.length - 1] >= closes[0] ? 'positive' : 'negative';
    return `<span class="${trend}">${spark}</span>`;
  }

  // ─── Boot ─────────────────────────────────────────────

  function boot() {
    print('');
    print(`<span class="c-blue c-bold">  ██╗    ██╗ ███████╗  █████╗  ██╗  ████████╗██╗  ██╗</span>`);
    print(`<span class="c-blue c-bold">  ██║    ██║ ██╔════╝ ██╔══██╗ ██║  ╚══██╔══╝██║  ██║</span>`);
    print(`<span class="c-blue c-bold">  ██║ █╗ ██║ █████╗   ███████║ ██║     ██║   ███████║</span>`);
    print(`<span class="c-blue c-bold">  ██║███╗██║ ██╔══╝   ██╔══██║ ██║     ██║   ██╔══██║</span>`);
    print(`<span class="c-blue c-bold">  ╚███╔███╔╝ ███████╗ ██║  ██║ ███████╗██║   ██║  ██║</span>`);
    print(`<span class="c-blue c-bold">   ╚══╝╚══╝  ╚══════╝ ╚═╝  ╚═╝ ╚══════╝╚═╝   ╚═╝  ╚═╝</span>`);
    print(`<span class="c-dim">  ──────────────────────────────────────────────────────</span>`);
    print(`<span class="c-dim">  Terminal Finance Dashboard · v1.0 · Live data via Yahoo Finance</span>`);
    printBlank();
    print(`<span class="c-bright">  Commands:</span>`);
    printBlank();
    print(`    ${sc('/market')}        ${dim('Market overview & indices')}`);
    print(`    ${sc('/portfolio')}     ${dim('Portfolio positions & P/L')}`);
    print(`    ${sc('/quote')} ${dim('<SYM>')}   ${dim('Real-time stock quote')}`);
    print(`    ${sc('/chart')} ${dim('<SYM>')}   ${dim('ASCII price chart (30d)')}`);
    print(`    ${sc('/watchlist')}     ${dim('Tracked tickers')}`);
    print(`    ${sc('/alerts')}        ${dim('Price alert status')}`);
    print(`    ${sc('/news')}          ${dim('Financial headlines')}`);
    print(`    ${sc('/about')}         ${dim('About WealthWatch')}`);
    print(`    ${sc('/stack')}         ${dim('Tech stack')}`);
    print(`    ${sc('/help')}          ${dim('All commands')}`);
    print(`    ${sc('/clear')}         ${dim('Clear terminal')}`);
    printBlank();
    print(`  ${dim('Click any command or type below. ↑↓ for history.')}`);
    printBlank();
    bindSlashCommands();
    scrollToBottom();
  }

  // ─── Commands ─────────────────────────────────────────

  const commands = {

    '/help': function() {
      printLines([
        bright('Commands'),
        '',
        `  ${sc('/market')}                  ${dim('Live market indices & crypto')}`,
        `  ${sc('/portfolio')}               ${dim('Portfolio positions & P/L')}`,
        `  ${sc('/quote')} ${dim('<ticker>')}          ${dim('Real-time stock quote')}`,
        `  ${sc('/chart')} ${dim('<ticker>')}          ${dim('ASCII price chart (30d)')}`,
        `  ${sc('/watchlist')}               ${dim('Tracked tickers with sparklines')}`,
        `  ${sc('/alerts')}                  ${dim('Active price alerts')}`,
        `  ${sc('/news')}                    ${dim('Latest financial headlines')}`,
        '',
        `  ${sc('/about')}                   ${dim('About WealthWatch')}`,
        `  ${sc('/stack')}                   ${dim('Tech stack & architecture')}`,
        `  ${sc('/help')}                    ${dim('This help menu')}`,
        `  ${sc('/clear')}                   ${dim('Clear terminal')}`,
        '',
        dim('Tip: Click any command or type it. Arrow ↑↓ for history.'),
      ]);
    },

    '/market': async function() {
      showLoading('Fetching market data...');
      let usedLive = false;

      try {
        const allSymbols = [...Object.keys(indexSymbols), ...cryptoSymbols];
        const data = await fetchQuotes(allSymbols);
        hideLoading();
        usedLive = true;

        const idxRows = Object.entries(indexSymbols).map(([sym, label]) => {
          const q = data[sym];
          if (!q) return [tn(label), dim('—'), dim('—')];
          return [tn(label), `<span class="price">${fmtPrice(q.price)}</span>`, fmtChange(q.change)];
        });

        const cryptoRows = cryptoSymbols.map(sym => {
          const q = data[sym];
          const label = sym.replace('-USD', '/USD');
          if (!q) return [tn(label), dim('—'), dim('—')];
          return [tn(label), `<span class="price">${fmtPrice(q.price)}</span>`, fmtChange(q.change)];
        });

        printRaw(panel('Indices', table(['Index', 'Price', 'Change'], idxRows), 'LIVE'));
        printRaw(panel('Crypto', table(['Asset', 'Price', 'Change'], cryptoRows), 'LIVE'));

      } catch (e) {
        hideLoading();
        // Fallback to mock
        const indices = [
          ['S&P 500',    '$5,842.31',  1.24],
          ['DOW 30',     '$43,890.12', 0.87],
          ['NASDAQ',     '$18,563.77', 1.67],
          ['RUSSELL 2K', '$2,198.45',  -0.32],
          ['VIX',        '$14.82',     -2.10],
        ];
        const crypto = [
          ['BTC/USD',  '$67,843', 2.31],
          ['ETH/USD',  '$3,521',  1.87],
          ['SOL/USD',  '$142.55', 4.12],
        ];
        const mkRows = (data) => data.map(([name, price, chg]) => [
          tn(name), `<span class="price">${price}</span>`, fmtChange(chg)
        ]);
        printRaw(panel('Indices', table(['Index', 'Price', 'Change'], mkRows(indices)), 'DEMO'));
        printRaw(panel('Crypto', table(['Asset', 'Price', 'Change'], mkRows(crypto)), 'DEMO'));
      }

      printBlank();
      const src = usedLive ? 'Yahoo Finance' : 'demo data (API unavailable)';
      print(dim(`Source: ${src}  ·  ${sc('/quote')} <ticker> for details`));
      printBlank();
      bindSlashCommands();
      scrollToBottom();
    },

    '/portfolio': async function() {
      showLoading('Fetching portfolio prices...');

      const holdings = [
        { sym: 'AAPL',    qty: 50,  avgCost: 171.20 },
        { sym: 'NVDA',    qty: 25,  avgCost: 480.50 },
        { sym: 'TSLA',    qty: 10,  avgCost: 248.90 },
        { sym: 'BTC-USD', qty: 0.5, avgCost: 42100  },
      ];

      let rows, totalValue = 0, totalPL = 0;
      let usedLive = false;

      try {
        const data = await fetchQuotes(holdings.map(h => h.sym));
        hideLoading();
        usedLive = true;

        rows = holdings.map(h => {
          const q = data[h.sym];
          const last = q ? q.price : mockData[h.sym]?.price || 0;
          const pl = (last - h.avgCost) * h.qty;
          const plPct = ((last / h.avgCost) - 1) * 100;
          totalValue += last * h.qty;
          totalPL += pl;
          const plStr = pl >= 0 ? pos(`+$${Math.abs(pl).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`) : neg(`-$${Math.abs(pl).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
          const pctStr = plPct >= 0 ? pos(`+${plPct.toFixed(1)}%`) : neg(`${plPct.toFixed(1)}%`);
          return [tn(h.sym), String(h.qty), fmtPrice(h.avgCost), fmtPrice(last), plStr, pctStr];
        });
      } catch (e) {
        hideLoading();
        rows = holdings.map(h => {
          const m = mockData[h.sym];
          const last = m ? m.price : 0;
          const pl = (last - h.avgCost) * h.qty;
          const plPct = ((last / h.avgCost) - 1) * 100;
          totalValue += last * h.qty;
          totalPL += pl;
          const plStr = pl >= 0 ? pos(`+$${Math.abs(pl).toFixed(2)}`) : neg(`-$${Math.abs(pl).toFixed(2)}`);
          const pctStr = plPct >= 0 ? pos(`+${plPct.toFixed(1)}%`) : neg(`${plPct.toFixed(1)}%`);
          return [tn(h.sym), String(h.qty), fmtPrice(h.avgCost), fmtPrice(last), plStr, pctStr];
        });
      }

      const totalPLStr = totalPL >= 0
        ? pos(`<strong>+$${Math.abs(totalPL).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong>`)
        : neg(`<strong>-$${Math.abs(totalPL).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong>`);
      const footer = ['', '', '', `<strong>${fmtPrice(totalValue)}</strong>`, totalPLStr, ''];

      const badge = usedLive ? 'LIVE' : 'DEMO';
      printRaw(panel('Portfolio', table(['Ticker', 'Qty', 'Avg Cost', 'Last', 'P/L', '%'], rows, footer), badge));
      printBlank();
      print(dim(`${usedLive ? 'Live prices' : 'Demo data'}  ·  ${sc('/chart')} <ticker> for price history`));
      printBlank();
      bindSlashCommands();
      scrollToBottom();
    },

    '/watchlist': async function() {
      showLoading('Fetching watchlist...');
      let usedLive = false;

      try {
        const [quotes, ...charts] = await Promise.all([
          fetchQuotes(watchlistSymbols),
          ...watchlistSymbols.map(s => fetchChartData(s).catch(() => null)),
        ]);
        hideLoading();
        usedLive = true;

        const rows = watchlistSymbols.map((sym, i) => {
          const q = quotes[sym];
          const chart = charts[i];
          const spark = chart ? sparkline(chart.closes) : dim('—');
          if (!q) return [tn(sym), dim('—'), dim('—'), spark];
          return [tn(sym), fmtPrice(q.price), fmtChange(q.change), spark];
        });

        printRaw(panel('Watchlist', table(['Ticker', 'Price', 'Change', '30d'], rows), 'LIVE'));
      } catch (e) {
        hideLoading();
        const rows = [
          [tn('MSFT'),  '$415.20', fmtChange(1.20),  dim('▁▂▃▄▅▆▇█▇▆▅▆▇█')],
          [tn('GOOGL'), '$152.87', fmtChange(0.82),   dim('▃▄▅▄▃▄▅▆▇▆▅▆▇▆')],
          [tn('AMZN'),  '$178.12', fmtChange(-0.31),  dim('▆▇▆▅▄▃▂▃▄▅▄▃▂▃')],
          [tn('META'),  '$501.33', fmtChange(2.08),   dim('▂▃▄▅▆▇█▇▆▇████')],
          [tn('AMD'),   '$168.90', fmtChange(-1.42),  dim('█▇▆▅▄▃▂▃▄▃▂▁▂▃')],
        ];
        printRaw(panel('Watchlist', table(['Ticker', 'Price', 'Change', '30d'], rows), 'DEMO'));
      }

      printBlank();
      print(dim(`${watchlistSymbols.length} tickers tracked  ·  ${sc('/quote')} <ticker> for details`));
      printBlank();
      bindSlashCommands();
      scrollToBottom();
    },

    '/alerts': function() {
      const rows = [
        [tag('neutral', '!'), tn('NVDA'),    'Above $750.00',  tag('neutral', 'WATCHING')],
        [tag('neutral', '!'), tn('BTC-USD'), 'Above $70,000',  tag('neutral', 'WATCHING')],
        [tag('bull', '✓'),    tn('AAPL'),    'Above $185.00',  tag('bull', 'TRIGGERED')],
      ];

      printRaw(panel('Price Alerts', table(['', 'Ticker', 'Condition', 'Status'], rows)));
      printBlank();
      print(dim('3 active alerts  ·  Polling every 60s'));
      printBlank();
      scrollToBottom();
    },

    '/news': function() {
      const items = [
        [tag('bull', 'BULL'),    'Fed signals rate cuts ahead as inflation cools'],
        [tag('bull', 'BULL'),    'NVIDIA beats earnings expectations, AI demand surges'],
        [tag('bear', 'BEAR'),    'Treasury yields spike on labor market data'],
        [tag('neutral', '——'),   'Apple unveils new AI features at developer event'],
        [tag('bull', 'BULL'),    'S&P 500 hits new all-time high'],
        [tag('bear', 'BEAR'),    'Oil prices jump on Middle East tensions'],
      ];

      printRaw(panel('Financial News', table(['Signal', 'Headline'], items)));
      printBlank();
      print(dim('Source: aggregated financial feeds'));
      printBlank();
      scrollToBottom();
    },

    '/about': function() {
      printLines([
        bright('About WealthWatch'),
        '',
        '  WealthWatch is a terminal-style finance dashboard for',
        '  tracking markets, portfolios, and financial data.',
        '',
        `  <span class="c-dim">No bloat. No clutter. Just data.</span>`,
        '',
        `  <span class="c-cyan">Markets</span>      Real-time quotes via Yahoo Finance`,
        `  <span class="c-cyan">Portfolio</span>    Track positions with live P/L`,
        `  <span class="c-cyan">Watchlist</span>    Monitor favorites with sparklines`,
        `  <span class="c-cyan">Alerts</span>       Price triggers with polling`,
        `  <span class="c-cyan">News</span>         Aggregated headlines with sentiment`,
        `  <span class="c-cyan">Charts</span>       ASCII charts from real price data`,
        '',
        `  ${dim('GitHub:')}   github.com/Scolliq/wealthwatch`,
        `  ${dim('License:')}  MIT`,
        `  ${dim('Status:')}   <span class="c-green">● Operational</span>`,
      ]);
    },

    '/stack': function() {
      printLines([
        bright('Architecture'),
        '',
        `  <span class="c-dim">┌──────────┐    ┌──────────┐    ┌──────────┐</span>`,
        `  <span class="c-dim">│</span> <span class="c-cyan">BROWSER</span>  <span class="c-dim">│───▶│</span> <span class="c-cyan">CORS</span>     <span class="c-dim">│───▶│</span> <span class="c-cyan">YAHOO</span>    <span class="c-dim">│</span>`,
        `  <span class="c-dim">│</span> Terminal  <span class="c-dim">│    │</span> Proxy    <span class="c-dim">│    │</span> Finance  <span class="c-dim">│</span>`,
        `  <span class="c-dim">│</span> UI / JS   <span class="c-dim">│◀───│</span>          <span class="c-dim">│◀───│</span> API v7/8 <span class="c-dim">│</span>`,
        `  <span class="c-dim">└──────────┘    └──────────┘    └──────────┘</span>`,
        '',
        bright('Tech Stack'),
        '',
        `  <span class="c-cyan">Frontend</span>`,
        `  <span class="c-dim">├──</span> HTML/CSS/JS       Vanilla, no framework`,
        `  <span class="c-dim">├──</span> Terminal UI        TUI aesthetic`,
        `  <span class="c-dim">├──</span> Yahoo Finance      Client-side API via CORS proxy`,
        `  <span class="c-dim">├──</span> 30s cache          Avoid rate limiting`,
        `  <span class="c-dim">└──</span> Vercel             Static hosting`,
        '',
        `  <span class="c-cyan">Backend (Telegram Bot)</span>`,
        `  <span class="c-dim">├──</span> Python 3.11+       Core runtime`,
        `  <span class="c-dim">├──</span> yfinance           Market data feeds`,
        `  <span class="c-dim">├──</span> APScheduler        Background alert polling`,
        `  <span class="c-dim">└──</span> JSON storage       Lightweight persistence`,
        '',
        `  <span class="c-cyan">Data Flow</span>`,
        `  <span class="c-dim">├──</span> Browser fetches Yahoo Finance v7 (quotes)`,
        `  <span class="c-dim">├──</span> Browser fetches Yahoo Finance v8 (charts)`,
        `  <span class="c-dim">├──</span> CORS proxy handles cross-origin requests`,
        `  <span class="c-dim">└──</span> Fallback to demo data on failure`,
      ]);
    },

    '/clear': function() {
      output.innerHTML = '';
    },
  };

  // ─── Dynamic commands ─────────────────────────────────

  async function quoteCmd(ticker) {
    if (!ticker) {
      printLines([
        `<span class="c-red">Usage:</span> /quote <ticker>`,
        `${dim('Example:')} ${sc('/quote AAPL')}`,
        '',
        dim('Try any ticker symbol (e.g. AAPL, NVDA, TSLA, BTC-USD, ETH-USD, SPY, MSFT)'),
      ]);
      return;
    }

    const sym = ticker.toUpperCase();
    showLoading(`Fetching ${sym}...`);

    try {
      const data = await fetchQuotes([sym]);
      hideLoading();
      const q = data[sym];

      if (!q) {
        printLines([
          `<span class="c-red">No data found for:</span> ${sym}`,
          dim('Check the ticker symbol and try again.'),
        ]);
        return;
      }

      const rows = [
        ['Price',      `<strong>${fmtPrice(q.price)}</strong>`, fmtChange(q.change)],
        ['Day High',   fmtPrice(q.high), ''],
        ['Day Low',    fmtPrice(q.low), ''],
        ['Open',       fmtPrice(q.open), ''],
        ['Prev Close', fmtPrice(q.prevClose), ''],
        ['Volume',     q.vol, ''],
        ['Market Cap', q.cap ? '$' + q.cap : '—', ''],
      ];

      printRaw(panel(`${sym} · ${q.name}`, table(['Metric', 'Value', ''], rows), 'LIVE'));
      printBlank();
      print(dim(`Live data  ·  ${sc('/chart ' + sym)} for price history`));

    } catch (e) {
      hideLoading();
      // Try mock data
      const m = mockData[sym];
      if (m) {
        const rows = [
          ['Price',      `<strong>${fmtPrice(m.price)}</strong>`, fmtChange(m.change)],
          ['Day High',   fmtPrice(m.high), ''],
          ['Day Low',    fmtPrice(m.low), ''],
          ['Volume',     m.vol, ''],
          ['Market Cap', '$' + m.cap, ''],
        ];
        printRaw(panel(`${sym} · ${m.name}`, table(['Metric', 'Value', ''], rows), 'DEMO'));
        printBlank();
        print(dim(`Demo data (API unavailable)  ·  ${sc('/chart ' + sym)} for chart`));
      } else {
        printLines([
          `<span class="c-red">Failed to fetch:</span> ${sym}`,
          dim('API unavailable. Try again later.'),
        ]);
      }
    }

    printBlank();
    bindSlashCommands();
    scrollToBottom();
  }

  async function chartCmd(ticker) {
    if (!ticker) {
      printLines([
        `<span class="c-red">Usage:</span> /chart <ticker>`,
        `${dim('Example:')} ${sc('/chart NVDA')}`,
      ]);
      return;
    }

    const sym = ticker.toUpperCase();
    showLoading(`Fetching chart for ${sym}...`);

    try {
      const data = await fetchChartData(sym);
      hideLoading();

      const closes = data.closes;
      if (closes.length < 2) {
        printLines([`<span class="c-red">Not enough data for:</span> ${sym}`]);
        return;
      }

      // Build ASCII chart from real data
      const chartHeight = 8;
      const chartWidth = 50;
      const min = Math.min(...closes);
      const max = Math.max(...closes);
      const range = max - min || 1;

      // Resample to chartWidth points
      const sampled = [];
      for (let i = 0; i < chartWidth; i++) {
        const idx = Math.round(i * (closes.length - 1) / (chartWidth - 1));
        sampled.push(closes[idx]);
      }

      // Build chart grid
      const lines = [];
      for (let row = chartHeight - 1; row >= 0; row--) {
        const threshold = min + (row / (chartHeight - 1)) * range;
        const priceLabel = fmtPrice(threshold).padStart(12);
        let line = priceLabel + ' ┤';

        for (let col = 0; col < chartWidth; col++) {
          const val = sampled[col];
          const normalizedVal = (val - min) / range * (chartHeight - 1);
          const normalizedThreshold = row;

          if (Math.abs(normalizedVal - normalizedThreshold) < 0.5) {
            // Check connections
            const prevVal = col > 0 ? (sampled[col - 1] - min) / range * (chartHeight - 1) : normalizedVal;
            const nextVal = col < chartWidth - 1 ? (sampled[col + 1] - min) / range * (chartHeight - 1) : normalizedVal;

            if (Math.round(normalizedVal) > Math.round(prevVal)) line += '╱';
            else if (Math.round(normalizedVal) < Math.round(prevVal)) line += '╲';
            else line += '─';
          } else {
            line += ' ';
          }
        }
        lines.push(line);
      }

      // X-axis
      lines.push('             └' + '─'.repeat(chartWidth));
      const daysAgo = closes.length;
      lines.push(dim(`              -${daysAgo}d` + ' '.repeat(chartWidth - 20) + 'now'));

      const trend = closes[closes.length - 1] >= closes[0] ? 'positive' : 'negative';
      const changeVal = ((closes[closes.length - 1] / closes[0]) - 1) * 100;
      const changeStr = changeVal >= 0 ? `+${changeVal.toFixed(2)}%` : `${changeVal.toFixed(2)}%`;

      printRaw(panel(
        `${sym} · 30D CHART`,
        `<div style="padding:4px 0"><span class="${trend}">${lines.join('\n')}</span></div>`,
        'LIVE'
      ));
      printBlank();
      print(`  ${fmtPrice(closes[closes.length - 1])} ${dim('last')}  ·  <span class="${trend}">${changeStr}</span> ${dim('30d')}  ·  ${fmtPrice(max)} ${dim('high')}  ·  ${fmtPrice(min)} ${dim('low')}`);

    } catch (e) {
      hideLoading();
      // Fallback to static chart
      const m = mockData[sym];
      if (m) {
        const b = m.price;
        const chartLines = [
          `  ${fmtPrice(b*1.04).padStart(10)} ┤                                      ╭──`,
          `  ${fmtPrice(b*1.02).padStart(10)} ┤                           ╭──╮   ╭──╯`,
          `  ${fmtPrice(b*1.00).padStart(10)} ┤           ╭───╮      ╭────╯  ╰───╯`,
          `  ${fmtPrice(b*0.98).padStart(10)} ┤      ╭────╯   ╰──────╯`,
          `  ${fmtPrice(b*0.96).padStart(10)} ┤ ╭────╯`,
          `  ${fmtPrice(b*0.94).padStart(10)} ┤─╯`,
          `             └──────────────────────────────────────`,
          `  ${dim('           -30d              -15d              now')}`,
        ];
        printRaw(panel(`${sym} · 30D CHART`, `<div style="padding:4px 0">${chartLines.join('\n')}</div>`, 'DEMO'));
      } else {
        printLines([
          `<span class="c-red">Failed to fetch chart for:</span> ${sym}`,
          dim('API unavailable. Try again later.'),
        ]);
      }
    }

    printBlank();
    bindSlashCommands();
    scrollToBottom();
  }

  // ─── Router ───────────────────────────────────────────

  function runCommand(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return;

    print(`<span class="cmd-echo">❯ ${trimmed}</span>`);
    printBlank();

    commandHistory.push(trimmed);
    historyIndex = commandHistory.length;

    const parts = trimmed.split(/\s+/);
    let cmd = parts[0].toLowerCase();

    if (!cmd.startsWith('/') && commands['/' + cmd]) cmd = '/' + cmd;

    if (cmd === '/quote' || cmd === '/q' || cmd === '/price') {
      quoteCmd(parts[1]);
    } else if (cmd === '/chart' || cmd === '/c') {
      chartCmd(parts[1]);
    } else if (commands[cmd]) {
      commands[cmd]();
    } else {
      printLines([
        `<span class="c-red">unknown command:</span> ${trimmed}`,
        `Type ${sc('/help')} to see available commands.`,
      ]);
    }
  }

  // ─── Input handling ───────────────────────────────────

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = input.value;
      input.value = '';
      runCommand(val);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex > 0) { historyIndex--; input.value = commandHistory[historyIndex]; }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) { historyIndex++; input.value = commandHistory[historyIndex]; }
      else { historyIndex = commandHistory.length; input.value = ''; }
    }
  });

  document.addEventListener('click', (e) => {
    if (!window.getSelection().toString() && !e.target.closest('a')) input.focus();
  });

  // ─── Clock ────────────────────────────────────────────

  function updateClock() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    document.getElementById('clock').textContent = `${h}:${m}:${s}`;
  }
  updateClock();
  setInterval(updateClock, 1000);

  // ─── Market status ────────────────────────────────────

  function updateMarketStatus() {
    const now = new Date();
    const est = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const day = est.getDay();
    const time = est.getHours() * 60 + est.getMinutes();
    const el = document.getElementById('market-status');

    if (day >= 1 && day <= 5 && time >= 570 && time < 960) {
      el.textContent = '● MARKET OPEN';
      el.style.color = '#1a3a1a';
    } else {
      el.textContent = '○ MARKET CLOSED';
      el.style.color = '#3a1a1a';
    }
  }
  updateMarketStatus();
  setInterval(updateMarketStatus, 60000);

  // ─── Ticker bar (live) ────────────────────────────────

  const tickerSymbols = ['AAPL', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'AMD', 'BTC-USD', 'ETH-USD', '^GSPC', '^DJI'];
  const tickerLabels  = { '^GSPC': 'S&P', '^DJI': 'DOW', 'BTC-USD': 'BTC', 'ETH-USD': 'ETH' };

  function renderTickerBar(data) {
    const tc = document.createElement('div');
    tc.className = 'ticker-content';

    for (let i = 0; i < 2; i++) {
      tickerSymbols.forEach(sym => {
        const q = data[sym];
        if (!q) return;
        const item = document.createElement('span');
        item.className = 'ticker-item';
        const label = tickerLabels[sym] || sym;
        const dir = q.change >= 0 ? 'up' : 'down';
        const arrow = q.change >= 0 ? '▲' : '▼';
        const sign = q.change >= 0 ? '+' : '';
        item.innerHTML = `<span class="ticker-symbol">${label}</span> ${fmtPrice(q.price)} <span class="ticker-${dir}">${sign}${q.change.toFixed(2)}% ${arrow}</span>`;
        tc.appendChild(item);
      });
    }

    const bar = document.getElementById('ticker-bar');
    const old = bar.querySelector('.ticker-content');
    if (old) old.remove();
    bar.appendChild(tc);
  }

  // Initial ticker bar with mock data, then update with live
  const mockTickers = [
    { sym: 'AAPL', price: 189.84, change: 1.24 },
    { sym: 'NVDA', price: 721.33, change: 3.87 },
    { sym: 'MSFT', price: 415.20, change: 1.15 },
    { sym: 'GOOGL', price: 152.87, change: 0.82 },
    { sym: 'AMZN', price: 178.12, change: -0.31 },
    { sym: 'TSLA', price: 231.45, change: -2.14 },
    { sym: 'META', price: 501.33, change: 2.08 },
    { sym: 'AMD', price: 168.90, change: -1.42 },
    { sym: 'BTC-USD', price: 67843, change: 2.31 },
    { sym: 'ETH-USD', price: 3521, change: 1.87 },
    { sym: '^GSPC', price: 5842.31, change: 1.24 },
    { sym: '^DJI', price: 43890, change: 0.87 },
  ];

  // Render mock first
  const mockTickerData = {};
  mockTickers.forEach(t => { mockTickerData[t.sym] = { price: t.price, change: t.change }; });
  renderTickerBar(mockTickerData);

  // Then fetch live and update
  async function refreshTickerBar() {
    try {
      const data = await fetchQuotes(tickerSymbols);
      renderTickerBar(data);
    } catch (e) {
      // Keep mock data
    }
  }

  refreshTickerBar();
  setInterval(refreshTickerBar, 60000); // Refresh every 60s

  // ─── Boot ─────────────────────────────────────────────
  boot();

})();
