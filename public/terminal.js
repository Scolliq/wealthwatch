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
  const API_OPTIONS = '/api/options';
  const cache = {};
  const CACHE_TTL = 5000; // 5 seconds for live feel

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
    const meta = result.meta;

    const candles = [];
    const lineData = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (closes[i] == null) continue;
      const time = timestamps[i];
      candles.push({ time, open: opens[i] || closes[i], high: highs[i] || closes[i], low: lows[i] || closes[i], close: closes[i] });
      lineData.push({ time, value: closes[i] });
    }

    const data = { candles, lineData, closes: closes.filter(v => v != null), name: meta.shortName || symbol, price: meta.regularMarketPrice };
    setCache(key, data);
    return data;
  }

  async function fetchOptionsData(symbol) {
    const key = 'options:' + symbol;
    const cached = getCached(key);
    if (cached) return cached;
    const res = await fetch(`${API_OPTIONS}?symbol=${symbol}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
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

  // ─── Mock data ──────────────────────────────────────────

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

  const ASSET_TYPES = {
    equity:    { label: 'Equities',    icon: '◆' },
    etf:       { label: 'ETFs',        icon: '◇' },
    bond:      { label: 'Bonds',       icon: '▬' },
    commodity: { label: 'Commodities', icon: '●' },
    crypto:    { label: 'Crypto',      icon: '₿' },
  };

  // Auto-detect asset type from symbol
  function detectAssetType(sym) {
    if (sym.endsWith('-USD') || ['BTC', 'ETH', 'SOL', 'ADA', 'DOT', 'DOGE', 'XRP'].some(c => sym.startsWith(c))) return 'crypto';
    if (['GC=F', 'SI=F', 'CL=F', 'NG=F', 'HG=F', 'PL=F', 'PA=F', 'GLD', 'SLV', 'USO'].includes(sym)) return 'commodity';
    if (['SPY', 'QQQ', 'QQQM', 'IWM', 'DIA', 'VTI', 'VOO', 'VEA', 'VWO', 'BND', 'AGG', 'TLT', 'IEF', 'LQD', 'HYG', 'ARKK', 'XLF', 'XLE', 'XLK', 'VIG', 'SCHD', 'JEPI', 'JEPQ', 'SQQQ', 'TQQQ', 'GDX', 'SLV', 'GLD'].includes(sym)) return 'etf';
    if (['TLT', 'IEF', 'SHY', 'BND', 'AGG', 'LQD', 'HYG', 'VCSH', 'VCIT', 'VCLT'].includes(sym)) return 'bond';
    return 'equity';
  }

  const indexSymbols = { '^GSPC': 'S&P 500', '^DJI': 'DOW 30', '^IXIC': 'NASDAQ', '^RUT': 'RUSSELL 2K', '^VIX': 'VIX' };
  const cryptoSymbols = ['BTC-USD', 'ETH-USD', 'SOL-USD'];
  const watchlistSymbols = ['MSFT', 'GOOGL', 'AMZN', 'META', 'AMD'];

  const ALLOC_COLORS = ['#5f87ff', '#5faf5f', '#d7af5f', '#d75f5f', '#af5faf', '#5fafaf', '#ff875f', '#87afd7', '#d787af', '#afd75f'];

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

  function panel(title, content, badge) {
    const b = badge ? `<span class="tui-badge">${badge}</span>` : '';
    return `<div class="tui-panel"><div class="tui-panel-title">${title}${b}</div><div class="tui-panel-body">${content}</div></div>`;
  }

  function table(headers, rows, footerRow) {
    let h = '<tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr>';
    let r = rows.map(row => '<tr>' + row.map(cell => `<td>${cell}</td>`).join('') + '</tr>').join('');
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

  function fmtPL(val) {
    const abs = Math.abs(val).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    return val >= 0 ? pos(`+$${abs}`) : neg(`-$${abs}`);
  }

  function fmtPLPct(pct) {
    return pct >= 0 ? pos(`+${pct.toFixed(1)}%`) : neg(`${pct.toFixed(1)}%`);
  }

  // ─── TradingView Chart ──────────────────────────────────

  function renderChart(containerId, chartData) {
    const container = document.getElementById(containerId);
    if (!container || typeof LightweightCharts === 'undefined') return;

    const chart = LightweightCharts.createChart(container, {
      layout: { background: { color: '#111111' }, textColor: '#555', fontFamily: "'JetBrains Mono', monospace", fontSize: 11 },
      grid: { vertLines: { color: '#1a1a1a' }, horzLines: { color: '#1a1a1a' } },
      crosshair: { mode: LightweightCharts.CrosshairMode.Normal, vertLine: { color: '#5f87ff44', width: 1, style: 2 }, horzLine: { color: '#5f87ff44', width: 1, style: 2 } },
      rightPriceScale: { borderColor: '#2a2a2a' },
      timeScale: { borderColor: '#2a2a2a', timeVisible: false },
      handleScroll: { vertTouchDrag: false },
    });

    const trend = chartData.closes[chartData.closes.length - 1] >= chartData.closes[0];
    const color = trend ? '#5faf5f' : '#d75f5f';

    const areaSeries = chart.addAreaSeries({
      topColor: trend ? 'rgba(95,175,95,0.3)' : 'rgba(215,95,95,0.3)',
      bottomColor: trend ? 'rgba(95,175,95,0.02)' : 'rgba(215,95,95,0.02)',
      lineColor: color, lineWidth: 2,
      crosshairMarkerBackgroundColor: color, crosshairMarkerBorderColor: '#fff',
    });

    areaSeries.setData(chartData.lineData);
    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => { chart.applyOptions({ width: container.clientWidth }); });
    ro.observe(container);
  }

  // ─── Monte Carlo & OI Canvas ─────────────────────────

  function boxMullerRandom() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  function runMonteCarlo(closes, startValue, nPaths, nDays) {
    const returns = [];
    for (let i = 1; i < closes.length; i++) {
      returns.push(Math.log(closes[i] / closes[i - 1]));
    }
    const mu = returns.reduce((s, r) => s + r, 0) / returns.length;
    const variance = returns.reduce((s, r) => s + (r - mu) ** 2, 0) / returns.length;
    const sigma = Math.sqrt(variance);
    const drift = mu - 0.5 * sigma ** 2;

    const paths = [];
    for (let p = 0; p < nPaths; p++) {
      const path = [startValue];
      for (let d = 0; d < nDays; d++) {
        const prev = path[path.length - 1];
        path.push(prev * Math.exp(drift + sigma * boxMullerRandom()));
      }
      paths.push(path);
    }
    return { paths, mu, sigma, annualVol: sigma * Math.sqrt(252) };
  }

  function drawMonteCarloCanvas(canvasId, paths, startValue) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const W = canvas.offsetWidth || 580;
    canvas.width = W;
    const H = canvas.height;
    const ctx = canvas.getContext('2d');
    const nDays = paths[0].length - 1;
    const pad = { top: 14, right: 6, bottom: 22, left: 52 };
    const cw = W - pad.left - pad.right;
    const ch = H - pad.top - pad.bottom;

    let minVal = Infinity, maxVal = -Infinity;
    paths.forEach(path => path.forEach(v => { minVal = Math.min(minVal, v); maxVal = Math.max(maxVal, v); }));
    const margin = (maxVal - minVal) * 0.08;
    minVal -= margin; maxVal += margin;

    const tx = d => pad.left + (d / nDays) * cw;
    const ty = v => pad.top + ch - ((v - minVal) / (maxVal - minVal)) * ch;

    ctx.fillStyle = '#111'; ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = '#1c1c1c'; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + ch * i / 4;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
      const val = maxVal - (maxVal - minVal) * i / 4;
      ctx.fillStyle = '#444'; ctx.font = '9px JetBrains Mono, monospace';
      ctx.fillText(fmtPrice(val), 2, y + 3);
    }

    // Paths
    paths.forEach(path => {
      ctx.strokeStyle = 'rgba(95,135,255,0.12)'; ctx.lineWidth = 1;
      ctx.beginPath();
      path.forEach((v, d) => { d === 0 ? ctx.moveTo(tx(d), ty(v)) : ctx.lineTo(tx(d), ty(v)); });
      ctx.stroke();
    });

    // Compute percentiles per day
    const pctByDay = Array.from({ length: nDays + 1 }, (_, d) => {
      const vals = paths.map(p => p[d]).sort((a, b) => a - b);
      const p = f => vals[Math.max(0, Math.floor(vals.length * f))];
      return { p10: p(0.10), p25: p(0.25), p50: p(0.50), p75: p(0.75), p90: p(0.90) };
    });

    // Shaded band p25-p75
    ctx.fillStyle = 'rgba(95,135,255,0.07)';
    ctx.beginPath();
    pctByDay.forEach((p, d) => { d === 0 ? ctx.moveTo(tx(d), ty(p.p75)) : ctx.lineTo(tx(d), ty(p.p75)); });
    for (let d = nDays; d >= 0; d--) ctx.lineTo(tx(d), ty(pctByDay[d].p25));
    ctx.closePath(); ctx.fill();

    // P90 dashed
    ctx.strokeStyle = 'rgba(95,175,95,0.6)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
    ctx.beginPath();
    pctByDay.forEach((p, d) => { d === 0 ? ctx.moveTo(tx(d), ty(p.p90)) : ctx.lineTo(tx(d), ty(p.p90)); });
    ctx.stroke();

    // P10 dashed
    ctx.strokeStyle = 'rgba(215,95,95,0.6)';
    ctx.beginPath();
    pctByDay.forEach((p, d) => { d === 0 ? ctx.moveTo(tx(d), ty(p.p10)) : ctx.lineTo(tx(d), ty(p.p10)); });
    ctx.stroke();
    ctx.setLineDash([]);

    // Median solid
    ctx.strokeStyle = '#5faf5f'; ctx.lineWidth = 2;
    ctx.beginPath();
    pctByDay.forEach((p, d) => { d === 0 ? ctx.moveTo(tx(d), ty(p.p50)) : ctx.lineTo(tx(d), ty(p.p50)); });
    ctx.stroke();

    // Start value line
    ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.setLineDash([3, 5]);
    ctx.beginPath(); ctx.moveTo(pad.left, ty(startValue)); ctx.lineTo(W - pad.right, ty(startValue)); ctx.stroke();
    ctx.setLineDash([]);

    // X-axis labels
    ctx.fillStyle = '#444'; ctx.font = '9px JetBrains Mono, monospace';
    ctx.fillText('Today', pad.left, H - 6);
    const mid = Math.floor(nDays / 2);
    ctx.fillText(`+${mid}d`, tx(mid) - 10, H - 6);
    ctx.fillText(`+${nDays}d`, tx(nDays) - 14, H - 6);

    // End labels
    const last = pctByDay[nDays];
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.fillStyle = '#5faf5f'; ctx.fillText(fmtPrice(last.p90), tx(nDays) + 2, ty(last.p90) + 3);
    ctx.fillStyle = '#aaa';    ctx.fillText(fmtPrice(last.p50), tx(nDays) + 2, ty(last.p50) + 3);
    ctx.fillStyle = '#d75f5f'; ctx.fillText(fmtPrice(last.p10), tx(nDays) + 2, ty(last.p10) + 3);
  }

  function drawOICanvas(canvasId, callDist, putDist, currentPrice) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const W = canvas.offsetWidth || 580;
    canvas.width = W;
    const H = canvas.height;
    const ctx = canvas.getContext('2d');

    // Merge strikes
    const strikeSet = new Set([...callDist.map(c => c.strike), ...putDist.map(p => p.strike)]);
    const strikes = [...strikeSet].sort((a, b) => a - b);
    if (strikes.length === 0) return;

    const callMap = Object.fromEntries(callDist.map(c => [c.strike, c.oi]));
    const putMap = Object.fromEntries(putDist.map(p => [p.strike, p.oi]));
    const maxOI = Math.max(...strikes.map(s => Math.max(callMap[s] || 0, putMap[s] || 0)), 1);

    const pad = { top: 10, right: 4, bottom: 20, left: 44 };
    const cw = W - pad.left - pad.right;
    const ch = H - pad.top - pad.bottom;
    const bw = cw / strikes.length;

    ctx.fillStyle = '#111'; ctx.fillRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = '#1c1c1c'; ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      const y = pad.top + ch * i / 4;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
    }

    // OI scale label
    ctx.fillStyle = '#444'; ctx.font = '9px JetBrains Mono, monospace';
    const topLabel = maxOI >= 1e6 ? (maxOI / 1e6).toFixed(1) + 'M' : maxOI >= 1e3 ? (maxOI / 1e3).toFixed(0) + 'K' : String(maxOI);
    ctx.fillText(topLabel, 2, pad.top + 8);

    // Bars
    strikes.forEach((strike, i) => {
      const callOI = callMap[strike] || 0;
      const putOI = putMap[strike] || 0;
      const x = pad.left + i * bw;
      const halfBw = bw * 0.46;

      if (callOI > 0) {
        const h = (callOI / maxOI) * ch;
        ctx.fillStyle = 'rgba(95,175,95,0.75)';
        ctx.fillRect(x + bw * 0.02, pad.top + ch - h, halfBw, h);
      }
      if (putOI > 0) {
        const h = (putOI / maxOI) * ch;
        ctx.fillStyle = 'rgba(215,95,95,0.75)';
        ctx.fillRect(x + bw * 0.52, pad.top + ch - h, halfBw, h);
      }
    });

    // Current price marker
    const priceIdx = strikes.findIndex(s => s >= currentPrice);
    if (priceIdx >= 0) {
      const x = pad.left + priceIdx * bw;
      ctx.strokeStyle = '#5f87ff'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, pad.top + ch); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#5f87ff'; ctx.font = '9px JetBrains Mono, monospace';
      ctx.fillText(fmtPrice(currentPrice), x + 2, pad.top + 9);
    }

    // Strike labels (show ~5 evenly spaced)
    const labelStep = Math.max(1, Math.floor(strikes.length / 5));
    ctx.fillStyle = '#444'; ctx.font = '9px JetBrains Mono, monospace';
    strikes.forEach((s, i) => {
      if (i % labelStep !== 0) return;
      const x = pad.left + i * bw + bw * 0.1;
      ctx.fillText(s >= 1000 ? (s / 1000).toFixed(1) + 'k' : String(s), x, H - 5);
    });

    // Legend
    ctx.fillStyle = 'rgba(95,175,95,0.75)'; ctx.fillRect(W - 80, 2, 8, 8);
    ctx.fillStyle = '#888'; ctx.font = '9px JetBrains Mono, monospace'; ctx.fillText('Calls', W - 70, 10);
    ctx.fillStyle = 'rgba(215,95,95,0.75)'; ctx.fillRect(W - 36, 2, 8, 8);
    ctx.fillStyle = '#888'; ctx.fillText('Puts', W - 26, 10);
  }

  // ─── Supabase DB helpers ──────────────────────────────

  async function getHoldings() {
    if (!sb || !currentUser) return null;
    const { data, error } = await sb.from('holdings').select('*').order('asset_type').order('added_at');
    if (error) throw error;
    return data;
  }

  async function addHolding(symbol, qty, avgCost, assetType, purchaseDate, notes) {
    if (!sb || !currentUser) throw new Error('Not logged in');

    // Check if holding exists — if so, weighted average
    const { data: existing } = await sb.from('holdings').select('*').eq('user_id', currentUser.id).eq('symbol', symbol).single();

    if (existing) {
      const totalQty = existing.qty + qty;
      const newAvg = ((existing.avg_cost * existing.qty) + (avgCost * qty)) / totalQty;
      const { error } = await sb.from('holdings').update({ qty: totalQty, avg_cost: newAvg, updated_at: new Date().toISOString() }).eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await sb.from('holdings').insert({
        user_id: currentUser.id, symbol, qty, avg_cost: avgCost,
        asset_type: assetType, purchase_date: purchaseDate || null, notes: notes || null,
      });
      if (error) throw error;
    }

    // Log transaction
    await sb.from('transactions').insert({
      user_id: currentUser.id, symbol, asset_type: assetType,
      action: 'buy', qty, price: avgCost, notes: notes || null,
    });
  }

  async function sellHolding(symbol, qty, price) {
    if (!sb || !currentUser) throw new Error('Not logged in');

    const { data: existing } = await sb.from('holdings').select('*').eq('user_id', currentUser.id).eq('symbol', symbol).single();
    if (!existing) throw new Error(`You don't hold ${symbol}`);
    if (qty > existing.qty) throw new Error(`You only hold ${existing.qty} shares of ${symbol}`);

    if (qty === existing.qty) {
      // Sell all — remove holding
      const { error } = await sb.from('holdings').delete().eq('id', existing.id);
      if (error) throw error;
    } else {
      // Partial sell — reduce qty, keep avg cost
      const { error } = await sb.from('holdings').update({ qty: existing.qty - qty, updated_at: new Date().toISOString() }).eq('id', existing.id);
      if (error) throw error;
    }

    // Log transaction
    await sb.from('transactions').insert({
      user_id: currentUser.id, symbol, asset_type: existing.asset_type,
      action: 'sell', qty, price,
    });
  }

  async function removeHolding(symbol) {
    if (!sb || !currentUser) throw new Error('Not logged in');
    const { error } = await sb.from('holdings').delete().eq('user_id', currentUser.id).eq('symbol', symbol);
    if (error) throw error;
  }

  async function getTransactions(limit) {
    if (!sb || !currentUser) return [];
    const { data, error } = await sb.from('transactions').select('*').order('executed_at', { ascending: false }).limit(limit || 20);
    if (error) throw error;
    return data || [];
  }

  async function getWatchlist() {
    if (!sb || !currentUser) return null;
    const { data, error } = await sb.from('watchlist').select('*').eq('user_id', currentUser.id).order('added_at');
    if (error) throw error;
    return data || [];
  }

  async function addToWatchlist(symbol, price) {
    if (!sb || !currentUser) throw new Error('Not logged in');
    const assetType = detectAssetType(symbol);
    const { error } = await sb.from('watchlist').insert({
      user_id: currentUser.id, symbol, asset_type: assetType, added_price: price,
    });
    if (error) throw error;
  }

  async function removeFromWatchlist(symbol) {
    if (!sb || !currentUser) throw new Error('Not logged in');
    const { error } = await sb.from('watchlist').delete().eq('user_id', currentUser.id).eq('symbol', symbol);
    if (error) throw error;
  }

  // ─── Live Price Poller (5s) ──────────────────────────

  let livePortfolioSymbols = [];
  let livePriceData = {};
  let livePriceEl = null;
  let livePriceInterval = null;

  function startLivePrices(symbols, renderFn) {
    stopLivePrices();
    livePortfolioSymbols = symbols;
    livePriceInterval = setInterval(async () => {
      try {
        // Force bypass cache for live updates
        const key = 'quotes:' + symbols.join(',');
        delete cache[key];
        const data = await fetchQuotes(symbols);
        livePriceData = data;
        if (renderFn) renderFn(data);
      } catch (e) { /* silent */ }
    }, 5000);
  }

  function stopLivePrices() {
    if (livePriceInterval) { clearInterval(livePriceInterval); livePriceInterval = null; }
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

    print(`<span class="c-bright">  Market:</span>`);
    print(`    ${sc('/market')}        ${dim('Market overview & indices')}`);
    print(`    ${sc('/quote')} ${dim('<SYM>')}   ${dim('Real-time stock quote')}`);
    print(`    ${sc('/chart')} ${dim('<SYM>')}   ${dim('Interactive price chart (30d)')}`);
    print(`    ${sc('/watchlist')}     ${dim('Watchlist with P/L since added')}`);
    print(`    ${sc('/watch')} ${dim('<SYM>')}   ${dim('Add ticker to watchlist (saves price)')}`);
    print(`    ${sc('/unwatch')} ${dim('<SYM>')} ${dim('Remove ticker from watchlist')}`);
    print(`    ${sc('/news')}          ${dim('Financial headlines')}`);
    printBlank();

    print(`<span class="c-bright">  Portfolio:</span>`);
    print(`    ${sc('/portfolio')}     ${dim('Holdings with live prices (5s refresh)')}`);
    print(`    ${sc('/analytics')}     ${dim('Allocation, performance, OI flow & charts')}`);
    print(`    ${sc('/montecarlo')}    ${dim('Monte Carlo simulation (100 paths, 60 days)')}`);
    print(`    ${sc('/history')}       ${dim('Transaction history')}`);
    print(`    ${sc('/add')} ${dim('<SYM> <QTY> <COST>')}  ${dim('Buy / add holding')}`);
    print(`    ${sc('/sell')} ${dim('<SYM> <QTY> <PRICE>')} ${dim('Sell holding')}`);
    print(`    ${sc('/remove')} ${dim('<SYM>')}             ${dim('Remove holding entirely')}`);
    printBlank();

    print(`<span class="c-bright">  Account:</span>`);
    print(`    ${sc('/signup')}        ${dim('Create account')}`);
    print(`    ${sc('/login')}         ${dim('Sign in')}`);
    print(`    ${sc('/logout')}        ${dim('Sign out')}`);
    printBlank();

    print(`    ${sc('/about')}  ${sc('/stack')}  ${sc('/help')}  ${sc('/clear')}`);
    printBlank();
    print(`  ${dim('Click any command or type below. Prices update every 5 seconds.')}`);
    printBlank();
    bindSlashCommands();
    scrollToBottom();
  }

  // ─── Commands ─────────────────────────────────────────

  const commands = {

    '/help': function() {
      printLines([
        bright('Market'),
        `  ${sc('/market')}                  ${dim('Live indices & crypto')}`,
        `  ${sc('/quote')} ${dim('<ticker>')}          ${dim('Real-time quote')}`,
        `  ${sc('/chart')} ${dim('<ticker>')}          ${dim('Interactive 30d chart')}`,
        `  ${sc('/watchlist')}               ${dim('Watchlist with P/L since added')}`,
        `  ${sc('/watch')} ${dim('<ticker>')}           ${dim('Add to watchlist (saves price)')}`,
        `  ${sc('/unwatch')} ${dim('<ticker>')}         ${dim('Remove from watchlist')}`,
        `  ${sc('/alerts')}                  ${dim('Price alerts')}`,
        `  ${sc('/news')}                    ${dim('Headlines')}`,
        '',
        bright('Portfolio'),
        `  ${sc('/portfolio')}               ${dim('Holdings with live 5s prices')}`,
        `  ${sc('/analytics')}               ${dim('Allocation, OI flow & options charts')}`,
        `  ${sc('/montecarlo')}              ${dim('Monte Carlo simulation (100 paths)')}`,
        `  ${sc('/history')}                 ${dim('Transaction log')}`,
        `  ${sc('/add')} ${dim('<SYM> <QTY> <COST>')}   ${dim('Buy shares (auto-detects type)')}`,
        `  ${sc('/sell')} ${dim('<SYM> <QTY> <PRICE>')}  ${dim('Sell shares')}`,
        `  ${sc('/remove')} ${dim('<SYM>')}              ${dim('Remove entire position')}`,
        '',
        bright('Account'),
        `  ${sc('/signup')}                  ${dim('Create account')}`,
        `  ${sc('/login')}                   ${dim('Sign in')}`,
        `  ${sc('/logout')}                  ${dim('Sign out')}`,
        '',
        `  ${sc('/about')}  ${sc('/stack')}  ${sc('/clear')}`,
        '',
        dim('Asset types: equity, etf, bond, commodity, crypto (auto-detected)'),
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
        const indices = [['S&P 500','$5,842.31',1.24],['DOW 30','$43,890.12',0.87],['NASDAQ','$18,563.77',1.67],['RUSSELL 2K','$2,198.45',-0.32],['VIX','$14.82',-2.10]];
        const crypto = [['BTC/USD','$67,843',2.31],['ETH/USD','$3,521',1.87],['SOL/USD','$142.55',4.12]];
        const mkRows = (d) => d.map(([n, p, c]) => [tn(n), `<span class="price">${p}</span>`, fmtChange(c)]);
        printRaw(panel('Indices', table(['Index', 'Price', 'Change'], mkRows(indices)), 'DEMO'));
        printRaw(panel('Crypto', table(['Asset', 'Price', 'Change'], mkRows(crypto)), 'DEMO'));
      }
      printBlank();
      print(dim(`Source: ${usedLive ? 'Yahoo Finance' : 'demo data'}  ·  ${sc('/quote')} <ticker> for details`));
      printBlank();
      bindSlashCommands();
      scrollToBottom();
    },

    '/portfolio': async function() {
      stopLivePrices(); // Stop any previous poller
      showLoading('Fetching portfolio...');

      let holdings;
      let isUserPortfolio = false;

      if (sb && currentUser) {
        try {
          const dbHoldings = await getHoldings();
          if (dbHoldings && dbHoldings.length > 0) {
            holdings = dbHoldings.map(h => ({
              sym: h.symbol, qty: Number(h.qty), avgCost: Number(h.avg_cost),
              type: h.asset_type, date: h.purchase_date, notes: h.notes,
            }));
            isUserPortfolio = true;
          }
        } catch (e) { /* fall through */ }
      }

      if (!holdings) {
        holdings = [
          { sym: 'AAPL', qty: 50, avgCost: 171.20, type: 'equity' },
          { sym: 'NVDA', qty: 25, avgCost: 480.50, type: 'equity' },
          { sym: 'TSLA', qty: 10, avgCost: 248.90, type: 'equity' },
          { sym: 'BTC-USD', qty: 0.5, avgCost: 42100, type: 'crypto' },
          { sym: 'GLD', qty: 20, avgCost: 185.00, type: 'commodity' },
          { sym: 'SPY', qty: 30, avgCost: 440.00, type: 'etf' },
        ];
      }

      const allSyms = holdings.map(h => h.sym);
      const liveContainerId = 'live-portfolio-' + Date.now();

      function renderPortfolioTable(data) {
        const el = document.getElementById(liveContainerId);
        if (!el) { stopLivePrices(); return; }

        // Group by asset type
        const groups = {};
        let totalValue = 0, totalPL = 0, totalCost = 0;

        holdings.forEach(h => {
          const q = data[h.sym];
          const price = q ? q.price : mockData[h.sym]?.price || 0;
          const change = q ? q.change : mockData[h.sym]?.change || 0;
          const value = price * h.qty;
          const pl = (price - h.avgCost) * h.qty;
          const plPct = ((price / h.avgCost) - 1) * 100;
          totalValue += value;
          totalPL += pl;
          totalCost += h.avgCost * h.qty;

          if (!groups[h.type]) groups[h.type] = [];
          groups[h.type].push({
            sym: h.sym, qty: h.qty, avgCost: h.avgCost,
            price, change, value, pl, plPct,
          });
        });

        let html = '';

        // Render each asset type group
        Object.entries(ASSET_TYPES).forEach(([type, meta]) => {
          const items = groups[type];
          if (!items || items.length === 0) return;

          const groupValue = items.reduce((s, i) => s + i.value, 0);
          const groupPL = items.reduce((s, i) => s + i.pl, 0);

          const rows = items.map(i => [
            tn(i.sym),
            String(i.qty),
            fmtPrice(i.avgCost),
            `<span class="price">${fmtPrice(i.price)}</span>`,
            fmtChange(i.change),
            fmtPL(i.pl),
            fmtPLPct(i.plPct),
          ]);

          const footer = ['', '', '', `<strong>${fmtPrice(groupValue)}</strong>`, '', `<strong>${fmtPL(groupPL)}</strong>`, ''];
          html += panel(`${meta.icon} ${meta.label}`, table(['Ticker', 'Qty', 'Cost', 'Price', 'Day', 'P/L', '%'], rows, footer));
        });

        // Total summary bar
        const totalPLPct = totalCost > 0 ? ((totalPL / totalCost) * 100) : 0;
        html += `<div class="tui-panel" style="border-color:var(--accent)"><div class="tui-panel-body" style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;font-size:12px">`;
        html += `<span>${dim('Total Value')} <strong>${fmtPrice(totalValue)}</strong></span>`;
        html += `<span>${dim('Total P/L')} <strong>${fmtPL(totalPL)}</strong> (${fmtPLPct(totalPLPct)})</span>`;
        html += `<span>${dim('Positions')} <strong>${holdings.length}</strong></span>`;
        html += `<span class="c-dim" style="font-size:10px">↻ updating every 5s</span>`;
        html += `</div></div>`;

        el.innerHTML = html;
        bindSlashCommands();
      }

      try {
        const data = await fetchQuotes(allSyms);
        hideLoading();

        // Create live container
        printRaw(`<div id="${liveContainerId}"></div>`);
        renderPortfolioTable(data);

        // Start 5-second live polling
        startLivePrices(allSyms, renderPortfolioTable);

      } catch (e) {
        hideLoading();
        // Static fallback with mock data
        printRaw(`<div id="${liveContainerId}"></div>`);
        renderPortfolioTable({});
      }

      printBlank();
      if (!isUserPortfolio) {
        if (currentUser) {
          print(dim(`Demo portfolio. ${sc('/add')} AAPL 10 150 to add your own holdings.`));
        } else {
          print(dim(`Demo portfolio. ${sc('/signup')} to save your own.`));
        }
      }
      print(dim(`${sc('/analytics')} for deep stats  ·  ${sc('/chart')} <ticker> for charts  ·  ${sc('/history')} for trades`));
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
            holdings = dbHoldings.map(h => ({ sym: h.symbol, qty: Number(h.qty), avgCost: Number(h.avg_cost), type: h.asset_type }));
            isUserPortfolio = true;
          }
        } catch (e) {}
      }

      if (!holdings) {
        holdings = [
          { sym: 'AAPL', qty: 50, avgCost: 171.20, type: 'equity' },
          { sym: 'NVDA', qty: 25, avgCost: 480.50, type: 'equity' },
          { sym: 'TSLA', qty: 10, avgCost: 248.90, type: 'equity' },
          { sym: 'BTC-USD', qty: 0.5, avgCost: 42100, type: 'crypto' },
          { sym: 'GLD', qty: 20, avgCost: 185.00, type: 'commodity' },
          { sym: 'SPY', qty: 30, avgCost: 440.00, type: 'etf' },
        ];
      }

      try {
        const data = await fetchQuotes(holdings.map(h => h.sym));
        hideLoading();

        const positions = holdings.map(h => {
          const q = data[h.sym];
          const price = q ? q.price : mockData[h.sym]?.price || 0;
          const value = price * h.qty;
          const pl = (price - h.avgCost) * h.qty;
          const plPct = ((price / h.avgCost) - 1) * 100;
          const change = q ? q.change : 0;
          return { sym: h.sym, type: h.type, qty: h.qty, avgCost: h.avgCost, price, value, pl, plPct, dayChange: change };
        });

        const totalValue = positions.reduce((s, p) => s + p.value, 0);
        const totalPL = positions.reduce((s, p) => s + p.pl, 0);
        const totalCost = positions.reduce((s, p) => s + p.avgCost * p.qty, 0);
        const totalPLPct = totalCost > 0 ? ((totalPL / totalCost) * 100) : 0;
        const dayPL = positions.reduce((s, p) => s + (p.value * p.dayChange / 100), 0);

        // Summary
        const summaryRows = [
          ['Total Value', `<strong>${fmtPrice(totalValue)}</strong>`],
          ['Total P/L', `<strong>${fmtPL(totalPL)}</strong> (${fmtPLPct(totalPLPct)})`],
          ['Day P/L', `<strong>${fmtPL(dayPL)}</strong>`],
          ['Positions', String(positions.length)],
          ['Asset Types', [...new Set(positions.map(p => ASSET_TYPES[p.type]?.label || p.type))].join(', ')],
          ['Best Performer', positions.length ? `${tn(positions.reduce((a, b) => a.plPct > b.plPct ? a : b).sym)}` : '—'],
          ['Worst Performer', positions.length ? `${tn(positions.reduce((a, b) => a.plPct < b.plPct ? a : b).sym)}` : '—'],
        ];
        printRaw(panel('Portfolio Summary', table(['Metric', 'Value'], summaryRows), isUserPortfolio ? 'YOUR DATA' : 'DEMO'));

        // Allocation by position
        let allocHtml = '<div class="alloc-bar">';
        positions.forEach((p, i) => {
          const pct = totalValue > 0 ? (p.value / totalValue * 100) : 0;
          const color = ALLOC_COLORS[i % ALLOC_COLORS.length];
          allocHtml += `<div class="alloc-segment" style="width:${pct}%;background:${color}" title="${p.sym}: ${pct.toFixed(1)}%">${pct >= 8 ? p.sym : ''}</div>`;
        });
        allocHtml += '</div><div class="alloc-legend">';
        positions.forEach((p, i) => {
          const pct = totalValue > 0 ? (p.value / totalValue * 100) : 0;
          const color = ALLOC_COLORS[i % ALLOC_COLORS.length];
          allocHtml += `<span class="alloc-legend-item"><span class="alloc-swatch" style="background:${color}"></span>${p.sym} ${pct.toFixed(1)}%</span>`;
        });
        allocHtml += '</div>';
        printRaw(panel('Allocation by Position', allocHtml));

        // Allocation by asset type
        const typeGroups = {};
        positions.forEach(p => {
          if (!typeGroups[p.type]) typeGroups[p.type] = 0;
          typeGroups[p.type] += p.value;
        });
        let typeAllocHtml = '<div class="alloc-bar">';
        const typeColors = { equity: '#5f87ff', etf: '#5faf5f', bond: '#d7af5f', commodity: '#ff875f', crypto: '#af5faf' };
        Object.entries(typeGroups).forEach(([type, val]) => {
          const pct = totalValue > 0 ? (val / totalValue * 100) : 0;
          const color = typeColors[type] || '#555';
          const label = ASSET_TYPES[type]?.label || type;
          typeAllocHtml += `<div class="alloc-segment" style="width:${pct}%;background:${color}">${pct >= 12 ? label : ''}</div>`;
        });
        typeAllocHtml += '</div><div class="alloc-legend">';
        Object.entries(typeGroups).forEach(([type, val]) => {
          const pct = totalValue > 0 ? (val / totalValue * 100) : 0;
          const color = typeColors[type] || '#555';
          const label = ASSET_TYPES[type]?.label || type;
          typeAllocHtml += `<span class="alloc-legend-item"><span class="alloc-swatch" style="background:${color}"></span>${label} ${pct.toFixed(1)}% (${fmtPrice(val)})</span>`;
        });
        typeAllocHtml += '</div>';
        printRaw(panel('Allocation by Asset Type', typeAllocHtml));

        // Performance ranking
        const sorted = [...positions].sort((a, b) => b.plPct - a.plPct);
        const perfRows = sorted.map(p => [
          `${ASSET_TYPES[p.type]?.icon || '·'} ${tn(p.sym)}`,
          dim(ASSET_TYPES[p.type]?.label || p.type),
          fmtPrice(p.value),
          fmtPL(p.pl),
          fmtPLPct(p.plPct),
        ]);
        printRaw(panel('Performance Ranking', table(['Ticker', 'Type', 'Value', 'P/L', '%'], perfRows)));

        // ── Options Open Interest Section ─────────────────
        // Only fetch OI for equities and ETFs (not crypto/commodity futures)
        const optionableTypes = ['equity', 'etf'];
        const optionableHoldings = positions.filter(p => optionableTypes.includes(p.type));

        if (optionableHoldings.length > 0) {
          // Load previous snapshot from localStorage for 30d change tracking
          const OI_SNAP_KEY = 'ww_oi_snapshot';
          let prevSnap = null;
          try {
            const raw = localStorage.getItem(OI_SNAP_KEY);
            if (raw) {
              const parsed = JSON.parse(raw);
              // Only use snapshot if it's between 1 hour and 35 days old
              const age = Date.now() - parsed.ts;
              if (age > 3600000 && age < 35 * 86400000) prevSnap = parsed.data;
            }
          } catch (_) {}

          const oiResults = await Promise.allSettled(
            optionableHoldings.map(p => fetchOptionsData(p.sym))
          );

          const newSnap = {};
          const oiRows = [];
          const oiCharts = [];

          oiResults.forEach((r, i) => {
            const sym = optionableHoldings[i].sym;
            if (r.status === 'rejected' || r.value?.error) {
              oiRows.push([tn(sym), dim('N/A'), dim('N/A'), dim('—'), dim('—')]);
              return;
            }
            const d = r.value;
            newSnap[sym] = { callOI: d.totalCallOI, putOI: d.totalPutOI };

            const prev = prevSnap?.[sym];
            const callChange = prev ? d.totalCallOI - prev.callOI : null;
            const putChange  = prev ? d.totalPutOI  - prev.putOI  : null;
            const fmtOIVal = v => v >= 1e6 ? (v/1e6).toFixed(2)+'M' : v >= 1e3 ? (v/1e3).toFixed(1)+'K' : String(v);
            const fmtOIChg = v => {
              if (v === null) return dim('—');
              const s = v >= 0 ? '+' : '';
              const cls = v >= 0 ? 'positive' : 'negative';
              return `<span class="${cls}">${s}${fmtOIVal(Math.abs(v))}</span>`;
            };
            const pcr = d.putCallRatio != null ? d.putCallRatio.toFixed(2) : '—';
            const pcrCls = d.putCallRatio != null ? (d.putCallRatio > 1 ? 'negative' : 'positive') : '';
            const pcrCell = d.putCallRatio != null ? `<span class="${pcrCls}">${pcr}</span>` : dim('—');

            oiRows.push([
              tn(sym),
              `<span class="positive">${fmtOIVal(d.totalCallOI)}</span> ${fmtOIChg(callChange)}`,
              `<span class="negative">${fmtOIVal(d.totalPutOI)}</span> ${fmtOIChg(putChange)}`,
              pcrCell,
              d.expirationDate ? dim(d.expirationDate) : dim('—'),
            ]);

            if (d.callDist.length > 0 || d.putDist.length > 0) {
              oiCharts.push({ sym, d });
            }
          });

          // Save new snapshot
          try { localStorage.setItem(OI_SNAP_KEY, JSON.stringify({ ts: Date.now(), data: newSnap })); } catch (_) {}

          const changeLabel = prevSnap ? 'Chg (vs last)' : dim('Chg (first run)');
          printRaw(panel('Open Interest · Options Flow',
            table(['Ticker', `Call OI ${changeLabel}`, `Put OI ${changeLabel}`, 'P/C Ratio', 'Expiry'], oiRows)
          ));

          // OI distribution charts per symbol
          oiCharts.forEach(({ sym, d }) => {
            const oiId = 'oi-' + sym + '-' + Date.now();
            printRaw(panel(
              `${sym} · OI by Strike (±25% NTM)`,
              `<canvas id="${oiId}" height="120" style="width:100%;display:block;"></canvas>
               <div style="font-size:10px;color:#555;margin-top:3px;display:flex;gap:12px">
                 <span><span style="color:rgba(95,175,95,0.75)">█</span> Calls</span>
                 <span><span style="color:rgba(215,95,95,0.75)">█</span> Puts</span>
                 <span><span style="color:#5f87ff">┊</span> Current Price</span>
               </div>`,
              d.expirationDate || 'OI'
            ));
            const callDist = d.callDist, putDist = d.putDist, cp = d.currentPrice;
            requestAnimationFrame(() => drawOICanvas(oiId, callDist, putDist, cp));
          });
        }

      } catch (e) {
        hideLoading();
        printLines([`<span class="c-red">Failed to load analytics.</span> ${dim('Try again later.')}`]);
      }
      printBlank();
      print(dim(`${sc('/montecarlo')} for portfolio simulation · OI snapshot saved for change tracking`));
      printBlank();
      bindSlashCommands();
      scrollToBottom();
    },

    '/history': async function() {
      if (!sb || !currentUser) {
        printLines([`<span class="c-yellow">Sign in to view transaction history.</span> ${sc('/login')}`]);
        return;
      }

      showLoading('Fetching transactions...');
      try {
        const txns = await getTransactions(25);
        hideLoading();

        if (txns.length === 0) {
          printLines([
            dim('No transactions yet.'),
            `Use ${sc('/add')} to buy shares or ${sc('/sell')} to record sales.`,
          ]);
          return;
        }

        const rows = txns.map(t => {
          const date = new Date(t.executed_at).toLocaleDateString();
          const actionTag = t.action === 'buy' ? tag('bull', 'BUY') : tag('bear', 'SELL');
          const typeIcon = ASSET_TYPES[t.asset_type]?.icon || '·';
          const total = (t.qty * t.price).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
          return [
            dim(date),
            actionTag,
            `${typeIcon} ${tn(t.symbol)}`,
            String(t.qty),
            fmtPrice(t.price),
            `$${total}`,
            t.fees > 0 ? dim(`$${t.fees}`) : dim('—'),
          ];
        });

        printRaw(panel('Transaction History', table(['Date', 'Action', 'Ticker', 'Qty', 'Price', 'Total', 'Fees'], rows), `${txns.length} TRADES`));
      } catch (e) {
        hideLoading();
        printLines([`<span class="c-red">Error:</span> ${e.message}`]);
      }
      printBlank();
      bindSlashCommands();
      scrollToBottom();
    },

    '/watchlist': async function() {
      showLoading('Fetching watchlist...');
      try {
        const items = await getWatchlist();
        if (items === null) throw new Error('not logged in');

        if (items.length === 0) {
          hideLoading();
          printLines([
            dim('Your watchlist is empty.'),
            `Use ${sc('/watch')} ${dim('<ticker>')} to add any stock, ETF, or commodity.`,
          ]);
          printBlank();
          bindSlashCommands();
          scrollToBottom();
          return;
        }

        const syms = items.map(i => i.symbol);
        const [quotes, ...charts] = await Promise.all([
          fetchQuotes(syms),
          ...syms.map(s => fetchChartData(s).catch(() => null)),
        ]);
        hideLoading();

        const rows = items.map((item, i) => {
          const q = quotes[item.symbol];
          const chart = charts[i];
          const spark = chart ? sparkline(chart.closes) : dim('—');
          if (!q) return [tn(item.symbol), dim('—'), dim('—'), dim('—'), dim('—'), spark];

          const addedPrice = item.added_price;
          const pl = addedPrice ? ((q.price - addedPrice) / addedPrice) * 100 : null;
          const plCell = pl != null ? fmtChange(pl) : dim('—');
          const addedCell = addedPrice ? fmtPrice(addedPrice) : dim('—');

          return [tn(item.symbol), addedCell, fmtPrice(q.price), fmtChange(q.change), plCell, spark];
        });

        printRaw(panel('Watchlist', table(['Ticker', 'Added At', 'Price', 'Day', 'Since Added', '30d'], rows), 'LIVE'));
      } catch (e) {
        hideLoading();
        const rows = [
          [tn('MSFT'), '$415.20', '$430.10', fmtChange(1.20), fmtChange(3.59), dim('▁▂▃▄▅▆▇█▇▆▅▆▇█')],
          [tn('GOOGL'), '$152.87', '$161.44', fmtChange(0.82), fmtChange(5.60), dim('▃▄▅▄▃▄▅▆▇▆▅▆▇▆')],
          [tn('META'), '$501.33', '$489.20', fmtChange(2.08), fmtChange(-2.42), dim('▂▃▄▅▆▇█▇▆▇████')],
        ];
        printRaw(panel('Watchlist', table(['Ticker', 'Added At', 'Price', 'Day', 'Since Added', '30d'], rows), 'DEMO'));
      }
      printBlank();
      print(dim(`${sc('/watch')} <ticker> to add  ·  ${sc('/unwatch')} <ticker> to remove`));
      printBlank();
      bindSlashCommands();
      scrollToBottom();
    },

    '/watch': async function(args) {
      const sym = (args[0] || '').toUpperCase();
      if (!sym) {
        printLines([`Usage: ${sc('/watch')} ${dim('<ticker>')}`]);
        bindSlashCommands();
        return;
      }
      if (!currentUser) {
        printLines([`<span class="c-red">Login required.</span> Use ${sc('/login')} first.`]);
        bindSlashCommands();
        return;
      }
      showLoading(`Looking up ${sym}...`);
      try {
        const quotes = await fetchQuotes([sym]);
        const q = quotes[sym];
        if (!q || !q.price) throw new Error(`Could not find ticker ${sym}`);
        hideLoading();
        await addToWatchlist(sym, q.price);
        printLines([
          `<span class="c-green">Added ${sym} to watchlist</span> at ${fmtPrice(q.price)}`,
          dim(`P/L vs this price will be tracked going forward.`),
        ]);
      } catch (e) {
        hideLoading();
        if (e.message.includes('duplicate') || e.code === '23505') {
          printLines([`${sym} is already on your watchlist.`]);
        } else {
          printLines([`<span class="c-red">Error:</span> ${e.message}`]);
        }
      }
      printBlank();
      bindSlashCommands();
      scrollToBottom();
    },

    '/unwatch': async function(args) {
      const sym = (args[0] || '').toUpperCase();
      if (!sym) {
        printLines([`Usage: ${sc('/unwatch')} ${dim('<ticker>')}`]);
        bindSlashCommands();
        return;
      }
      if (!currentUser) {
        printLines([`<span class="c-red">Login required.</span> Use ${sc('/login')} first.`]);
        bindSlashCommands();
        return;
      }
      try {
        await removeFromWatchlist(sym);
        printLines([`Removed ${tn(sym)} from watchlist.`]);
      } catch (e) {
        printLines([`<span class="c-red">Error:</span> ${e.message}`]);
      }
      printBlank();
      bindSlashCommands();
      scrollToBottom();
    },

    '/montecarlo': async function() {
      showLoading('Running Monte Carlo simulation...');

      let holdings;
      if (sb && currentUser) {
        try {
          const db = await getHoldings();
          if (db && db.length > 0) {
            holdings = db.map(h => ({ sym: h.symbol, qty: Number(h.qty), avgCost: Number(h.avg_cost), type: h.asset_type }));
          }
        } catch (e) {}
      }
      if (!holdings) {
        holdings = [
          { sym: 'AAPL', qty: 50, avgCost: 171.20, type: 'equity' },
          { sym: 'NVDA', qty: 25, avgCost: 480.50, type: 'equity' },
          { sym: 'SPY',  qty: 30, avgCost: 440.00, type: 'etf' },
        ];
      }

      try {
        // Fetch current prices + chart history for all holdings
        const [quotes, ...charts] = await Promise.all([
          fetchQuotes(holdings.map(h => h.sym)),
          ...holdings.map(h => fetchChartData(h.sym).catch(() => null)),
        ]);
        hideLoading();

        const positions = holdings.map((h, i) => {
          const q = quotes[h.sym];
          const price = q ? q.price : (mockData[h.sym]?.price || h.avgCost);
          return { ...h, price, value: price * h.qty, chart: charts[i] };
        });

        const totalValue = positions.reduce((s, p) => s + p.value, 0);

        // Build portfolio-level weighted daily returns from chart data
        let portfolioCloses = null;
        const validPositions = positions.filter(p => p.chart && p.chart.closes.length > 5);

        if (validPositions.length > 0) {
          // Find shortest series length
          const minLen = Math.min(...validPositions.map(p => p.chart.closes.length));
          const totalW = validPositions.reduce((s, p) => s + p.value, 0);

          // Weighted portfolio value series
          portfolioCloses = Array.from({ length: minLen }, (_, i) => {
            return validPositions.reduce((sum, p) => {
              const weight = p.value / totalW;
              return sum + p.chart.closes[p.chart.closes.length - minLen + i] * weight;
            }, 0);
          });
          // Scale to actual total value
          const scaleFactor = totalValue / (portfolioCloses[portfolioCloses.length - 1] || 1);
          portfolioCloses = portfolioCloses.map(v => v * scaleFactor);
        }

        if (!portfolioCloses || portfolioCloses.length < 5) {
          printLines([`<span class="c-red">Not enough historical data to run simulation.</span>`]);
          printBlank(); bindSlashCommands(); scrollToBottom();
          return;
        }

        const N_PATHS = 100;
        const N_DAYS = 60;
        const { paths, annualVol } = runMonteCarlo(portfolioCloses, totalValue, N_PATHS, N_DAYS);

        // Summary stats at day 30 and 60
        const statsAt = (day) => {
          const vals = paths.map(p => p[day]).sort((a, b) => a - b);
          const p = f => vals[Math.max(0, Math.floor(vals.length * f))];
          return { p10: p(0.10), p25: p(0.25), p50: p(0.50), p75: p(0.75), p90: p(0.90) };
        };
        const s30 = statsAt(30);
        const s60 = statsAt(N_DAYS);
        const fmtDelta = (v) => {
          const d = v - totalValue;
          const pct = (d / totalValue * 100);
          const sign = d >= 0 ? '+' : '';
          const cls = d >= 0 ? 'positive' : 'negative';
          return `<span class="${cls}">${sign}${fmtPrice(d)} (${sign}${pct.toFixed(1)}%)</span>`;
        };

        const summaryRows = [
          ['Current Value',      fmtPrice(totalValue), ''],
          ['Annual Volatility',  `${(annualVol * 100).toFixed(1)}%`, ''],
          ['', bright('+30 Days'), bright('+60 Days')],
          ['Bull case (90th)',   `${fmtPrice(s30.p90)} ${fmtDelta(s30.p90)}`, `${fmtPrice(s60.p90)} ${fmtDelta(s60.p90)}`],
          ['Expected (median)',  `${fmtPrice(s30.p50)} ${fmtDelta(s30.p50)}`, `${fmtPrice(s60.p50)} ${fmtDelta(s60.p50)}`],
          ['Bear case (10th)',   `${fmtPrice(s30.p10)} ${fmtDelta(s30.p10)}`, `${fmtPrice(s60.p10)} ${fmtDelta(s60.p10)}`],
        ];
        printRaw(panel('Monte Carlo Summary', table(['Scenario', '+30 Days', '+60 Days'], summaryRows), `${N_PATHS} PATHS`));

        const mcId = 'mc-' + Date.now();
        const canvasHtml = `<canvas id="${mcId}" height="200" style="width:100%;display:block;"></canvas>
          <div style="font-size:10px;color:#555;margin-top:4px;display:flex;gap:16px">
            <span><span style="color:#5faf5f">━━</span> Median</span>
            <span><span style="color:rgba(95,175,95,0.6)">╌╌</span> 90th pct</span>
            <span><span style="color:rgba(215,95,95,0.6)">╌╌</span> 10th pct</span>
            <span><span style="color:rgba(95,135,255,0.4)">░░</span> P25–P75 band</span>
          </div>`;
        printRaw(panel(`Portfolio Simulation · ${N_PATHS} Paths · 60 Days`, canvasHtml, 'GBM'));
        requestAnimationFrame(() => drawMonteCarloCanvas(mcId, paths, totalValue));

      } catch (e) {
        hideLoading();
        printLines([`<span class="c-red">Simulation failed:</span> ${e.message}`]);
      }
      printBlank();
      print(dim(`Based on 30d historical returns · Geometric Brownian Motion · Not financial advice`));
      printBlank();
      bindSlashCommands();
      scrollToBottom();
    },

    '/alerts': function() {
      const rows = [
        [tag('neutral', '!'), tn('NVDA'), 'Above $750.00', tag('neutral', 'WATCHING')],
        [tag('neutral', '!'), tn('BTC-USD'), 'Above $70,000', tag('neutral', 'WATCHING')],
        [tag('bull', '✓'), tn('AAPL'), 'Above $185.00', tag('bull', 'TRIGGERED')],
      ];
      printRaw(panel('Price Alerts', table(['', 'Ticker', 'Condition', 'Status'], rows)));
      printBlank();
      print(dim('3 active alerts'));
      printBlank();
      scrollToBottom();
    },

    '/news': function() {
      const items = [
        [tag('bull', 'BULL'), 'Fed signals rate cuts ahead as inflation cools'],
        [tag('bull', 'BULL'), 'NVIDIA beats earnings expectations, AI demand surges'],
        [tag('bear', 'BEAR'), 'Treasury yields spike on labor market data'],
        [tag('neutral', '——'), 'Apple unveils new AI features at developer event'],
        [tag('bull', 'BULL'), 'S&P 500 hits new all-time high'],
        [tag('bear', 'BEAR'), 'Oil prices jump on Middle East tensions'],
      ];
      printRaw(panel('Financial News', table(['Signal', 'Headline'], items)));
      printBlank();
      scrollToBottom();
    },

    '/signup': async function() {
      if (!supabaseEnabled()) {
        printLines([`<span class="c-red">Supabase not configured</span>`]);
        return;
      }
      if (currentUser) {
        printLines([`<span class="c-yellow">Already signed in as</span> ${currentUser.email}. ${sc('/logout')} first.`]);
        return;
      }
      const fid = 'signup-' + Date.now();
      printRaw(`<div class="tui-panel" style="margin:6px 0"><div class="tui-panel-title" style="background:var(--bg-hover)">SIGN UP</div><div class="tui-panel-body">
        <div class="auth-form-row"><span class="c-dim" style="min-width:50px">Email</span><input type="email" class="auth-input" id="${fid}-e" placeholder="you@email.com"></div>
        <div class="auth-form-row"><span class="c-dim" style="min-width:50px">Pass</span><input type="password" class="auth-input" id="${fid}-p" placeholder="min 6 chars"></div>
        <div class="auth-form-row" style="margin-top:8px"><button class="auth-btn" id="${fid}-b">CREATE ACCOUNT</button></div>
        <div id="${fid}-m" style="margin-top:6px"></div>
      </div></div>`);
      scrollToBottom();
      document.getElementById(`${fid}-b`).addEventListener('click', async () => {
        const email = document.getElementById(`${fid}-e`).value.trim();
        const pass = document.getElementById(`${fid}-p`).value;
        const msg = document.getElementById(`${fid}-m`);
        if (!email || !pass) { msg.innerHTML = '<span class="c-red">Email and password required</span>'; return; }
        if (pass.length < 6) { msg.innerHTML = '<span class="c-red">Password must be 6+ chars</span>'; return; }
        msg.innerHTML = '<span class="c-dim loading-dots">Creating account</span>';
        const { data, error } = await sb.auth.signUp({ email, password: pass });
        if (error) msg.innerHTML = `<span class="c-red">${error.message}</span>`;
        else if (data.user && !data.session) msg.innerHTML = '<span class="c-green">Check email for confirmation link!</span>';
        else msg.innerHTML = `<span class="c-green">Signed in! Try ${sc('/portfolio')}</span>`;
        bindSlashCommands();
        scrollToBottom();
      });
    },

    '/login': async function() {
      if (!supabaseEnabled()) { printLines([`<span class="c-red">Supabase not configured</span>`]); return; }
      if (currentUser) { printLines([`<span class="c-yellow">Already signed in.</span> ${sc('/logout')} first.`]); return; }
      const fid = 'login-' + Date.now();
      printRaw(`<div class="tui-panel" style="margin:6px 0"><div class="tui-panel-title" style="background:var(--bg-hover)">SIGN IN</div><div class="tui-panel-body">
        <div class="auth-form-row"><span class="c-dim" style="min-width:50px">Email</span><input type="email" class="auth-input" id="${fid}-e" placeholder="you@email.com"></div>
        <div class="auth-form-row"><span class="c-dim" style="min-width:50px">Pass</span><input type="password" class="auth-input" id="${fid}-p" placeholder="password"></div>
        <div class="auth-form-row" style="margin-top:8px"><button class="auth-btn" id="${fid}-b">SIGN IN</button></div>
        <div id="${fid}-m" style="margin-top:6px"></div>
      </div></div>`);
      scrollToBottom();
      document.getElementById(`${fid}-b`).addEventListener('click', async () => {
        const email = document.getElementById(`${fid}-e`).value.trim();
        const pass = document.getElementById(`${fid}-p`).value;
        const msg = document.getElementById(`${fid}-m`);
        if (!email || !pass) { msg.innerHTML = '<span class="c-red">Email and password required</span>'; return; }
        msg.innerHTML = '<span class="c-dim loading-dots">Signing in</span>';
        const { error } = await sb.auth.signInWithPassword({ email, password: pass });
        if (error) msg.innerHTML = `<span class="c-red">${error.message}</span>`;
        else msg.innerHTML = `<span class="c-green">Signed in! Try ${sc('/portfolio')}</span>`;
        bindSlashCommands();
        scrollToBottom();
      });
    },

    '/logout': async function() {
      if (!currentUser) { printLines([`<span class="c-yellow">Not signed in.</span>`]); return; }
      stopLivePrices();
      await sb.auth.signOut();
      printLines([`<span class="c-green">Signed out.</span>`]);
    },

    '/about': function() {
      printLines([
        bright('About WealthWatch'),
        '',
        '  Terminal-style finance dashboard for tracking markets,',
        '  portfolios, and financial data across asset classes.',
        '',
        `  <span class="c-dim">No bloat. No clutter. Just data.</span>`,
        '',
        `  <span class="c-cyan">Markets</span>      Real-time quotes via Yahoo Finance`,
        `  <span class="c-cyan">Portfolio</span>    Multi-asset with 5s live prices`,
        `  <span class="c-cyan">Charts</span>       Interactive TradingView charts`,
        `  <span class="c-cyan">Analytics</span>    Allocation by position & asset type`,
        `  <span class="c-cyan">History</span>      Full transaction audit trail`,
        `  <span class="c-cyan">Accounts</span>     Supabase auth with RLS`,
        '',
        `  ${dim('Assets:')}   Equities, ETFs, Bonds, Commodities, Crypto`,
        `  ${dim('GitHub:')}   github.com/Scolliq/wealthwatch`,
        `  ${dim('Status:')}   <span class="c-green">● Operational</span>`,
      ]);
    },

    '/stack': function() {
      const arch = isMobile ? [
        `  <span class="c-cyan">BROWSER</span> <span class="c-dim">→</span> <span class="c-cyan">VERCEL</span> <span class="c-dim">→</span> <span class="c-cyan">YAHOO</span>`,
        `  <span class="c-dim">      ↕</span>`,
        `  <span class="c-cyan">SUPABASE</span> <span class="c-dim">(Auth + PostgreSQL)</span>`,
      ] : [
        `  <span class="c-dim">┌──────────┐    ┌──────────┐    ┌──────────┐</span>`,
        `  <span class="c-dim">│</span> <span class="c-cyan">BROWSER</span>  <span class="c-dim">│───▶│</span> <span class="c-cyan">VERCEL</span>   <span class="c-dim">│───▶│</span> <span class="c-cyan">YAHOO</span>    <span class="c-dim">│</span>`,
        `  <span class="c-dim">│</span> Terminal  <span class="c-dim">│◀───│</span> /api/    <span class="c-dim">│◀───│</span> Finance  <span class="c-dim">│</span>`,
        `  <span class="c-dim">└────┬─────┘    └──────────┘    └──────────┘</span>`,
        `  <span class="c-dim">     ▼</span>`,
        `  <span class="c-dim">┌──────────┐</span>`,
        `  <span class="c-dim">│</span> <span class="c-cyan">SUPABASE</span> <span class="c-dim">│  Auth + PostgreSQL + RLS</span>`,
        `  <span class="c-dim">└──────────┘</span>`,
      ];
      printLines([
        bright('Architecture'), '', ...arch, '',
        bright('Tech Stack'), '',
        `  <span class="c-dim">├──</span> Lightweight Charts   TradingView interactive charts`,
        `  <span class="c-dim">├──</span> Supabase JS          Auth, PostgreSQL, Row-Level Security`,
        `  <span class="c-dim">├──</span> Yahoo Finance v8     Quotes + OHLC chart data`,
        `  <span class="c-dim">├──</span> 5s live polling      Real-time portfolio prices`,
        `  <span class="c-dim">└──</span> Vercel               Hosting + serverless CORS proxy`,
      ]);
    },

    '/clear': function() {
      stopLivePrices();
      output.innerHTML = '';
    },
  };

  // ─── Dynamic commands ─────────────────────────────────

  async function quoteCmd(ticker) {
    if (!ticker) { printLines([`<span class="c-red">Usage:</span> /quote <ticker>`, `${dim('Example:')} ${sc('/quote AAPL')}`]); return; }
    const sym = ticker.toUpperCase();
    showLoading(`Fetching ${sym}...`);
    try {
      const data = await fetchQuotes([sym]);
      hideLoading();
      const q = data[sym];
      if (!q) { printLines([`<span class="c-red">No data for:</span> ${sym}`]); return; }
      const type = detectAssetType(sym);
      const typeLabel = ASSET_TYPES[type]?.label || type;
      const rows = [
        ['Price', `<strong>${fmtPrice(q.price)}</strong>`, fmtChange(q.change)],
        ['Day High', fmtPrice(q.high), ''], ['Day Low', fmtPrice(q.low), ''],
        ['Open', fmtPrice(q.open), ''], ['Prev Close', fmtPrice(q.prevClose), ''],
        ['Volume', q.vol, ''], ['Market Cap', q.cap ? '$' + q.cap : '—', ''],
        ['Type', `${ASSET_TYPES[type]?.icon || ''} ${typeLabel}`, ''],
      ];
      printRaw(panel(`${sym} · ${q.name}`, table(['Metric', 'Value', ''], rows), 'LIVE'));
      printBlank();
      print(dim(`${sc('/chart ' + sym)} for chart  ·  ${sc('/add ' + sym + ' 10 ' + q.price.toFixed(2))} to buy`));
    } catch (e) {
      hideLoading();
      const m = mockData[sym];
      if (m) {
        const rows = [['Price', `<strong>${fmtPrice(m.price)}</strong>`, fmtChange(m.change)], ['Volume', m.vol, ''], ['Cap', '$' + m.cap, '']];
        printRaw(panel(`${sym} · ${m.name}`, table(['Metric', 'Value', ''], rows), 'DEMO'));
      } else {
        printLines([`<span class="c-red">Failed to fetch:</span> ${sym}`]);
      }
    }
    printBlank();
    bindSlashCommands();
    scrollToBottom();
  }

  async function chartCmd(ticker) {
    if (!ticker) { printLines([`<span class="c-red">Usage:</span> /chart <ticker>`, `${dim('Example:')} ${sc('/chart NVDA')}`]); return; }
    const sym = ticker.toUpperCase();
    showLoading(`Fetching chart for ${sym}...`);
    try {
      const data = await fetchChartData(sym);
      hideLoading();
      if (data.closes.length < 2) { printLines([`<span class="c-red">Not enough data for:</span> ${sym}`]); return; }

      const trend = data.closes[data.closes.length - 1] >= data.closes[0];
      const changeVal = ((data.closes[data.closes.length - 1] / data.closes[0]) - 1) * 100;
      const changeStr = changeVal >= 0 ? `+${changeVal.toFixed(2)}%` : `${changeVal.toFixed(2)}%`;
      const trendCls = trend ? 'positive' : 'negative';
      const min = Math.min(...data.closes), max = Math.max(...data.closes), last = data.closes[data.closes.length - 1];

      const chartId = 'tv-chart-' + Date.now();
      const statsHtml = `<div class="chart-stats">
        <span class="chart-stat"><span class="chart-stat-label">Last</span> <span class="chart-stat-value">${fmtPrice(last)}</span></span>
        <span class="chart-stat"><span class="chart-stat-label">30d</span> <span class="${trendCls}">${changeStr}</span></span>
        <span class="chart-stat"><span class="chart-stat-label">High</span> <span class="chart-stat-value">${fmtPrice(max)}</span></span>
        <span class="chart-stat"><span class="chart-stat-label">Low</span> <span class="chart-stat-value">${fmtPrice(min)}</span></span>
      </div>`;
      printRaw(panel(`${sym} · 30D CHART`, `<div class="chart-container" id="${chartId}"></div>${statsHtml}`, 'LIVE'));
      requestAnimationFrame(() => renderChart(chartId, data));
    } catch (e) {
      hideLoading();
      const m = mockData[sym];
      if (m) {
        const b = m.price;
        const lines = [
          `  ${fmtPrice(b*1.04).padStart(10)} ┤                                      ╭──`,
          `  ${fmtPrice(b*1.02).padStart(10)} ┤                           ╭──╮   ╭──╯`,
          `  ${fmtPrice(b*1.00).padStart(10)} ┤           ╭───╮      ╭────╯  ╰───╯`,
          `  ${fmtPrice(b*0.98).padStart(10)} ┤      ╭────╯   ╰──────╯`,
          `  ${fmtPrice(b*0.96).padStart(10)} ┤ ╭────╯`,
          `  ${fmtPrice(b*0.94).padStart(10)} ┤─╯`,
          `             └──────────────────────────────────────`,
          `  ${dim('           -30d              -15d              now')}`,
        ];
        printRaw(panel(`${sym} · 30D CHART`, `<div class="ascii-art">${lines.join('\n')}</div>`, 'DEMO'));
      } else {
        printLines([`<span class="c-red">Failed to fetch chart for:</span> ${sym}`]);
      }
    }
    printBlank();
    bindSlashCommands();
    scrollToBottom();
  }

  async function addCmd(parts) {
    if (!supabaseEnabled()) { printLines([`<span class="c-red">Supabase not configured</span>`]); return; }
    if (!currentUser) { printLines([`<span class="c-yellow">Sign in first.</span> ${sc('/login')}`]); return; }

    // /add AAPL 10 150.00 [equity|bond|commodity|crypto|etf]
    if (parts.length < 4) {
      printLines([
        `<span class="c-red">Usage:</span> /add <SYMBOL> <QTY> <COST> [type]`,
        '', dim('Examples:'),
        `  ${sc('/add AAPL 10 150.00')}          ${dim('equity (auto-detected)')}`,
        `  ${sc('/add BTC-USD 0.5 42000')}       ${dim('crypto (auto-detected)')}`,
        `  ${sc('/add GLD 20 185 commodity')}     ${dim('override type')}`,
        `  ${sc('/add TLT 50 95.00 bond')}        ${dim('bond')}`,
        '', dim('Types: equity, etf, bond, commodity, crypto'),
      ]);
      return;
    }

    const sym = parts[1].toUpperCase();
    const qty = parseFloat(parts[2]);
    const cost = parseFloat(parts[3]);
    const typeOverride = parts[4]?.toLowerCase();
    const assetType = typeOverride && ASSET_TYPES[typeOverride] ? typeOverride : detectAssetType(sym);

    if (isNaN(qty) || qty <= 0) { printLines([`<span class="c-red">Invalid qty:</span> ${parts[2]}`]); return; }
    if (isNaN(cost) || cost < 0) { printLines([`<span class="c-red">Invalid cost:</span> ${parts[3]}`]); return; }

    showLoading(`Adding ${qty} ${sym}...`);
    try {
      await addHolding(sym, qty, cost, assetType, new Date().toISOString().split('T')[0]);
      hideLoading();
      printLines([
        `<span class="c-green">Bought ${qty} × ${sym} @ ${fmtPrice(cost)}</span>  ${dim(ASSET_TYPES[assetType]?.icon + ' ' + ASSET_TYPES[assetType]?.label)}`,
        dim(`Total: ${fmtPrice(qty * cost)}  ·  ${sc('/portfolio')} to view holdings`),
      ]);
    } catch (e) {
      hideLoading();
      printLines([`<span class="c-red">Error:</span> ${e.message}`]);
    }
  }

  async function sellCmd(parts) {
    if (!supabaseEnabled()) { printLines([`<span class="c-red">Supabase not configured</span>`]); return; }
    if (!currentUser) { printLines([`<span class="c-yellow">Sign in first.</span> ${sc('/login')}`]); return; }

    // /sell AAPL 5 200.00
    if (parts.length < 4) {
      printLines([
        `<span class="c-red">Usage:</span> /sell <SYMBOL> <QTY> <PRICE>`,
        `${dim('Example:')} ${sc('/sell AAPL 5 200.00')}`,
        '', dim('Sells shares and logs the transaction.'),
        dim('If you sell all shares, the position is removed.'),
      ]);
      return;
    }

    const sym = parts[1].toUpperCase();
    const qty = parseFloat(parts[2]);
    const price = parseFloat(parts[3]);

    if (isNaN(qty) || qty <= 0) { printLines([`<span class="c-red">Invalid qty:</span> ${parts[2]}`]); return; }
    if (isNaN(price) || price < 0) { printLines([`<span class="c-red">Invalid price:</span> ${parts[3]}`]); return; }

    showLoading(`Selling ${qty} ${sym}...`);
    try {
      await sellHolding(sym, qty, price);
      hideLoading();
      printLines([
        `<span class="c-green">Sold ${qty} × ${sym} @ ${fmtPrice(price)}</span>`,
        dim(`Proceeds: ${fmtPrice(qty * price)}  ·  ${sc('/portfolio')} to view  ·  ${sc('/history')} for trades`),
      ]);
    } catch (e) {
      hideLoading();
      printLines([`<span class="c-red">Error:</span> ${e.message}`]);
    }
  }

  async function removeCmd(parts) {
    if (!supabaseEnabled()) { printLines([`<span class="c-red">Supabase not configured</span>`]); return; }
    if (!currentUser) { printLines([`<span class="c-yellow">Sign in first.</span> ${sc('/login')}`]); return; }
    if (parts.length < 2) { printLines([`<span class="c-red">Usage:</span> /remove <SYMBOL>`]); return; }
    const sym = parts[1].toUpperCase();
    showLoading(`Removing ${sym}...`);
    try {
      await removeHolding(sym);
      hideLoading();
      printLines([`<span class="c-green">Removed ${sym}.</span> ${sc('/portfolio')}`]);
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
    if (!cmd.startsWith('/')) cmd = '/' + cmd;

    if (cmd === '/quote' || cmd === '/q' || cmd === '/price') quoteCmd(parts[1]);
    else if (cmd === '/chart' || cmd === '/c') chartCmd(parts[1]);
    else if (cmd === '/add' || cmd === '/buy') addCmd(parts);
    else if (cmd === '/sell') sellCmd(parts);
    else if (cmd === '/remove' || cmd === '/rm') removeCmd(parts);
    else if (cmd === '/watch') commands['/watch'](parts.slice(1));
    else if (cmd === '/unwatch') commands['/unwatch'](parts.slice(1));
    else if (cmd === '/montecarlo' || cmd === '/mc') commands['/montecarlo']();
    else if (commands[cmd]) commands[cmd]();
    else printLines([`<span class="c-red">unknown:</span> ${trimmed}`, `${sc('/help')} for commands`]);
  }

  // ─── Input ────────────────────────────────────────────

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { const val = input.value; input.value = ''; runCommand(val); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (historyIndex > 0) { historyIndex--; input.value = commandHistory[historyIndex]; } }
    else if (e.key === 'ArrowDown') { e.preventDefault(); if (historyIndex < commandHistory.length - 1) { historyIndex++; input.value = commandHistory[historyIndex]; } else { historyIndex = commandHistory.length; input.value = ''; } }
  });

  document.addEventListener('click', (e) => {
    if (!window.getSelection().toString() && !e.target.closest('a') && !e.target.closest('input') && !e.target.closest('button')) input.focus();
  });

  // ─── Clock & Market Status ────────────────────────────

  function updateClock() {
    const est = new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    });
    document.getElementById('clock').textContent = est + ' EST';
  }
  updateClock();
  setInterval(updateClock, 1000);

  function updateMarketStatus() {
    const est = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const day = est.getDay(), time = est.getHours() * 60 + est.getMinutes();
    const el = document.getElementById('market-status');
    if (day >= 1 && day <= 5 && time >= 570 && time < 960) {
      el.textContent = '● MARKET OPEN'; el.style.color = '#1a3a1a';
    } else {
      el.textContent = '○ MARKET CLOSED'; el.style.color = '#3a1a1a';
    }
  }
  updateMarketStatus();
  setInterval(updateMarketStatus, 60000);

  // ─── Ticker Bar ───────────────────────────────────────

  const tickerSymbols = ['AAPL', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'AMD', 'BTC-USD', 'ETH-USD', '^GSPC', '^DJI'];
  const tickerLabels = { '^GSPC': 'S&P', '^DJI': 'DOW', 'BTC-USD': 'BTC', 'ETH-USD': 'ETH' };

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

  const mockTickerData = {};
  [
    { sym: 'AAPL', price: 189.84, change: 1.24 }, { sym: 'NVDA', price: 721.33, change: 3.87 },
    { sym: 'MSFT', price: 415.20, change: 1.15 }, { sym: 'GOOGL', price: 152.87, change: 0.82 },
    { sym: 'AMZN', price: 178.12, change: -0.31 }, { sym: 'TSLA', price: 231.45, change: -2.14 },
    { sym: 'META', price: 501.33, change: 2.08 }, { sym: 'AMD', price: 168.90, change: -1.42 },
    { sym: 'BTC-USD', price: 67843, change: 2.31 }, { sym: 'ETH-USD', price: 3521, change: 1.87 },
    { sym: '^GSPC', price: 5842.31, change: 1.24 }, { sym: '^DJI', price: 43890, change: 0.87 },
  ].forEach(t => { mockTickerData[t.sym] = { price: t.price, change: t.change }; });
  renderTickerBar(mockTickerData);

  async function refreshTickerBar() {
    try { renderTickerBar(await fetchQuotes(tickerSymbols)); } catch (e) {}
  }
  refreshTickerBar();
  setInterval(refreshTickerBar, 30000);

  // ─── Boot ─────────────────────────────────────────────
  boot();

})();
