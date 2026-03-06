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
  let activePortfolioId = 'main';

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

  // ─── Portfolio Management ─────────────────────────────

  function loadPortfolioStore() {
    try { return JSON.parse(localStorage.getItem('ww_portfolios') || '{"activeId":"main","portfolios":[]}'); }
    catch { return { activeId: 'main', portfolios: [] }; }
  }
  function savePortfolioStore(data) { localStorage.setItem('ww_portfolios', JSON.stringify(data)); }

  function getAllPortfolios() {
    const store = loadPortfolioStore();
    return [
      { id: 'main', name: 'Main Portfolio', type: currentUser ? 'supabase' : 'demo', holdings: null },
      ...store.portfolios.map(p => ({ ...p, type: 'local' })),
    ];
  }

  function getPortfolioByNameOrIndex(arg) {
    const portfolios = getAllPortfolios();
    const n = parseInt(arg);
    if (!isNaN(n) && n >= 1 && n <= portfolios.length) return portfolios[n - 1];
    const lower = String(arg).toLowerCase();
    return portfolios.find(p => p.name.toLowerCase() === lower) || null;
  }

  function createLocalPortfolio(name) {
    const store = loadPortfolioStore();
    const id = 'p_' + Date.now();
    store.portfolios.push({ id, name, holdings: [] });
    store.activeId = id;
    savePortfolioStore(store);
    activePortfolioId = id;
    updatePortfolioUI();
    return id;
  }

  function setActivePortfolio(id) {
    const store = loadPortfolioStore();
    store.activeId = id;
    savePortfolioStore(store);
    activePortfolioId = id;
    updatePortfolioUI();
  }

  function getLocalHoldings(id) {
    const store = loadPortfolioStore();
    const p = store.portfolios.find(p => p.id === id);
    return p ? (p.holdings || []) : [];
  }

  function addLocalHolding(id, sym, qty, avgCost, type) {
    const store = loadPortfolioStore();
    const p = store.portfolios.find(p => p.id === id);
    if (!p) throw new Error('Portfolio not found');
    const existing = p.holdings.find(h => h.sym === sym);
    if (existing) {
      const totalQty = existing.qty + qty;
      existing.avgCost = ((existing.avgCost * existing.qty) + (avgCost * qty)) / totalQty;
      existing.qty = totalQty;
    } else {
      p.holdings.push({ sym, qty, avgCost, type });
    }
    savePortfolioStore(store);
  }

  function sellLocalHolding(id, sym, qty) {
    const store = loadPortfolioStore();
    const p = store.portfolios.find(p => p.id === id);
    if (!p) throw new Error('Portfolio not found');
    const h = p.holdings.find(h => h.sym === sym);
    if (!h) throw new Error(`You don't hold ${sym} in this portfolio`);
    if (qty > h.qty) throw new Error(`You only hold ${h.qty} of ${sym} in this portfolio`);
    if (qty === h.qty) { p.holdings = p.holdings.filter(h2 => h2.sym !== sym); }
    else { h.qty -= qty; }
    savePortfolioStore(store);
  }

  function removeLocalHolding(id, sym) {
    const store = loadPortfolioStore();
    const p = store.portfolios.find(p => p.id === id);
    if (!p) throw new Error('Portfolio not found');
    p.holdings = p.holdings.filter(h => h.sym !== sym);
    savePortfolioStore(store);
  }

  function renameLocalPortfolio(id, name) {
    const store = loadPortfolioStore();
    const p = store.portfolios.find(p => p.id === id);
    if (!p) throw new Error('Portfolio not found');
    p.name = name;
    savePortfolioStore(store);
  }

  function deleteLocalPortfolio(id) {
    const store = loadPortfolioStore();
    store.portfolios = store.portfolios.filter(p => p.id !== id);
    if (store.activeId === id) store.activeId = 'main';
    savePortfolioStore(store);
    if (activePortfolioId === id) { activePortfolioId = 'main'; }
    updatePortfolioUI();
  }

  function updatePortfolioUI() {
    const el = document.getElementById('portfolio-indicator');
    if (!el) return;
    if (activePortfolioId === 'main') {
      el.textContent = '◆ Main';
    } else {
      const store = loadPortfolioStore();
      const p = store.portfolios.find(p => p.id === activePortfolioId);
      el.textContent = p ? `◆ ${p.name}` : '◆ Main';
    }
  }

  // ─── Demo holdings (shared) ───────────────────────────

  const DEMO_HOLDINGS = [
    { sym: 'AAPL', qty: 50, avgCost: 171.20, type: 'equity' },
    { sym: 'NVDA', qty: 25, avgCost: 480.50, type: 'equity' },
    { sym: 'TSLA', qty: 10, avgCost: 248.90, type: 'equity' },
    { sym: 'BTC-USD', qty: 0.5, avgCost: 42100, type: 'crypto' },
    { sym: 'GLD', qty: 20, avgCost: 185.00, type: 'commodity' },
    { sym: 'SPY', qty: 30, avgCost: 440.00, type: 'etf' },
  ];

  async function getHoldingsForPortfolio(id) {
    if (id === 'main') {
      if (sb && currentUser) {
        try {
          const dbHoldings = await getHoldings();
          if (dbHoldings && dbHoldings.length > 0) {
            return {
              holdings: dbHoldings.map(h => ({ sym: h.symbol, qty: Number(h.qty), avgCost: Number(h.avg_cost), type: h.asset_type, date: h.purchase_date, notes: h.notes })),
              isUserPortfolio: true,
            };
          }
        } catch (e) {}
      }
      return { holdings: DEMO_HOLDINGS, isUserPortfolio: false };
    }
    return { holdings: getLocalHoldings(id), isUserPortfolio: true };
  }

  // Init active portfolio from storage
  activePortfolioId = loadPortfolioStore().activeId || 'main';
  updatePortfolioUI();

  // ─── Data fetching ──────────────────────────────────────

  const API_BASE = '/api/quote';
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

  async function fetchChartData(symbol, range = '1mo') {
    const key = 'chart:' + symbol + ':' + range;
    const cached = getCached(key);
    if (cached) return cached;

    const res = await fetch(`${API_BASE}?symbols=${symbol}&type=chart&range=${range}`);
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
    GLD:       { name: 'SPDR Gold Trust',     price: 220.50, change: 0.45,  high: 221.80, low: 219.20, vol: '8.2M',   cap: '55B'  },
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
    if (['SPY', 'QQQ', 'IWM', 'DIA', 'VTI', 'VOO', 'VEA', 'VWO', 'BND', 'AGG', 'TLT', 'IEF', 'LQD', 'HYG', 'ARKK', 'XLF', 'XLE', 'XLK'].includes(sym)) return 'etf';
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
    print(`    ${sc('/watchlist')}     ${dim('Tracked tickers')}`);
    print(`    ${sc('/news')}          ${dim('Financial headlines')}`);
    printBlank();

    print(`<span class="c-bright">  Portfolio:</span>`);
    print(`    ${sc('/portfolios')}    ${dim('Manage & compare portfolios')}`);
    print(`    ${sc('/portfolio')}     ${dim('Holdings with live prices (5s refresh)')}`);
    print(`    ${sc('/analytics')}     ${dim('Allocation, performance & stats')}`);
    print(`    ${sc('/compare')} ${dim('<#> <#>')}  ${dim('Side-by-side portfolio comparison')}`);
    print(`    ${sc('/history')}       ${dim('Transaction history')}`);
    print(`    ${sc('/add')} ${dim('<SYM> <QTY> <COST>')}  ${dim('Buy / add to active portfolio')}`);
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
        `  ${sc('/watchlist')}               ${dim('Tracked tickers')}`,
        `  ${sc('/alerts')}                  ${dim('Price alerts')}`,
        `  ${sc('/news')}                    ${dim('Headlines')}`,
        '',
        bright('Portfolio'),
        `  ${sc('/portfolios')}              ${dim('List & manage named portfolios')}`,
        `  ${sc('/portfolio')} ${dim('[#]')}             ${dim('Holdings with live 5s prices')}`,
        `  ${sc('/analytics')} ${dim('[#]')}             ${dim('Allocation & performance')}`,
        `  ${sc('/compare')} ${dim('<#> <#>')}           ${dim('Side-by-side comparison')}`,
        `  ${sc('/newportfolio')} ${dim('<name>')}        ${dim('Create a new portfolio')}`,
        `  ${sc('/switchportfolio')} ${dim('<#>')}        ${dim('Set active portfolio')}`,
        `  ${sc('/renameportfolio')} ${dim('<#> <name>')} ${dim('Rename a portfolio')}`,
        `  ${sc('/deleteportfolio')} ${dim('<#>')}        ${dim('Delete a portfolio')}`,
        `  ${sc('/history')}                 ${dim('Transaction log')}`,
        `  ${sc('/add')} ${dim('<SYM> <QTY> <COST>')}   ${dim('Buy shares (active portfolio)')}`,
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

    '/portfolio': async function(portfolioArg) {
      stopLivePrices(); // Stop any previous poller

      const targetPortfolioId = portfolioArg
        ? (getPortfolioByNameOrIndex(portfolioArg)?.id || activePortfolioId)
        : activePortfolioId;
      const targetMeta = getAllPortfolios().find(p => p.id === targetPortfolioId) || getAllPortfolios()[0];

      showLoading(`Fetching ${targetMeta.name}...`);

      const { holdings, isUserPortfolio } = await getHoldingsForPortfolio(targetPortfolioId);

      if (holdings.length === 0) {
        hideLoading();
        printLines([dim(`No holdings in ${targetMeta.name}. Use ${sc('/add')} to add positions.`), sc('/portfolios')]);
        return;
      }

      const allSyms = holdings.map(h => h.sym);
      const liveContainerId = 'live-portfolio-' + Date.now();

      function renderPortfolioTable(data) {
        const el = document.getElementById(liveContainerId);
        if (!el) { stopLivePrices(); return; }

        // Group by asset type
        const groups = {};
        let totalValue = 0, totalPL = 0, totalCost = 0, totalDayPL = 0;

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
          totalDayPL += value * change / 100;

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

          const groupDayPL = items.reduce((s, i) => s + (i.value * i.change / 100), 0);
          const footer = ['', '', '', `<strong>${fmtPrice(groupValue)}</strong>`, fmtPL(groupDayPL), `<strong>${fmtPL(groupPL)}</strong>`, ''];
          html += panel(`${meta.icon} ${meta.label}`, table(['Ticker', 'Qty', 'Cost', 'Price', 'Day %', 'P/L', '%'], rows, footer));
        });

        // Total summary bar
        const totalPLPct = totalCost > 0 ? ((totalPL / totalCost) * 100) : 0;
        const totalDayPct = totalValue > 0 ? ((totalDayPL / (totalValue - totalDayPL)) * 100) : 0;
        html += `<div class="tui-panel" style="border-color:var(--accent)"><div class="tui-panel-body" style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;font-size:12px">`;
        html += `<span>${dim('Total Value')} <strong>${fmtPrice(totalValue)}</strong></span>`;
        html += `<span>${dim('Total P/L')} <strong>${fmtPL(totalPL)}</strong> (${fmtPLPct(totalPLPct)})</span>`;
        html += `<span>${dim('Day P/L')} <strong>${fmtPL(totalDayPL)}</strong> (${fmtPLPct(totalDayPct)})</span>`;
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
      const pIdx = getAllPortfolios().findIndex(p => p.id === targetPortfolioId) + 1;
      const analyticsLink = pIdx > 1 ? `/analytics ${pIdx}` : '/analytics';
      print(dim(`${sc(analyticsLink)} for deep stats  ·  ${sc('/chart')} <ticker> for charts  ·  ${sc('/portfolios')} to manage`));
      printBlank();
      bindSlashCommands();
      scrollToBottom();
    },

    '/analytics': async function(portfolioArg) {
      const targetPortfolioId = portfolioArg
        ? (getPortfolioByNameOrIndex(portfolioArg)?.id || activePortfolioId)
        : activePortfolioId;
      const targetMeta = getAllPortfolios().find(p => p.id === targetPortfolioId) || getAllPortfolios()[0];

      showLoading(`Analyzing ${targetMeta.name}...`);

      const { holdings, isUserPortfolio } = await getHoldingsForPortfolio(targetPortfolioId);

      if (holdings.length === 0) {
        hideLoading();
        printLines([dim(`No holdings in ${targetMeta.name}. Use ${sc('/add')} to add positions.`), sc('/portfolios')]);
        return;
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
        const dayPct = totalValue > 0 ? (dayPL / (totalValue - dayPL)) * 100 : 0;

        // Summary
        const summaryRows = [
          ['Total Value', `<strong>${fmtPrice(totalValue)}</strong>`],
          ['Total P/L', `<strong>${fmtPL(totalPL)}</strong> (${fmtPLPct(totalPLPct)})`],
          ['Day P/L', `<strong>${fmtPL(dayPL)}</strong> (${fmtPLPct(dayPct)})`],
          ['Positions', String(positions.length)],
          ['Asset Types', [...new Set(positions.map(p => ASSET_TYPES[p.type]?.label || p.type))].join(', ')],
          ['Best Performer', positions.length ? `${tn(positions.reduce((a, b) => a.plPct > b.plPct ? a : b).sym)}` : '—'],
          ['Worst Performer', positions.length ? `${tn(positions.reduce((a, b) => a.plPct < b.plPct ? a : b).sym)}` : '—'],
        ];
        printRaw(panel('Portfolio Summary · ' + targetMeta.name, table(['Metric', 'Value'], summaryRows), isUserPortfolio ? 'YOUR DATA' : 'DEMO'));

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

        // Performance ranking (sorted by total P/L)
        const sorted = [...positions].sort((a, b) => b.plPct - a.plPct);
        const perfRows = sorted.map(p => [
          `${ASSET_TYPES[p.type]?.icon || '·'} ${tn(p.sym)}`,
          dim(ASSET_TYPES[p.type]?.label || p.type),
          fmtPrice(p.value),
          fmtPL(p.pl),
          fmtPLPct(p.plPct),
        ]);
        printRaw(panel('Performance Ranking', table(['Ticker', 'Type', 'Value', 'P/L', '%'], perfRows), 'BY TOTAL P/L'));

        // Today's movers (sorted by day % change)
        const movers = [...positions].sort((a, b) => b.dayChange - a.dayChange);
        const moverRows = movers.map(p => [
          `${ASSET_TYPES[p.type]?.icon || '·'} ${tn(p.sym)}`,
          dim(ASSET_TYPES[p.type]?.label || p.type),
          fmtPrice(p.value),
          fmtChange(p.dayChange),
          fmtPL(p.value * p.dayChange / 100),
        ]);
        printRaw(panel("Today's Movers", table(['Ticker', 'Type', 'Value', 'Day %', 'Day P/L'], moverRows), 'BY DAY CHANGE'));

        // Value at Risk — Historical Simulation (2-year window)
        try {
          const chartResults = await Promise.allSettled(holdings.map(h => fetchChartData(h.sym, '2y')));

          // Build daily return series for each position that has chart data
          const posReturns = [];
          chartResults.forEach((r, idx) => {
            if (r.status !== 'fulfilled') return;
            const closes = r.value.closes;
            if (closes.length < 3) return;
            const returns = [];
            for (let i = 1; i < closes.length; i++) {
              if (!closes[i] || !closes[i - 1]) continue;
              returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
            }
            if (returns.length < 3) return;
            posReturns.push({ returns, weight: positions[idx].value / totalValue });
          });

          if (posReturns.length >= 2) {
            // Align to the shortest return series, using most-recent observations
            const minLen = Math.min(...posReturns.map(p => p.returns.length));

            // Compute portfolio-weighted daily returns for each day
            const portReturns = [];
            for (let i = 0; i < minLen; i++) {
              const offset = i + (posReturns[0].returns.length - minLen); // align to recent
              const dayRet = posReturns.reduce((s, p) => {
                const idx2 = i + (p.returns.length - minLen);
                return s + p.weight * p.returns[idx2];
              }, 0);
              portReturns.push(dayRet);
            }

            portReturns.sort((a, b) => a - b);
            const n = portReturns.length;

            // Historical VaR: find the loss at the given percentile
            const idx95 = Math.min(n - 1, Math.max(0, Math.floor(n * 0.05)));
            const idx99 = Math.min(n - 1, Math.max(0, Math.floor(n * 0.01)));

            const var95Ret = -portReturns[idx95];  // positive = expected loss
            const var99Ret = -portReturns[idx99];
            const var95    = var95Ret * totalValue;
            const var99    = var99Ret * totalValue;

            // 10-day VaR via square-root-of-time rule
            const var95_10d = var95 * Math.sqrt(10);
            const var99_10d = var99 * Math.sqrt(10);

            // Expected Shortfall (CVaR) at 95%: average of losses beyond VaR
            const tailSlice = portReturns.slice(0, idx95 + 1);
            const cvarRet = tailSlice.length > 0
              ? -(tailSlice.reduce((s, r) => s + r, 0) / tailSlice.length)
              : var95Ret;
            const cvar95 = cvarRet * totalValue;

            const worstRet = portReturns[0];
            const bestRet  = portReturns[n - 1];

            const varRows = [
              ['1-Day VaR (95%)',  fmtPL(-var95),       fmtChange(-var95Ret * 100)],
              ['1-Day VaR (99%)',  fmtPL(-var99),       fmtChange(-var99Ret * 100)],
              ['10-Day VaR (95%)', fmtPL(-var95_10d),   fmtChange(-var95Ret * Math.sqrt(10) * 100)],
              ['CVaR / ES (95%)',  fmtPL(-cvar95),      fmtChange(-cvarRet * 100)],
              ['Worst Day (30d)',  fmtPL(worstRet * totalValue), fmtChange(worstRet * 100)],
              ['Best Day (30d)',   fmtPL(bestRet * totalValue),  fmtChange(bestRet * 100)],
            ];

            const varNote = dim(`Historical simulation · ${n} trading days (~2yr) · Square-root-of-time for 10d · Assumes static weights`);
            printRaw(panel('Value at Risk (VaR)',
              table(['Metric', 'Dollar Impact', 'Return'], varRows) +
              `<div style="padding:6px 0 2px;font-size:11px">${varNote}</div>`,
              'HISTORICAL · 2YR'
            ));

            // Monte Carlo VaR (Gaussian, calibrated from same 2yr history)
            const mu = portReturns.reduce((s, r) => s + r, 0) / n;
            const variance = portReturns.reduce((s, r) => s + (r - mu) ** 2, 0) / (n - 1);
            const sigma = Math.sqrt(variance);
            function randNorm() {
              const u1 = Math.random(), u2 = Math.random();
              return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
            }
            const MC_SIMS = 10000;
            const mcReturns = Array.from({ length: MC_SIMS }, () => mu + sigma * randNorm());
            mcReturns.sort((a, b) => a - b);
            const mcIdx95 = Math.floor(MC_SIMS * 0.05);
            const mcIdx99 = Math.floor(MC_SIMS * 0.01);
            const mcVar95Ret = -mcReturns[mcIdx95];
            const mcVar99Ret = -mcReturns[mcIdx99];
            const mcVar95 = mcVar95Ret * totalValue;
            const mcVar99 = mcVar99Ret * totalValue;
            const mcTail = mcReturns.slice(0, mcIdx95 + 1);
            const mcCvarRet = -(mcTail.reduce((s, r) => s + r, 0) / mcTail.length);
            const mcCvar95 = mcCvarRet * totalValue;
            const mcRows = [
              ['1-Day VaR (95%)',  fmtPL(-mcVar95),                      fmtChange(-mcVar95Ret * 100)],
              ['1-Day VaR (99%)',  fmtPL(-mcVar99),                      fmtChange(-mcVar99Ret * 100)],
              ['10-Day VaR (95%)', fmtPL(-mcVar95 * Math.sqrt(10)),      fmtChange(-mcVar95Ret * Math.sqrt(10) * 100)],
              ['CVaR / ES (95%)',  fmtPL(-mcCvar95),                     fmtChange(-mcCvarRet * 100)],
            ];
            const mcNote = dim(`Gaussian simulation · ${MC_SIMS.toLocaleString()} scenarios · Calibrated from ${n} trading days (~2yr) · σ=${(sigma * 100).toFixed(3)}%/day`);
            printRaw(panel('Value at Risk (Monte Carlo)',
              table(['Metric', 'Dollar Impact', 'Return'], mcRows) +
              `<div style="padding:6px 0 2px;font-size:11px">${mcNote}</div>`,
              'GAUSSIAN · 10K SIMS'
            ));
          }
        } catch (_) { /* VaR is supplementary — fail silently */ }

      } catch (e) {
        hideLoading();
        printLines([`<span class="c-red">Failed to load analytics.</span> ${dim('Try again later.')}`]);
      }
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

    '/portfolios': function() {
      const portfolios = getAllPortfolios();
      const rows = portfolios.map((p, i) => {
        const isActive = p.id === activePortfolioId;
        const count = p.type === 'local' ? String((p.holdings || []).length) : (currentUser ? dim('sync') : dim('6 demo'));
        const storage = p.type === 'supabase' ? `<span class="c-cyan">Supabase</span>` : p.type === 'demo' ? dim('Demo') : dim('Local');
        const activeMark = isActive ? pos('●') : dim('○');
        const num = String(i + 1);
        const viewLink = sc(`/portfolio ${num}`);
        const switchLink = !isActive ? sc(`/switchportfolio ${num}`) : dim('active');
        const deleteLink = p.id !== 'main' ? sc(`/deleteportfolio ${num}`) : dim('—');
        return [activeMark, dim(num), `<strong>${p.name}</strong>`, count, storage, `${viewLink}  ${switchLink}  ${deleteLink}`];
      });
      printRaw(panel('Portfolios', table(['', '#', 'Name', 'Holdings', 'Storage', 'Actions'], rows), `${portfolios.length} TOTAL`));
      printBlank();
      print(dim(`${sc('/newportfolio <name>')}  ·  ${sc('/compare <#> <#>')}  ·  ${sc('/renameportfolio <#> <name>')}`));
      printBlank();
      bindSlashCommands();
      scrollToBottom();
    },

    '/watchlist': async function() {
      showLoading('Fetching watchlist...');
      try {
        const [quotes, ...charts] = await Promise.all([
          fetchQuotes(watchlistSymbols),
          ...watchlistSymbols.map(s => fetchChartData(s).catch(() => null)),
        ]);
        hideLoading();
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
          [tn('MSFT'), '$415.20', fmtChange(1.20), dim('▁▂▃▄▅▆▇█▇▆▅▆▇█')],
          [tn('GOOGL'), '$152.87', fmtChange(0.82), dim('▃▄▅▄▃▄▅▆▇▆▅▆▇▆')],
          [tn('AMZN'), '$178.12', fmtChange(-0.31), dim('▆▇▆▅▄▃▂▃▄▅▄▃▂▃')],
          [tn('META'), '$501.33', fmtChange(2.08), dim('▂▃▄▅▆▇█▇▆▇████')],
          [tn('AMD'), '$168.90', fmtChange(-1.42), dim('█▇▆▅▄▃▂▃▄▃▂▁▂▃')],
        ];
        printRaw(panel('Watchlist', table(['Ticker', 'Price', 'Change', '30d'], rows), 'DEMO'));
      }
      printBlank();
      print(dim(`${sc('/quote')} <ticker> for details`));
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
    const isLocalPortfolio = activePortfolioId !== 'main';
    if (!isLocalPortfolio) {
      if (!supabaseEnabled()) { printLines([`<span class="c-red">Supabase not configured</span>`]); return; }
      if (!currentUser) { printLines([`<span class="c-yellow">Sign in first.</span> ${sc('/login')}`]); return; }
    }

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

    const activeMeta = getAllPortfolios().find(p => p.id === activePortfolioId);
    showLoading(`Adding ${qty} ${sym} to ${activeMeta?.name || 'portfolio'}...`);
    try {
      if (isLocalPortfolio) {
        addLocalHolding(activePortfolioId, sym, qty, cost, assetType);
      } else {
        await addHolding(sym, qty, cost, assetType, new Date().toISOString().split('T')[0]);
      }
      hideLoading();
      printLines([
        `<span class="c-green">Bought ${qty} × ${sym} @ ${fmtPrice(cost)}</span>  ${dim(ASSET_TYPES[assetType]?.icon + ' ' + ASSET_TYPES[assetType]?.label)}`,
        dim(`Total: ${fmtPrice(qty * cost)}  ·  ${sc('/portfolio')} to view  ·  Portfolio: ${activeMeta?.name || 'Main'}`),
      ]);
    } catch (e) {
      hideLoading();
      printLines([`<span class="c-red">Error:</span> ${e.message}`]);
    }
  }

  async function sellCmd(parts) {
    const isLocalPortfolio = activePortfolioId !== 'main';
    if (!isLocalPortfolio) {
      if (!supabaseEnabled()) { printLines([`<span class="c-red">Supabase not configured</span>`]); return; }
      if (!currentUser) { printLines([`<span class="c-yellow">Sign in first.</span> ${sc('/login')}`]); return; }
    }

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
      if (isLocalPortfolio) {
        sellLocalHolding(activePortfolioId, sym, qty);
      } else {
        await sellHolding(sym, qty, price);
      }
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
    const isLocalPortfolio = activePortfolioId !== 'main';
    if (!isLocalPortfolio) {
      if (!supabaseEnabled()) { printLines([`<span class="c-red">Supabase not configured</span>`]); return; }
      if (!currentUser) { printLines([`<span class="c-yellow">Sign in first.</span> ${sc('/login')}`]); return; }
    }
    if (parts.length < 2) { printLines([`<span class="c-red">Usage:</span> /remove <SYMBOL>`]); return; }
    const sym = parts[1].toUpperCase();
    showLoading(`Removing ${sym}...`);
    try {
      if (isLocalPortfolio) {
        removeLocalHolding(activePortfolioId, sym);
      } else {
        await removeHolding(sym);
      }
      hideLoading();
      printLines([`<span class="c-green">Removed ${sym}.</span> ${sc('/portfolio')}`]);
    } catch (e) {
      hideLoading();
      printLines([`<span class="c-red">Error:</span> ${e.message}`]);
    }
  }

  // ─── Portfolio management dynamic commands ────────────

  function newPortfolioCmd(nameParts) {
    const name = nameParts.join(' ').trim();
    if (!name) {
      printLines([`<span class="c-red">Usage:</span> /newportfolio <name>`, `${dim('Example:')} ${sc('/newportfolio Tech Stocks')}`]);
      return;
    }
    createLocalPortfolio(name);
    printLines([
      `<span class="c-green">Created portfolio:</span> <strong>${name}</strong>  ${dim('(now active)')}`,
      dim(`Use ${sc('/add')} to add holdings  ·  ${sc('/portfolios')} to list all`),
    ]);
  }

  function switchPortfolioCmd(arg) {
    if (!arg) { printLines([`<span class="c-red">Usage:</span> /switchportfolio <# or name>`]); return; }
    const p = getPortfolioByNameOrIndex(arg);
    if (!p) { printLines([`<span class="c-red">Portfolio not found:</span> ${arg}  ${dim('—')}  ${sc('/portfolios')} to list`]); return; }
    setActivePortfolio(p.id);
    printLines([
      `<span class="c-green">Active portfolio:</span> <strong>${p.name}</strong>`,
      dim(`/add, /sell, /remove now operate on this portfolio`),
    ]);
  }

  function deletePortfolioCmd(arg) {
    if (!arg) { printLines([`<span class="c-red">Usage:</span> /deleteportfolio <# or name>`]); return; }
    const p = getPortfolioByNameOrIndex(arg);
    if (!p) { printLines([`<span class="c-red">Portfolio not found:</span> ${arg}`]); return; }
    if (p.id === 'main') { printLines([`<span class="c-red">Cannot delete Main Portfolio.</span>`]); return; }
    deleteLocalPortfolio(p.id);
    printLines([`<span class="c-green">Deleted:</span> ${p.name}  ${dim('· Active set to Main')}`, sc('/portfolios')]);
  }

  function renamePortfolioCmd(parts) {
    if (parts.length < 2) { printLines([`<span class="c-red">Usage:</span> /renameportfolio <# or name> <new name>`]); return; }
    const p = getPortfolioByNameOrIndex(parts[0]);
    if (!p) { printLines([`<span class="c-red">Portfolio not found:</span> ${parts[0]}`]); return; }
    if (p.id === 'main') { printLines([`<span class="c-red">Cannot rename Main Portfolio.</span>`]); return; }
    const newName = parts.slice(1).join(' ');
    renameLocalPortfolio(p.id, newName);
    updatePortfolioUI();
    printLines([`<span class="c-green">Renamed to:</span> <strong>${newName}</strong>  ${sc('/portfolios')}`]);
  }

  async function compareCmd(arg1, arg2) {
    if (!arg1 || !arg2) {
      printLines([
        `<span class="c-red">Usage:</span> /compare <#> <#>`,
        `${dim('Example:')} ${sc('/compare 1 2')}`,
        dim(`Use ${sc('/portfolios')} to see portfolio numbers.`),
      ]);
      return;
    }
    const p1 = getPortfolioByNameOrIndex(arg1);
    const p2 = getPortfolioByNameOrIndex(arg2);
    if (!p1) { printLines([`<span class="c-red">Portfolio not found:</span> ${arg1}`]); return; }
    if (!p2) { printLines([`<span class="c-red">Portfolio not found:</span> ${arg2}`]); return; }

    showLoading(`Comparing ${p1.name} vs ${p2.name}...`);
    try {
      const [r1, r2] = await Promise.all([
        getHoldingsForPortfolio(p1.id),
        getHoldingsForPortfolio(p2.id),
      ]);

      const allSyms = [...new Set([...r1.holdings.map(h => h.sym), ...r2.holdings.map(h => h.sym)])];
      const data = allSyms.length > 0 ? await fetchQuotes(allSyms).catch(() => ({})) : {};
      hideLoading();

      function calcStats(holdings) {
        let totalValue = 0, totalPL = 0, totalCost = 0, totalDayPL = 0;
        holdings.forEach(h => {
          const q = data[h.sym];
          const price = q ? q.price : mockData[h.sym]?.price || 0;
          const change = q ? q.change : 0;
          const value = price * h.qty;
          totalValue += value;
          totalPL += (price - h.avgCost) * h.qty;
          totalCost += h.avgCost * h.qty;
          totalDayPL += value * change / 100;
        });
        const totalPLPct = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;
        const dayPct = totalValue > 0 ? (totalDayPL / (totalValue - totalDayPL || 1)) * 100 : 0;
        return { totalValue, totalPL, totalPLPct, totalDayPL, dayPct, count: holdings.length };
      }

      const s1 = calcStats(r1.holdings);
      const s2 = calcStats(r2.holdings);

      function cmpIndicator(v1, v2) {
        if (Math.abs(v1 - v2) < 0.001) return [dim('·'), dim('·')];
        return v1 > v2 ? [pos('▲'), neg('▼')] : [neg('▼'), pos('▲')];
      }

      const [tv1, tv2] = cmpIndicator(s1.totalValue, s2.totalValue);
      const [pl1, pl2] = cmpIndicator(s1.totalPLPct, s2.totalPLPct);
      const [dp1, dp2] = cmpIndicator(s1.dayPct, s2.dayPct);

      const summaryRows = [
        ['Total Value',
          `${fmtPrice(s1.totalValue)} ${tv1}`,
          `${fmtPrice(s2.totalValue)} ${tv2}`],
        ['Total P/L',
          `${fmtPL(s1.totalPL)} (${fmtPLPct(s1.totalPLPct)}) ${pl1}`,
          `${fmtPL(s2.totalPL)} (${fmtPLPct(s2.totalPLPct)}) ${pl2}`],
        ['Day P/L',
          `${fmtPL(s1.totalDayPL)} (${fmtPLPct(s1.dayPct)}) ${dp1}`,
          `${fmtPL(s2.totalDayPL)} (${fmtPLPct(s2.dayPct)}) ${dp2}`],
        ['Positions', String(s1.count), String(s2.count)],
      ];
      printRaw(panel(
        `Compare: ${p1.name} vs ${p2.name}`,
        table([dim('Metric'), `<strong>${p1.name}</strong>`, `<strong>${p2.name}</strong>`], summaryRows),
        'SIDE-BY-SIDE'
      ));

      // Holdings side by side
      function holdingsHtml(holdings, portfolioName) {
        if (holdings.length === 0) {
          return panel(portfolioName, dim('No holdings.'));
        }
        const rows = [...holdings]
          .map(h => {
            const q = data[h.sym];
            const price = q ? q.price : mockData[h.sym]?.price || 0;
            const change = q ? q.change : 0;
            const value = price * h.qty;
            const plPct = h.avgCost > 0 ? ((price / h.avgCost) - 1) * 100 : 0;
            return { sym: h.sym, value, change, plPct };
          })
          .sort((a, b) => b.value - a.value)
          .map(r => [tn(r.sym), fmtPrice(r.value), fmtChange(r.change), fmtPLPct(r.plPct)]);
        return panel(portfolioName, table(['Ticker', 'Value', 'Day', 'P/L%'], rows));
      }

      printRaw(`<div class="compare-grid">${holdingsHtml(r1.holdings, p1.name)}${holdingsHtml(r2.holdings, p2.name)}</div>`);

      // Allocation bars side by side
      function allocHtml(holdings, stats, portfolioName) {
        if (holdings.length === 0) return panel(`${portfolioName} · Allocation`, dim('No holdings.'));
        let bar = '<div class="alloc-bar">';
        [...holdings].sort((a, b) => {
          const qa = data[a.sym], qb = data[b.sym];
          return (qb ? qb.price * b.qty : 0) - (qa ? qa.price * a.qty : 0);
        }).forEach((h, i) => {
          const q = data[h.sym];
          const value = (q ? q.price : mockData[h.sym]?.price || 0) * h.qty;
          const pct = stats.totalValue > 0 ? (value / stats.totalValue * 100) : 0;
          const color = ALLOC_COLORS[i % ALLOC_COLORS.length];
          bar += `<div class="alloc-segment" style="width:${pct}%;background:${color}">${pct >= 10 ? h.sym : ''}</div>`;
        });
        bar += '</div>';
        return panel(`${portfolioName} · Allocation`, bar);
      }
      printRaw(`<div class="compare-grid">${allocHtml(r1.holdings, s1, p1.name)}${allocHtml(r2.holdings, s2, p2.name)}</div>`);

    } catch (e) {
      hideLoading();
      printLines([`<span class="c-red">Compare failed:</span> ${e.message}`]);
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
    if (!cmd.startsWith('/')) cmd = '/' + cmd;

    if (cmd === '/quote' || cmd === '/q' || cmd === '/price') quoteCmd(parts[1]);
    else if (cmd === '/chart' || cmd === '/c') chartCmd(parts[1]);
    else if (cmd === '/add' || cmd === '/buy') addCmd(parts);
    else if (cmd === '/sell') sellCmd(parts);
    else if (cmd === '/remove' || cmd === '/rm') removeCmd(parts);
    else if (cmd === '/portfolio') commands['/portfolio'](parts.slice(1).join(' ').trim() || null);
    else if (cmd === '/analytics') commands['/analytics'](parts.slice(1).join(' ').trim() || null);
    else if (cmd === '/newportfolio' || cmd === '/np') newPortfolioCmd(parts.slice(1));
    else if (cmd === '/compare' || cmd === '/cmp') compareCmd(parts[1], parts[2]);
    else if (cmd === '/switchportfolio' || cmd === '/switch' || cmd === '/sp') switchPortfolioCmd(parts.slice(1).join(' ').trim());
    else if (cmd === '/deleteportfolio' || cmd === '/dp') deletePortfolioCmd(parts.slice(1).join(' ').trim());
    else if (cmd === '/renameportfolio' || cmd === '/rp') renamePortfolioCmd(parts.slice(1));
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
    const now = new Date();
    document.getElementById('clock').textContent = [now.getHours(), now.getMinutes(), now.getSeconds()].map(n => String(n).padStart(2, '0')).join(':');
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
