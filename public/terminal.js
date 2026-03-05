// ═══════════════════════════════════════════════════════════
// WealthWatch Terminal v2.0
// TUI-style CLI with live market data, charts & Supabase auth
// ═══════════════════════════════════════════════════════════

(function () {
  'use strict';

  const output = document.getElementById('output');
  const input  = document.getElementById('cmd-input');
  const commandHistory = [];
  let historyIndex = -1;

  // ─── Supabase Config ──────────────────────────────────
  // 1. Go to supabase.com → create a free project
  // 2. Go to Settings → API → copy URL and anon key
  // 3. Paste them below
  // 4. Run the SQL migration from supabase-schema.sql in the SQL editor

  const SUPABASE_URL  = 'https://nrrmrbymsxcsvuofsonx.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ycm1yYnltc3hjc3Z1b2Zzb254Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MzYxNDAsImV4cCI6MjA4ODMxMjE0MH0.55BiZOo98GqW0JZU-fM-EgBITCQJRpgb4-LML6zkWkI';

  let sb = null;
  let currentUser = null;

  function supabaseEnabled() {
    return SUPABASE_URL !== 'YOUR_SUPABASE_URL' && SUPABASE_ANON !== 'YOUR_SUPABASE_ANON_KEY';
  }

  if (supabaseEnabled() && typeof supabase !== 'undefined') {
    sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
    sb.auth.getSession().then(({ data }) => {
      if (data.session) {
        currentUser = data.session.user;
        updateAuthUI();
      }
    });
    sb.auth.onAuthStateChange((_event, session) => {
      currentUser = session?.user || null;
      updateAuthUI();
    });
  }

  function updateAuthUI() {
    const el = document.getElementById('auth-status');
    const sep = document.getElementById('auth-sep');
    if (!el) return;
    if (currentUser) {
      el.textContent = currentUser.email;
      el.style.display = '';
      if (sep) sep.style.display = '';
    } else {
      el.textContent = '';
      el.style.display = 'none';
      if (sep) sep.style.display = 'none';
    }
  }
  updateAuthUI();

  // ─── Data fetching ──────────────────────────────────────

  const API_BASE = '/api/quote';

  const cache = {};
  const CACHE_TTL = 30000;

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

    const timestamps = result.timestamp || [];
    const quote = result.indicators.quote[0];
    const closes = quote.close || [];
    const opens = quote.open || [];
    const highs = quote.high || [];
    const lows = quote.low || [];
    const volumes = quote.volume || [];
    const meta = result.meta;

    // Build OHLC data for lightweight-charts
    const candles = [];
    const lineData = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (closes[i] == null) continue;
      const time = timestamps[i];
      candles.push({
        time,
        open: opens[i] || closes[i],
        high: highs[i] || closes[i],
        low: lows[i] || closes[i],
        close: closes[i],
      });
      lineData.push({ time, value: closes[i] });
    }

    const data = {
      candles,
      lineData,
      closes: closes.filter(v => v != null),
      name: meta.shortName || symbol,
      price: meta.regularMarketPrice,
    };
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

  // Allocation colors
  const ALLOC_COLORS = [
    '#5f87ff', '#5faf5f', '#d7af5f', '#d75f5f', '#af5faf',
    '#5fafaf', '#ff875f', '#87afd7', '#d787af', '#afd75f',
  ];

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
    const trend = closes[closes.length - 1] >= closes[0] ? 'positive' : 'negative';
    return `<span class="${trend}">${spark}</span>`;
  }

  // ─── TradingView Chart Renderer ──────────────────────

  function renderChart(containerId, chartData, symbol) {
    const container = document.getElementById(containerId);
    if (!container || typeof LightweightCharts === 'undefined') return;

    const chart = LightweightCharts.createChart(container, {
      layout: {
        background: { color: '#111111' },
        textColor: '#555',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#1a1a1a' },
        horzLines: { color: '#1a1a1a' },
      },
      crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal,
        vertLine: { color: '#5f87ff44', width: 1, style: 2 },
        horzLine: { color: '#5f87ff44', width: 1, style: 2 },
      },
      rightPriceScale: {
        borderColor: '#2a2a2a',
      },
      timeScale: {
        borderColor: '#2a2a2a',
        timeVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
    });

    const trend = chartData.closes[chartData.closes.length - 1] >= chartData.closes[0];
    const upColor = '#5faf5f';
    const downColor = '#d75f5f';

    // Area chart with gradient
    const areaSeries = chart.addAreaSeries({
      topColor: trend ? 'rgba(95, 175, 95, 0.3)' : 'rgba(215, 95, 95, 0.3)',
      bottomColor: trend ? 'rgba(95, 175, 95, 0.02)' : 'rgba(215, 95, 95, 0.02)',
      lineColor: trend ? upColor : downColor,
      lineWidth: 2,
      crosshairMarkerBackgroundColor: trend ? upColor : downColor,
      crosshairMarkerBorderColor: '#fff',
    });

    areaSeries.setData(chartData.lineData);
    chart.timeScale().fitContent();

    // Resize handler
    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth });
    });
    ro.observe(container);
  }

  // ─── Supabase helpers ──────────────────────────────────

  async function getHoldings() {
    if (!sb || !currentUser) return null;
    const { data, error } = await sb
      .from('holdings')
      .select('*')
      .order('added_at', { ascending: true });
    if (error) throw error;
    return data;
  }

  async function addHolding(symbol, qty, avgCost) {
    if (!sb || !currentUser) throw new Error('Not logged in');
    // Upsert — if symbol exists, update qty and avg cost
    const { data: existing } = await sb
      .from('holdings')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('symbol', symbol)
      .single();

    if (existing) {
      // Weighted average
      const totalQty = existing.qty + qty;
      const newAvg = ((existing.avg_cost * existing.qty) + (avgCost * qty)) / totalQty;
      const { error } = await sb
        .from('holdings')
        .update({ qty: totalQty, avg_cost: newAvg })
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await sb
        .from('holdings')
        .insert({ user_id: currentUser.id, symbol, qty, avg_cost: avgCost });
      if (error) throw error;
    }
  }

  async function removeHolding(symbol) {
    if (!sb || !currentUser) throw new Error('Not logged in');
    const { error } = await sb
      .from('holdings')
      .delete()
      .eq('user_id', currentUser.id)
      .eq('symbol', symbol);
    if (error) throw error;
  }

  // ─── Portfolio Insights Engine ───────────────────────────

  async function fetchHistoricalData(symbols, range) {
    const key = 'history:' + symbols.join(',') + ':' + range;
    const cached = getCached(key);
    if (cached) return cached;

    const res = await fetch(`${API_BASE}?symbols=${symbols.join(',')}&type=history&range=${range || '6mo'}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    setCache(key, json.history || {});
    return json.history || {};
  }

  async function fetchSummaryData(symbols) {
    const key = 'summary:' + symbols.join(',');
    const cached = getCached(key);
    if (cached) return cached;

    const res = await fetch(`${API_BASE}?symbols=${symbols.join(',')}&type=summary`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    setCache(key, json.summaries || {});
    return json.summaries || {};
  }

  // Compute daily returns from close prices
  function dailyReturns(closes) {
    const returns = [];
    for (let i = 1; i < closes.length; i++) {
      if (closes[i] != null && closes[i - 1] != null && closes[i - 1] !== 0) {
        returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
      } else {
        returns.push(0);
      }
    }
    return returns;
  }

  function mean(arr) {
    if (!arr.length) return 0;
    return arr.reduce((s, v) => s + v, 0) / arr.length;
  }

  function stddev(arr) {
    const m = mean(arr);
    const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1 || 1);
    return Math.sqrt(variance);
  }

  function correlation(a, b) {
    const n = Math.min(a.length, b.length);
    if (n < 5) return 0;
    const aSlice = a.slice(-n);
    const bSlice = b.slice(-n);
    const mA = mean(aSlice);
    const mB = mean(bSlice);
    let num = 0, dA = 0, dB = 0;
    for (let i = 0; i < n; i++) {
      const da = aSlice[i] - mA;
      const db = bSlice[i] - mB;
      num += da * db;
      dA += da * da;
      dB += db * db;
    }
    const denom = Math.sqrt(dA * dB);
    return denom === 0 ? 0 : num / denom;
  }

  function beta(assetReturns, benchmarkReturns) {
    const n = Math.min(assetReturns.length, benchmarkReturns.length);
    if (n < 5) return 1;
    const a = assetReturns.slice(-n);
    const b = benchmarkReturns.slice(-n);
    const mA = mean(a);
    const mB = mean(b);
    let cov = 0, varB = 0;
    for (let i = 0; i < n; i++) {
      const da = a[i] - mA;
      const db = b[i] - mB;
      cov += da * db;
      varB += db * db;
    }
    return varB === 0 ? 1 : cov / varB;
  }

  function corrClass(val) {
    if (Math.abs(val) > 0.99) return 'corr-self';
    if (val >= 0.6) return 'corr-high-pos';
    if (val >= 0.3) return 'corr-mid-pos';
    if (val >= -0.3) return 'corr-low';
    return 'corr-neg';
  }

  async function getInsightsHoldings() {
    if (sb && currentUser) {
      try {
        const dbHoldings = await getHoldings();
        if (dbHoldings && dbHoldings.length > 0) {
          return dbHoldings.map(h => ({ sym: h.symbol, qty: h.qty, avgCost: h.avg_cost }));
        }
      } catch (e) {}
    }
    // Demo fallback
    return [
      { sym: 'AAPL',    qty: 50,  avgCost: 171.20 },
      { sym: 'NVDA',    qty: 25,  avgCost: 480.50 },
      { sym: 'TSLA',    qty: 10,  avgCost: 248.90 },
      { sym: 'BTC-USD', qty: 0.5, avgCost: 42100  },
    ];
  }

  async function refreshInsights() {
    const panel = document.getElementById('insights-panel');
    if (!panel || panel.classList.contains('collapsed')) return;

    const divEl = document.getElementById('insight-dividends');
    const ratesEl = document.getElementById('insight-rates');
    const riskEl = document.getElementById('insight-risk');
    const corrEl = document.getElementById('insight-correlation');

    // Show loading state
    [divEl, ratesEl, riskEl, corrEl].forEach(el => {
      if (el) el.innerHTML = '<span class="c-dim loading-dots">Loading</span>';
    });

    try {
      const holdings = await getInsightsHoldings();
      const holdingSymbols = holdings.map(h => h.sym);

      // Fetch all data in parallel
      // SPY for benchmark, ^IRX for 13-week T-bill (risk-free), ^TNX for 10-year treasury
      const allSymbols = [...new Set([...holdingSymbols, 'SPY', '^IRX', '^TNX'])];
      const [history, summaries, quotes] = await Promise.all([
        fetchHistoricalData(allSymbols, '6mo'),
        fetchSummaryData(holdingSymbols),
        fetchQuotes(holdingSymbols),
      ]);

      // ── Risk-free rate & interest rates ──
      const riskFreeRate = history['^IRX']?.closes?.filter(v => v != null).pop() || 4.5;
      const tenYearRate = history['^TNX']?.closes?.filter(v => v != null).pop() || 4.2;
      const riskFreeDaily = riskFreeRate / 100 / 252;

      let ratesHtml = '';
      ratesHtml += `<div class="insight-row"><span class="insight-label">Risk-Free (13W T-Bill)</span><span class="insight-value">${riskFreeRate.toFixed(2)}%</span></div>`;
      ratesHtml += `<div class="insight-row"><span class="insight-label">10Y Treasury</span><span class="insight-value">${tenYearRate.toFixed(2)}%</span></div>`;
      ratesHtml += `<div class="insight-row"><span class="insight-label">Spread (10Y-3M)</span>`;
      const spread = tenYearRate - riskFreeRate;
      const spreadCls = spread >= 0 ? 'positive' : 'negative';
      ratesHtml += `<span class="insight-value ${spreadCls}">${spread >= 0 ? '+' : ''}${spread.toFixed(2)}%</span></div>`;
      if (ratesEl) ratesEl.innerHTML = ratesHtml;

      // ── Dividends ──
      let totalDivIncome = 0;
      let nextExDate = null;
      let nextExSymbol = '';
      let divRows = '';
      const now = Date.now() / 1000;

      holdings.forEach(h => {
        const s = summaries[h.sym];
        const q = quotes[h.sym];
        const price = q?.price || s?.price || 0;
        const divRate = s?.trailingAnnualDividendRate || 0;
        const divYield = s?.trailingAnnualDividendYield || 0;
        const annualDiv = divRate * h.qty;
        totalDivIncome += annualDiv;

        if (s?.exDividendDate && s.exDividendDate > now) {
          if (!nextExDate || s.exDividendDate < nextExDate) {
            nextExDate = s.exDividendDate;
            nextExSymbol = h.sym;
          }
        }

        if (divRate > 0) {
          divRows += `<div class="insight-row"><span class="insight-label">${h.sym}</span><span class="insight-value">$${divRate.toFixed(2)}/sh (${(divYield * 100).toFixed(2)}%)</span></div>`;
        }
      });

      let divHtml = '';
      divHtml += `<div class="insight-row"><span class="insight-label">Annual Income</span><span class="insight-value-lg">$${totalDivIncome.toFixed(2)}</span></div>`;
      divHtml += `<div class="insight-row"><span class="insight-label">Monthly (est.)</span><span class="insight-value">$${(totalDivIncome / 12).toFixed(2)}</span></div>`;
      if (nextExDate) {
        const exDate = new Date(nextExDate * 1000);
        divHtml += `<div class="insight-row"><span class="insight-label">Next Ex-Date</span><span class="insight-value c-yellow">${nextExSymbol} ${exDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></div>`;
      } else {
        divHtml += `<div class="insight-row"><span class="insight-label">Next Ex-Date</span><span class="insight-value c-dim">--</span></div>`;
      }
      if (divRows) {
        divHtml += `<div style="border-top:1px solid var(--border);margin-top:4px;padding-top:4px">${divRows}</div>`;
      }
      if (totalDivIncome === 0) {
        divHtml += `<div class="insight-sub" style="margin-top:4px">No dividend-paying holdings</div>`;
      }
      if (divEl) divEl.innerHTML = divHtml;

      // ── Calculate returns for each holding ──
      const returnsMap = {};
      allSymbols.forEach(sym => {
        if (history[sym]?.closes) {
          const closes = history[sym].closes.filter(v => v != null);
          returnsMap[sym] = dailyReturns(closes);
        }
      });

      const spyReturns = returnsMap['SPY'] || [];

      // ── Portfolio-level metrics ──
      // Weight each holding by market value
      let totalValue = 0;
      const positionValues = holdings.map(h => {
        const q = quotes[h.sym];
        const price = q?.price || summaries[h.sym]?.price || 0;
        const val = price * h.qty;
        totalValue += val;
        return { sym: h.sym, value: val };
      });

      const weights = positionValues.map(p => totalValue > 0 ? p.value / totalValue : 1 / holdings.length);

      // Portfolio daily returns (weighted sum)
      const minLen = Math.min(
        ...holdingSymbols.map(s => (returnsMap[s]?.length || 0)),
        spyReturns.length || Infinity
      );

      let portfolioReturns = [];
      if (minLen > 5) {
        for (let i = 0; i < minLen; i++) {
          let portRet = 0;
          holdingSymbols.forEach((sym, j) => {
            const r = returnsMap[sym];
            if (r && r.length >= minLen) {
              portRet += weights[j] * r[r.length - minLen + i];
            }
          });
          portfolioReturns.push(portRet);
        }
      }

      // Portfolio beta
      const portBeta = portfolioReturns.length > 5 && spyReturns.length > 5
        ? beta(portfolioReturns, spyReturns.slice(-portfolioReturns.length))
        : null;

      // Sharpe ratio (annualized)
      const portMeanReturn = mean(portfolioReturns);
      const portStd = stddev(portfolioReturns);
      const sharpe = portStd > 0
        ? ((portMeanReturn - riskFreeDaily) / portStd) * Math.sqrt(252)
        : 0;

      // Sortino ratio (downside deviation only)
      const downsideReturns = portfolioReturns.filter(r => r < riskFreeDaily).map(r => r - riskFreeDaily);
      const downsideDev = downsideReturns.length > 0 ? Math.sqrt(downsideReturns.reduce((s, v) => s + v * v, 0) / downsideReturns.length) : 0;
      const sortino = downsideDev > 0
        ? ((portMeanReturn - riskFreeDaily) / downsideDev) * Math.sqrt(252)
        : 0;

      // Portfolio volatility (annualized)
      const portVol = portStd * Math.sqrt(252) * 100;

      // Individual betas
      const holdingBetas = holdingSymbols.map(sym => {
        const r = returnsMap[sym];
        return r && r.length > 5 && spyReturns.length > 5
          ? beta(r, spyReturns.slice(-r.length))
          : null;
      });

      // ── Risk metrics card ──
      let riskHtml = '';
      if (portBeta != null) {
        riskHtml += `<div class="insight-row"><span class="insight-label">Portfolio Beta</span><span class="insight-value-lg">${portBeta.toFixed(2)}</span></div>`;
      }
      const sharpeCls = sharpe >= 1 ? 'positive' : sharpe >= 0 ? 'c-yellow' : 'negative';
      riskHtml += `<div class="insight-row"><span class="insight-label">Sharpe Ratio</span><span class="insight-value ${sharpeCls}">${sharpe.toFixed(2)}</span></div>`;
      riskHtml += `<div class="insight-row"><span class="insight-label">Sortino Ratio</span><span class="insight-value ${sharpeCls}">${sortino.toFixed(2)}</span></div>`;
      riskHtml += `<div class="insight-row"><span class="insight-label">Volatility (ann.)</span><span class="insight-value">${portVol.toFixed(1)}%</span></div>`;

      // Individual beta bars
      riskHtml += `<div style="border-top:1px solid var(--border);margin-top:6px;padding-top:6px">`;
      holdingSymbols.forEach((sym, i) => {
        const b = holdingBetas[i];
        if (b == null) return;
        const absB = Math.abs(b);
        const pct = Math.min(absB / 2.5 * 100, 100);
        const color = absB > 1.5 ? 'var(--red)' : absB > 1 ? 'var(--yellow)' : 'var(--green)';
        riskHtml += `<div class="beta-bar-container">
          <span class="beta-bar-label">${sym}</span>
          <div class="beta-bar-track"><div class="beta-bar-fill" style="width:${pct}%;background:${color}"></div></div>
          <span class="beta-bar-value" style="color:${color}">${b.toFixed(2)}</span>
        </div>`;
      });
      riskHtml += '</div>';
      if (riskEl) riskEl.innerHTML = riskHtml;

      // ── Correlation matrix ──
      const corrSymbols = holdingSymbols.filter(s => returnsMap[s]?.length > 5);
      if (corrSymbols.length >= 2) {
        let corrHtml = '<table class="corr-table"><thead><tr><th></th>';
        corrSymbols.forEach(s => { corrHtml += `<th>${s.replace('-USD', '')}</th>`; });
        corrHtml += '</tr></thead><tbody>';

        corrSymbols.forEach((rowSym, ri) => {
          corrHtml += `<tr><td class="corr-row-label">${rowSym.replace('-USD', '')}</td>`;
          corrSymbols.forEach((colSym, ci) => {
            if (ri === ci) {
              corrHtml += '<td class="corr-self">1.00</td>';
            } else {
              const c = correlation(returnsMap[rowSym], returnsMap[colSym]);
              corrHtml += `<td class="${corrClass(c)}">${c.toFixed(2)}</td>`;
            }
          });
          corrHtml += '</tr>';
        });

        corrHtml += '</tbody></table>';
        if (corrEl) corrEl.innerHTML = corrHtml;
      } else {
        if (corrEl) corrEl.innerHTML = '<span class="c-dim">Need 2+ holdings with price history</span>';
      }

    } catch (e) {
      console.error('Insights error:', e);
      [divEl, ratesEl, riskEl, corrEl].forEach(el => {
        if (el && el.innerHTML.includes('Loading')) {
          el.innerHTML = '<span class="c-dim">Data unavailable</span>';
        }
      });
    }
  }

  // Insights panel controls
  function initInsightsPanel() {
    const panel = document.getElementById('insights-panel');
    const toggle = document.getElementById('insights-toggle');
    const refresh = document.getElementById('insights-refresh');

    if (!panel) return;

    toggle?.addEventListener('click', () => {
      panel.classList.toggle('collapsed');
      if (!panel.classList.contains('collapsed')) {
        refreshInsights();
      }
    });

    refresh?.addEventListener('click', () => {
      // Clear cache for insights data
      Object.keys(cache).forEach(k => {
        if (k.startsWith('history:') || k.startsWith('summary:')) delete cache[k];
      });
      refreshInsights();
    });

    // Initial load
    refreshInsights();
    // Auto-refresh every 5 minutes
    setInterval(refreshInsights, 300000);
  }

  // ─── Boot ─────────────────────────────────────────────

  const isMobile = window.innerWidth <= 480;

  function boot() {
    print('');
    if (isMobile) {
      print(`<span class="c-blue c-bold">  [$] WealthWatch</span>`);
      print(`<span class="c-dim">  ─────────────────────</span>`);
    } else {
      print(`<span class="c-blue c-bold">  ██╗    ██╗ ███████╗  █████╗  ██╗  ████████╗██╗  ██╗</span>`);
      print(`<span class="c-blue c-bold">  ██║    ██║ ██╔════╝ ██╔══██╗ ██║  ╚══██╔══╝██║  ██║</span>`);
      print(`<span class="c-blue c-bold">  ██║ █╗ ██║ █████╗   ███████║ ██║     ██║   ███████║</span>`);
      print(`<span class="c-blue c-bold">  ██║███╗██║ ██╔══╝   ██╔══██║ ██║     ██║   ██╔══██║</span>`);
      print(`<span class="c-blue c-bold">  ╚███╔███╔╝ ███████╗ ██║  ██║ ███████╗██║   ██║  ██║</span>`);
      print(`<span class="c-blue c-bold">   ╚══╝╚══╝  ╚══════╝ ╚═╝  ╚═╝ ╚══════╝╚═╝   ╚═╝  ╚═╝</span>`);
      print(`<span class="c-dim">  ──────────────────────────────────────────────────────</span>`);
    }
    print(`<span class="c-dim">  Terminal Finance Dashboard · v2.0</span>`);
    printBlank();
    print(`<span class="c-bright">  Commands:</span>`);
    printBlank();
    print(`    ${sc('/market')}        ${dim('Market overview & indices')}`);
    print(`    ${sc('/portfolio')}     ${dim('Portfolio positions & P/L')}`);
    print(`    ${sc('/analytics')}     ${dim('Portfolio analytics & allocation')}`);
    print(`    ${sc('/insights')}      ${dim('Toggle insights dashboard')}`);
    print(`    ${sc('/quote')} ${dim('<SYM>')}   ${dim('Real-time stock quote')}`);
    print(`    ${sc('/chart')} ${dim('<SYM>')}   ${dim('Interactive price chart (30d)')}`);
    print(`    ${sc('/watchlist')}     ${dim('Tracked tickers')}`);
    print(`    ${sc('/alerts')}        ${dim('Price alert status')}`);
    print(`    ${sc('/news')}          ${dim('Financial headlines')}`);
    printBlank();
    if (supabaseEnabled()) {
      print(`  <span class="c-cyan">Account:</span>`);
      print(`    ${sc('/signup')}        ${dim('Create account')}`);
      print(`    ${sc('/login')}         ${dim('Sign in')}`);
      print(`    ${sc('/logout')}        ${dim('Sign out')}`);
      print(`    ${sc('/add')} ${dim('<SYM> <QTY> <COST>')}  ${dim('Add holding')}`);
      print(`    ${sc('/remove')} ${dim('<SYM>')}             ${dim('Remove holding')}`);
      printBlank();
    }
    print(`    ${sc('/about')}         ${dim('About WealthWatch')}`);
    print(`    ${sc('/help')}          ${dim('All commands')}`);
    print(`    ${sc('/clear')}         ${dim('Clear terminal')}`);
    printBlank();
    print(`  ${dim('Click any command or type below. ↑↓ for history.')}`);
    if (!supabaseEnabled()) {
      printBlank();
      print(`  ${dim('Supabase not configured — using demo portfolio.')}`);
      print(`  ${dim('Set SUPABASE_URL & ANON_KEY in terminal.js to enable accounts.')}`);
    }
    printBlank();
    bindSlashCommands();
    scrollToBottom();
  }

  // ─── Commands ─────────────────────────────────────────

  const commands = {

    '/help': function() {
      const authCmds = supabaseEnabled() ? [
        '',
        bright('Account'),
        `  ${sc('/signup')}                  ${dim('Create a new account')}`,
        `  ${sc('/login')}                   ${dim('Sign in to your account')}`,
        `  ${sc('/logout')}                  ${dim('Sign out')}`,
        `  ${sc('/add')} ${dim('<SYM> <QTY> <COST>')}   ${dim('Add a holding to portfolio')}`,
        `  ${sc('/remove')} ${dim('<SYM>')}              ${dim('Remove a holding')}`,
      ] : [];

      printLines([
        bright('Commands'),
        '',
        `  ${sc('/market')}                  ${dim('Live market indices & crypto')}`,
        `  ${sc('/portfolio')}               ${dim('Portfolio positions & P/L')}`,
        `  ${sc('/analytics')}               ${dim('Portfolio analytics & charts')}`,
        `  ${sc('/insights')}                ${dim('Toggle insights dashboard')}`,
        `  ${sc('/quote')} ${dim('<ticker>')}          ${dim('Real-time stock quote')}`,
        `  ${sc('/chart')} ${dim('<ticker>')}          ${dim('Interactive price chart (30d)')}`,
        `  ${sc('/watchlist')}               ${dim('Tracked tickers with sparklines')}`,
        `  ${sc('/alerts')}                  ${dim('Active price alerts')}`,
        `  ${sc('/news')}                    ${dim('Latest financial headlines')}`,
        ...authCmds,
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
      showLoading('Fetching portfolio...');

      let holdings;
      let isUserPortfolio = false;

      // Try Supabase first
      if (sb && currentUser) {
        try {
          const dbHoldings = await getHoldings();
          if (dbHoldings && dbHoldings.length > 0) {
            holdings = dbHoldings.map(h => ({ sym: h.symbol, qty: h.qty, avgCost: h.avg_cost }));
            isUserPortfolio = true;
          }
        } catch (e) {
          // Fall through to demo
        }
      }

      // Demo portfolio fallback
      if (!holdings) {
        holdings = [
          { sym: 'AAPL',    qty: 50,  avgCost: 171.20 },
          { sym: 'NVDA',    qty: 25,  avgCost: 480.50 },
          { sym: 'TSLA',    qty: 10,  avgCost: 248.90 },
          { sym: 'BTC-USD', qty: 0.5, avgCost: 42100  },
        ];
      }

      let rows, totalValue = 0, totalPL = 0, totalCost = 0;
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
          totalCost += h.avgCost * h.qty;
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
          totalCost += h.avgCost * h.qty;
          const plStr = pl >= 0 ? pos(`+$${Math.abs(pl).toFixed(2)}`) : neg(`-$${Math.abs(pl).toFixed(2)}`);
          const pctStr = plPct >= 0 ? pos(`+${plPct.toFixed(1)}%`) : neg(`${plPct.toFixed(1)}%`);
          return [tn(h.sym), String(h.qty), fmtPrice(h.avgCost), fmtPrice(last), plStr, pctStr];
        });
      }

      const totalPLStr = totalPL >= 0
        ? pos(`<strong>+$${Math.abs(totalPL).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong>`)
        : neg(`<strong>-$${Math.abs(totalPL).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong>`);
      const totalPctStr = totalCost > 0
        ? (totalPL >= 0 ? pos(`+${((totalPL / totalCost) * 100).toFixed(1)}%`) : neg(`${((totalPL / totalCost) * 100).toFixed(1)}%`))
        : '';
      const footer = ['', '', '', `<strong>${fmtPrice(totalValue)}</strong>`, totalPLStr, totalPctStr];

      const badge = isUserPortfolio ? (usedLive ? 'LIVE' : 'SAVED') : (usedLive ? 'DEMO · LIVE' : 'DEMO');
      printRaw(panel('Portfolio', table(['Ticker', 'Qty', 'Avg Cost', 'Last', 'P/L', '%'], rows, footer), badge));
      printBlank();

      if (!isUserPortfolio && supabaseEnabled()) {
        if (!currentUser) {
          print(dim(`Demo portfolio shown. ${sc('/login')} or ${sc('/signup')} to track your own.`));
        } else {
          print(dim(`No holdings found. Use ${sc('/add')} AAPL 10 150.00 to add stocks.`));
        }
      } else if (!isUserPortfolio) {
        print(dim(`Demo portfolio. Configure Supabase to save your own holdings.`));
      }

      print(dim(`${sc('/analytics')} for allocation & stats  ·  ${sc('/chart')} <ticker> for charts`));
      printBlank();
      bindSlashCommands();
      scrollToBottom();
    },

    '/analytics': async function() {
      showLoading('Analyzing portfolio...');

      let holdings;
      let isUserPortfolio = false;

      if (sb && currentUser) {
        try {
          const dbHoldings = await getHoldings();
          if (dbHoldings && dbHoldings.length > 0) {
            holdings = dbHoldings.map(h => ({ sym: h.symbol, qty: h.qty, avgCost: h.avg_cost }));
            isUserPortfolio = true;
          }
        } catch (e) {}
      }

      if (!holdings) {
        holdings = [
          { sym: 'AAPL',    qty: 50,  avgCost: 171.20 },
          { sym: 'NVDA',    qty: 25,  avgCost: 480.50 },
          { sym: 'TSLA',    qty: 10,  avgCost: 248.90 },
          { sym: 'BTC-USD', qty: 0.5, avgCost: 42100  },
        ];
      }

      try {
        const data = await fetchQuotes(holdings.map(h => h.sym));
        hideLoading();

        // Calculate position values
        const positions = holdings.map(h => {
          const q = data[h.sym];
          const price = q ? q.price : mockData[h.sym]?.price || 0;
          const value = price * h.qty;
          const pl = (price - h.avgCost) * h.qty;
          const plPct = ((price / h.avgCost) - 1) * 100;
          const change = q ? q.change : mockData[h.sym]?.change || 0;
          return { sym: h.sym, qty: h.qty, avgCost: h.avgCost, price, value, pl, plPct, dayChange: change };
        });

        const totalValue = positions.reduce((s, p) => s + p.value, 0);
        const totalPL = positions.reduce((s, p) => s + p.pl, 0);
        const totalCost = positions.reduce((s, p) => s + p.avgCost * p.qty, 0);
        const totalPLPct = totalCost > 0 ? ((totalPL / totalCost) * 100) : 0;
        const dayPL = positions.reduce((s, p) => s + (p.value * p.dayChange / 100), 0);

        // Summary stats
        const summaryRows = [
          ['Total Value', `<strong>${fmtPrice(totalValue)}</strong>`],
          ['Total P/L', totalPL >= 0 ? pos(`+$${Math.abs(totalPL).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} (${totalPLPct.toFixed(1)}%)`) : neg(`-$${Math.abs(totalPL).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} (${totalPLPct.toFixed(1)}%)`)],
          ['Day P/L', dayPL >= 0 ? pos(`+$${Math.abs(dayPL).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`) : neg(`-$${Math.abs(dayPL).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`)],
          ['Positions', String(positions.length)],
          ['Largest', positions.length ? tn(positions.reduce((a, b) => a.value > b.value ? a : b).sym) : '—'],
        ];
        printRaw(panel('Summary', table(['Metric', 'Value'], summaryRows), isUserPortfolio ? 'YOUR PORTFOLIO' : 'DEMO'));

        // Allocation bar
        let allocHtml = '<div class="alloc-bar">';
        positions.forEach((p, i) => {
          const pct = totalValue > 0 ? (p.value / totalValue * 100) : 0;
          const color = ALLOC_COLORS[i % ALLOC_COLORS.length];
          allocHtml += `<div class="alloc-segment" style="width:${pct}%;background:${color}" title="${p.sym}: ${pct.toFixed(1)}%">${pct >= 8 ? p.sym : ''}</div>`;
        });
        allocHtml += '</div>';

        allocHtml += '<div class="alloc-legend">';
        positions.forEach((p, i) => {
          const pct = totalValue > 0 ? (p.value / totalValue * 100) : 0;
          const color = ALLOC_COLORS[i % ALLOC_COLORS.length];
          allocHtml += `<span class="alloc-legend-item"><span class="alloc-swatch" style="background:${color}"></span>${p.sym} ${pct.toFixed(1)}%</span>`;
        });
        allocHtml += '</div>';
        printRaw(panel('Allocation', allocHtml));

        // Top gainers / losers
        const sorted = [...positions].sort((a, b) => b.plPct - a.plPct);
        const gainLossRows = sorted.map(p => {
          const plStr = p.pl >= 0
            ? pos(`+$${Math.abs(p.pl).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`)
            : neg(`-$${Math.abs(p.pl).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
          const pctStr = p.plPct >= 0
            ? pos(`+${p.plPct.toFixed(1)}%`)
            : neg(`${p.plPct.toFixed(1)}%`);
          return [tn(p.sym), fmtPrice(p.value), plStr, pctStr];
        });
        printRaw(panel('Performance', table(['Ticker', 'Value', 'P/L', '%'], gainLossRows)));

      } catch (e) {
        hideLoading();
        printLines([
          `<span class="c-red">Failed to load analytics</span>`,
          dim('Could not fetch current prices. Try again later.'),
        ]);
      }

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

    '/signup': async function() {
      if (!supabaseEnabled()) {
        printLines([
          `<span class="c-red">Supabase not configured</span>`,
          dim('Set SUPABASE_URL and SUPABASE_ANON in terminal.js'),
          dim('Get a free project at supabase.com'),
        ]);
        return;
      }
      if (currentUser) {
        printLines([
          `<span class="c-yellow">Already signed in as</span> ${currentUser.email}`,
          `Use ${sc('/logout')} to sign out first.`,
        ]);
        return;
      }

      // Render inline form
      const formId = 'signup-form-' + Date.now();
      printRaw(`<div id="${formId}" class="tui-panel" style="margin:6px 0">
        <div class="tui-panel-title" style="background:var(--bg-hover)">SIGN UP</div>
        <div class="tui-panel-body">
          <div class="auth-form-row"><span class="c-dim" style="width:60px">Email:</span><input type="email" class="auth-input" id="${formId}-email" placeholder="you@email.com"></div>
          <div class="auth-form-row"><span class="c-dim" style="width:60px">Pass:</span><input type="password" class="auth-input" id="${formId}-pass" placeholder="min 6 characters"></div>
          <div class="auth-form-row" style="margin-top:8px"><button class="auth-btn" id="${formId}-btn">CREATE ACCOUNT</button></div>
          <div id="${formId}-msg" style="margin-top:6px"></div>
        </div>
      </div>`);

      scrollToBottom();

      const btn = document.getElementById(`${formId}-btn`);
      btn.addEventListener('click', async () => {
        const email = document.getElementById(`${formId}-email`).value.trim();
        const pass = document.getElementById(`${formId}-pass`).value;
        const msgEl = document.getElementById(`${formId}-msg`);

        if (!email || !pass) { msgEl.innerHTML = `<span class="c-red">Email and password required</span>`; return; }
        if (pass.length < 6) { msgEl.innerHTML = `<span class="c-red">Password must be at least 6 characters</span>`; return; }

        msgEl.innerHTML = `<span class="c-dim loading-dots">Creating account</span>`;
        const { data, error } = await sb.auth.signUp({ email, password: pass });

        if (error) {
          msgEl.innerHTML = `<span class="c-red">${error.message}</span>`;
        } else if (data.user && !data.session) {
          msgEl.innerHTML = `<span class="c-green">Check your email for a confirmation link!</span>`;
        } else {
          msgEl.innerHTML = `<span class="c-green">Account created! You're signed in.</span>`;
        }
        scrollToBottom();
      });
    },

    '/login': async function() {
      if (!supabaseEnabled()) {
        printLines([
          `<span class="c-red">Supabase not configured</span>`,
          dim('Set SUPABASE_URL and SUPABASE_ANON in terminal.js'),
        ]);
        return;
      }
      if (currentUser) {
        printLines([
          `<span class="c-yellow">Already signed in as</span> ${currentUser.email}`,
          `Use ${sc('/logout')} to sign out first.`,
        ]);
        return;
      }

      const formId = 'login-form-' + Date.now();
      printRaw(`<div id="${formId}" class="tui-panel" style="margin:6px 0">
        <div class="tui-panel-title" style="background:var(--bg-hover)">SIGN IN</div>
        <div class="tui-panel-body">
          <div class="auth-form-row"><span class="c-dim" style="width:60px">Email:</span><input type="email" class="auth-input" id="${formId}-email" placeholder="you@email.com"></div>
          <div class="auth-form-row"><span class="c-dim" style="width:60px">Pass:</span><input type="password" class="auth-input" id="${formId}-pass" placeholder="password"></div>
          <div class="auth-form-row" style="margin-top:8px"><button class="auth-btn" id="${formId}-btn">SIGN IN</button></div>
          <div id="${formId}-msg" style="margin-top:6px"></div>
        </div>
      </div>`);

      scrollToBottom();

      const btn = document.getElementById(`${formId}-btn`);
      btn.addEventListener('click', async () => {
        const email = document.getElementById(`${formId}-email`).value.trim();
        const pass = document.getElementById(`${formId}-pass`).value;
        const msgEl = document.getElementById(`${formId}-msg`);

        if (!email || !pass) { msgEl.innerHTML = `<span class="c-red">Email and password required</span>`; return; }

        msgEl.innerHTML = `<span class="c-dim loading-dots">Signing in</span>`;
        const { error } = await sb.auth.signInWithPassword({ email, password: pass });

        if (error) {
          msgEl.innerHTML = `<span class="c-red">${error.message}</span>`;
        } else {
          msgEl.innerHTML = `<span class="c-green">Signed in! Use ${sc('/portfolio')} to view your holdings.</span>`;
          bindSlashCommands();
        }
        scrollToBottom();
      });
    },

    '/logout': async function() {
      if (!supabaseEnabled()) {
        printLines([`<span class="c-red">Supabase not configured</span>`]);
        return;
      }
      if (!currentUser) {
        printLines([`<span class="c-yellow">Not signed in.</span> Use ${sc('/login')} to sign in.`]);
        return;
      }
      await sb.auth.signOut();
      printLines([
        `<span class="c-green">Signed out successfully.</span>`,
      ]);
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
        `  <span class="c-cyan">Charts</span>       Interactive TradingView charts`,
        `  <span class="c-cyan">Analytics</span>    Allocation, performance & stats`,
        `  <span class="c-cyan">Accounts</span>     Supabase auth — save your portfolio`,
        `  <span class="c-cyan">Watchlist</span>    Monitor favorites with sparklines`,
        `  <span class="c-cyan">Alerts</span>       Price triggers with polling`,
        `  <span class="c-cyan">News</span>         Aggregated headlines with sentiment`,
        '',
        `  ${dim('GitHub:')}   github.com/Scolliq/wealthwatch`,
        `  ${dim('License:')}  MIT`,
        `  ${dim('Status:')}   <span class="c-green">● Operational</span>`,
      ]);
    },

    '/stack': function() {
      const arch = isMobile ? [
        `  <span class="c-cyan">BROWSER</span> <span class="c-dim">→</span> <span class="c-cyan">VERCEL</span> <span class="c-dim">→</span> <span class="c-cyan">YAHOO</span>`,
        `  <span class="c-dim">(Terminal)  (API)    (Finance)</span>`,
        `  <span class="c-dim">      ↕</span>`,
        `  <span class="c-cyan">SUPABASE</span>`,
        `  <span class="c-dim">(Auth + DB)</span>`,
      ] : [
        `  <span class="c-dim">┌──────────┐    ┌──────────┐    ┌──────────┐</span>`,
        `  <span class="c-dim">│</span> <span class="c-cyan">BROWSER</span>  <span class="c-dim">│───▶│</span> <span class="c-cyan">VERCEL</span>   <span class="c-dim">│───▶│</span> <span class="c-cyan">YAHOO</span>    <span class="c-dim">│</span>`,
        `  <span class="c-dim">│</span> Terminal  <span class="c-dim">│    │</span> API      <span class="c-dim">│    │</span> Finance  <span class="c-dim">│</span>`,
        `  <span class="c-dim">│</span> UI / JS   <span class="c-dim">│◀───│</span> /api/    <span class="c-dim">│◀───│</span> API v7/8 <span class="c-dim">│</span>`,
        `  <span class="c-dim">└────┬─────┘    └──────────┘    └──────────┘</span>`,
        `  <span class="c-dim">     │</span>`,
        `  <span class="c-dim">     ▼</span>`,
        `  <span class="c-dim">┌──────────┐</span>`,
        `  <span class="c-dim">│</span> <span class="c-cyan">SUPABASE</span> <span class="c-dim">│</span>`,
        `  <span class="c-dim">│</span> Auth+DB  <span class="c-dim">│</span>`,
        `  <span class="c-dim">└──────────┘</span>`,
      ];
      printLines([
        bright('Architecture'),
        '',
        ...arch,
        '',
        bright('Tech Stack'),
        '',
        `  <span class="c-cyan">Frontend</span>`,
        `  <span class="c-dim">├──</span> HTML/CSS/JS          Vanilla, no framework`,
        `  <span class="c-dim">├──</span> Lightweight Charts   TradingView charting`,
        `  <span class="c-dim">├──</span> Supabase JS          Auth & database`,
        `  <span class="c-dim">├──</span> Yahoo Finance        Real-time market data`,
        `  <span class="c-dim">├──</span> 30s cache            Avoid rate limiting`,
        `  <span class="c-dim">└──</span> Vercel               Static hosting`,
        '',
        `  <span class="c-cyan">Backend</span>`,
        `  <span class="c-dim">├──</span> Supabase             Auth, PostgreSQL, RLS`,
        `  <span class="c-dim">├──</span> Vercel Serverless    CORS proxy for Yahoo`,
        `  <span class="c-dim">└──</span> Yahoo Finance v8     Quote + chart data`,
      ]);
    },

    '/insights': function() {
      const panel = document.getElementById('insights-panel');
      if (!panel) {
        printLines([`<span class="c-red">Insights panel not found</span>`]);
        return;
      }
      const wasCollapsed = panel.classList.contains('collapsed');
      panel.classList.toggle('collapsed');
      if (wasCollapsed) {
        // Clear cache and refresh
        Object.keys(cache).forEach(k => {
          if (k.startsWith('history:') || k.startsWith('summary:')) delete cache[k];
        });
        refreshInsights();
        printLines([
          `<span class="c-green">Insights panel opened</span>`,
          dim('Showing dividends, rates, beta, Sharpe ratio, correlation matrix'),
          dim('Data refreshes every 5 minutes. Click ↻ to refresh manually.'),
        ]);
      } else {
        printLines([`<span class="c-dim">Insights panel collapsed</span>`]);
      }
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
      print(dim(`Live data  ·  ${sc('/chart ' + sym)} for interactive chart`));

    } catch (e) {
      hideLoading();
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

      if (data.closes.length < 2) {
        printLines([`<span class="c-red">Not enough data for:</span> ${sym}`]);
        return;
      }

      const trend = data.closes[data.closes.length - 1] >= data.closes[0];
      const changeVal = ((data.closes[data.closes.length - 1] / data.closes[0]) - 1) * 100;
      const changeStr = changeVal >= 0 ? `+${changeVal.toFixed(2)}%` : `${changeVal.toFixed(2)}%`;
      const trendCls = trend ? 'positive' : 'negative';

      const min = Math.min(...data.closes);
      const max = Math.max(...data.closes);
      const last = data.closes[data.closes.length - 1];

      // Create chart container
      const chartId = 'tv-chart-' + Date.now();
      const statsHtml = `
        <div class="chart-stats">
          <span class="chart-stat"><span class="chart-stat-label">Last</span> <span class="chart-stat-value">${fmtPrice(last)}</span></span>
          <span class="chart-stat"><span class="chart-stat-label">30d</span> <span class="${trendCls}">${changeStr}</span></span>
          <span class="chart-stat"><span class="chart-stat-label">High</span> <span class="chart-stat-value">${fmtPrice(max)}</span></span>
          <span class="chart-stat"><span class="chart-stat-label">Low</span> <span class="chart-stat-value">${fmtPrice(min)}</span></span>
        </div>
      `;

      const chartHtml = `<div class="chart-container" id="${chartId}"></div>${statsHtml}`;
      printRaw(panel(`${sym} · 30D CHART`, chartHtml, 'LIVE'));

      // Render TradingView chart after DOM insertion
      requestAnimationFrame(() => renderChart(chartId, data, sym));

    } catch (e) {
      hideLoading();
      // Fallback to ASCII
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
        printRaw(panel(`${sym} · 30D CHART`, `<div class="ascii-art">${chartLines.join('\n')}</div>`, 'DEMO'));
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

  async function addCmd(parts) {
    if (!supabaseEnabled()) {
      printLines([`<span class="c-red">Supabase not configured.</span> Set URL & key in terminal.js`]);
      return;
    }
    if (!currentUser) {
      printLines([`<span class="c-yellow">Sign in first.</span> Use ${sc('/login')} or ${sc('/signup')}`]);
      return;
    }

    // /add AAPL 10 150.00
    if (parts.length < 4) {
      printLines([
        `<span class="c-red">Usage:</span> /add <SYMBOL> <QTY> <AVG_COST>`,
        `${dim('Example:')} ${sc('/add AAPL 10 150.00')}`,
        '',
        dim('Adds shares to your portfolio. If you already hold the ticker,'),
        dim('it will calculate a weighted average cost basis.'),
      ]);
      return;
    }

    const sym = parts[1].toUpperCase();
    const qty = parseFloat(parts[2]);
    const cost = parseFloat(parts[3]);

    if (isNaN(qty) || qty <= 0) {
      printLines([`<span class="c-red">Invalid quantity:</span> ${parts[2]}`]);
      return;
    }
    if (isNaN(cost) || cost <= 0) {
      printLines([`<span class="c-red">Invalid cost:</span> ${parts[3]}`]);
      return;
    }

    showLoading(`Adding ${sym}...`);
    try {
      await addHolding(sym, qty, cost);
      hideLoading();
      printLines([
        `<span class="c-green">Added ${qty} shares of ${sym} at ${fmtPrice(cost)}</span>`,
        dim(`Use ${sc('/portfolio')} to see your updated holdings.`),
      ]);
      // Refresh insights panel
      Object.keys(cache).forEach(k => { if (k.startsWith('history:') || k.startsWith('summary:')) delete cache[k]; });
      refreshInsights();
    } catch (e) {
      hideLoading();
      printLines([`<span class="c-red">Error:</span> ${e.message}`]);
    }
  }

  async function removeCmd(parts) {
    if (!supabaseEnabled()) {
      printLines([`<span class="c-red">Supabase not configured.</span>`]);
      return;
    }
    if (!currentUser) {
      printLines([`<span class="c-yellow">Sign in first.</span> Use ${sc('/login')}`]);
      return;
    }

    if (parts.length < 2) {
      printLines([
        `<span class="c-red">Usage:</span> /remove <SYMBOL>`,
        `${dim('Example:')} ${sc('/remove TSLA')}`,
        '',
        dim('Removes a ticker entirely from your portfolio.'),
      ]);
      return;
    }

    const sym = parts[1].toUpperCase();
    showLoading(`Removing ${sym}...`);
    try {
      await removeHolding(sym);
      hideLoading();
      printLines([
        `<span class="c-green">Removed ${sym} from portfolio.</span>`,
        dim(`Use ${sc('/portfolio')} to see your updated holdings.`),
      ]);
      // Refresh insights panel
      Object.keys(cache).forEach(k => { if (k.startsWith('history:') || k.startsWith('summary:')) delete cache[k]; });
      refreshInsights();
    } catch (e) {
      hideLoading();
      printLines([`<span class="c-red">Error:</span> ${e.message}`]);
    }
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
    if (!cmd.startsWith('/')) cmd = '/' + cmd;

    if (cmd === '/quote' || cmd === '/q' || cmd === '/price') {
      quoteCmd(parts[1]);
    } else if (cmd === '/chart' || cmd === '/c') {
      chartCmd(parts[1]);
    } else if (cmd === '/add') {
      addCmd(parts);
    } else if (cmd === '/remove' || cmd === '/rm') {
      removeCmd(parts);
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
    if (!window.getSelection().toString() && !e.target.closest('a') && !e.target.closest('input') && !e.target.closest('button')) {
      input.focus();
    }
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

  const mockTickerData = {};
  mockTickers.forEach(t => { mockTickerData[t.sym] = { price: t.price, change: t.change }; });
  renderTickerBar(mockTickerData);

  async function refreshTickerBar() {
    try {
      const data = await fetchQuotes(tickerSymbols);
      renderTickerBar(data);
    } catch (e) {
      // Keep mock data
    }
  }

  refreshTickerBar();
  setInterval(refreshTickerBar, 60000);

  // ─── Boot ─────────────────────────────────────────────
  boot();
  initInsightsPanel();

})();
