// ═══════════════════════════════════════════════════════════
// WealthWatch Terminal - Interactive JS
// ═══════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ─── Session ID & Clock ───────────────────────────────
  const sessionId = Math.random().toString(36).substring(2, 10).toUpperCase();
  document.getElementById('session-id').textContent = sessionId;

  function updateClock() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    document.getElementById('clock').textContent = `${h}:${m}:${s} UTC`;
  }
  updateClock();
  setInterval(updateClock, 1000);

  // ─── Visitor count (fake but fun) ─────────────────────
  const base = 4821;
  const dayOffset = Math.floor((Date.now() - new Date('2025-01-01').getTime()) / 86400000);
  document.getElementById('visitor-count').textContent = (base + dayOffset * 7 + Math.floor(Math.random() * 12)).toLocaleString();

  // ─── Navigation ───────────────────────────────────────
  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.content-section');

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const target = item.dataset.section;

      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');

      sections.forEach(s => {
        s.classList.remove('active');
        if (s.id === target) s.classList.add('active');
      });
    });
  });

  // ─── Keyboard navigation ─────────────────────────────
  document.addEventListener('keydown', (e) => {
    const num = parseInt(e.key);
    if (num >= 1 && num <= navItems.length) {
      // Don't trigger if typing in the demo input
      if (document.activeElement === document.getElementById('demo-input')) return;
      navItems[num - 1].click();
    }
  });

  // ─── Ticker Bar ───────────────────────────────────────
  const tickers = [
    { sym: 'AAPL',    price: 189.84, change: +1.24 },
    { sym: 'NVDA',    price: 721.33, change: +3.87 },
    { sym: 'MSFT',    price: 415.20, change: +1.15 },
    { sym: 'GOOGL',   price: 152.87, change: +0.82 },
    { sym: 'AMZN',    price: 178.12, change: -0.31 },
    { sym: 'TSLA',    price: 231.45, change: -2.14 },
    { sym: 'META',    price: 501.33, change: +2.08 },
    { sym: 'AMD',     price: 168.90, change: -1.42 },
    { sym: 'BTC-USD', price: 67843,  change: +2.31 },
    { sym: 'ETH-USD', price: 3521,   change: +1.87 },
    { sym: 'S&P 500', price: 5842.31, change: +1.24 },
    { sym: 'DOW',     price: 43890,  change: +0.87 },
    { sym: 'NASDAQ',  price: 18563,  change: +1.67 },
    { sym: 'VIX',     price: 14.82,  change: -2.10 },
  ];

  function buildTicker() {
    const content = document.createElement('div');
    content.className = 'ticker-content';

    // Double for seamless scroll
    for (let i = 0; i < 2; i++) {
      tickers.forEach(t => {
        const item = document.createElement('span');
        item.className = 'ticker-item';
        const dir = t.change >= 0 ? 'up' : 'down';
        const arrow = t.change >= 0 ? '▲' : '▼';
        const sign = t.change >= 0 ? '+' : '';
        const priceStr = t.price >= 1000 ? t.price.toLocaleString() : t.price.toFixed(2);
        item.innerHTML = `<span class="ticker-symbol">${t.sym}</span> $${priceStr} <span class="ticker-${dir}">${sign}${t.change.toFixed(2)}% ${arrow}</span>`;
        content.appendChild(item);
      });
    }

    document.getElementById('ticker-bar').appendChild(content);
  }
  buildTicker();

  // ─── Interactive Demo Terminal ────────────────────────
  const demoInput = document.getElementById('demo-input');
  const demoOutput = document.getElementById('demo-output');

  const demoResponses = {
    help: `<span class="output-cyan">WealthWatch Terminal v1.0.0</span>

Available commands:
  <span class="output-green">quote &lt;ticker&gt;</span>   Get real-time stock quote
  <span class="output-green">market</span>           Major indices overview
  <span class="output-green">portfolio</span>        View portfolio with P&L
  <span class="output-green">watchlist</span>        View your watchlist
  <span class="output-green">news</span>             Latest financial headlines
  <span class="output-green">chart &lt;ticker&gt;</span>   ASCII price chart
  <span class="output-green">clear</span>            Clear terminal
  <span class="output-green">about</span>            About WealthWatch
  <span class="output-green">help</span>             Show this message`,

    market: `<span class="output-cyan">── MARKET OVERVIEW ─────────────────────────────</span>

  S&P 500    $5,842.31   <span class="output-green">+1.24%  ▲</span>
  DOW 30     $43,890.12  <span class="output-green">+0.87%  ▲</span>
  NASDAQ     $18,563.77  <span class="output-green">+1.67%  ▲</span>
  RUSSELL    $2,198.45   <span class="output-red">-0.32%  ▼</span>
  VIX        $14.82      <span class="output-yellow">-2.10%  ─</span>

<span class="output-cyan">── CRYPTO ──────────────────────────────────────</span>

  BTC/USD    $67,843.00  <span class="output-green">+2.31%  ▲</span>
  ETH/USD    $3,521.00   <span class="output-green">+1.87%  ▲</span>
  SOL/USD    $142.55     <span class="output-green">+4.12%  ▲</span>

  Last updated: just now`,

    portfolio: `<span class="output-cyan">── YOUR PORTFOLIO ──────────────────────────────</span>

  TICKER   QTY    AVG       LAST       P&L
  ──────────────────────────────────────────────
  AAPL     50    $171.20   $189.84   <span class="output-green">+$932.00   +10.9%</span>
  NVDA     25    $480.50   $721.33   <span class="output-green">+$6,020.75 +50.1%</span>
  TSLA     10    $248.90   $231.45   <span class="output-red">-$174.50    -7.0%</span>
  BTC      0.5   $42,100   $67,843   <span class="output-green">+$12,871   +30.6%</span>
  ──────────────────────────────────────────────
  TOTAL: $89,412.50   DAY: <span class="output-green">+$1,247.30 (+1.4%)</span>

  <span class="output-yellow">[i]</span> Sample data for demo purposes`,

    watchlist: `<span class="output-cyan">── WATCHLIST ───────────────────────────────────</span>

  MSFT    $415.20   <span class="output-green">+1.2%  ▲</span>   ▁▂▃▄▅▆▇█▇▆▅▆▇█
  GOOGL   $152.87   <span class="output-green">+0.8%  ▲</span>   ▃▄▅▄▃▄▅▆▇▆▅▆▇▆
  AMZN    $178.12   <span class="output-red">-0.3%  ▼</span>   ▆▇▆▅▄▃▂▃▄▅▄▃▂▃
  META    $501.33   <span class="output-green">+2.1%  ▲</span>   ▂▃▄▅▆▇█▇▆▇████
  AMD     $168.90   <span class="output-red">-1.4%  ▼</span>   █▇▆▅▄▃▂▃▄▃▂▁▂▃

  5 tickers tracked`,

    news: `<span class="output-cyan">── FINANCIAL NEWS ──────────────────────────────</span>

  <span class="output-green">[BULL]</span> Fed signals rate cuts ahead as inflation cools
  <span class="output-green">[BULL]</span> NVIDIA beats earnings expectations, AI demand surges
  <span class="output-red">[BEAR]</span> Treasury yields spike on labor market data
  <span class="output-yellow">[    ]</span> Apple unveils new AI features at developer event
  <span class="output-green">[BULL]</span> S&P 500 hits new all-time high for 2025
  <span class="output-red">[BEAR]</span> Oil prices jump on Middle East tensions

  Source: aggregated financial feeds`,

    about: `<span class="output-cyan">── ABOUT WEALTHWATCH ───────────────────────────</span>

  WealthWatch is a terminal-style finance dashboard
  built for investors who prefer data density over
  flashy UI.

  Inspired by Bloomberg terminals, htop, and retro
  CRT monitors. Every pixel earns its place.

  <span class="output-green">GitHub:</span>  github.com/Scolliq/wealthwatch
  <span class="output-green">Stack:</span>   Python + yfinance + vanilla HTML/CSS/JS
  <span class="output-green">License:</span> MIT
  <span class="output-green">Version:</span> 1.0.0`,

    clear: '__CLEAR__',
  };

  // Quote responses for individual tickers
  const tickerData = {
    AAPL:  { name: 'Apple Inc.',          price: 189.84, change: 1.24, high: 191.02, low: 187.33, vol: '52.3M',  cap: '2.94T' },
    NVDA:  { name: 'NVIDIA Corporation',  price: 721.33, change: 3.87, high: 728.50, low: 712.10, vol: '41.8M',  cap: '1.78T' },
    MSFT:  { name: 'Microsoft Corp.',     price: 415.20, change: 1.15, high: 418.90, low: 411.05, vol: '22.1M',  cap: '3.08T' },
    TSLA:  { name: 'Tesla Inc.',          price: 231.45, change: -2.14, high: 238.20, low: 229.80, vol: '78.4M', cap: '735B' },
    GOOGL: { name: 'Alphabet Inc.',       price: 152.87, change: 0.82, high: 154.10, low: 151.22, vol: '28.7M',  cap: '1.91T' },
    AMZN:  { name: 'Amazon.com Inc.',     price: 178.12, change: -0.31, high: 180.44, low: 176.88, vol: '34.2M', cap: '1.86T' },
    META:  { name: 'Meta Platforms',      price: 501.33, change: 2.08, high: 507.12, low: 498.60, vol: '18.5M',  cap: '1.28T' },
    AMD:   { name: 'AMD Inc.',            price: 168.90, change: -1.42, high: 172.33, low: 167.15, vol: '45.1M', cap: '273B' },
  };

  function generateQuote(ticker) {
    const t = tickerData[ticker.toUpperCase()];
    if (!t) {
      return `<span class="output-red">ERROR: Ticker '${ticker.toUpperCase()}' not found in demo data.</span>
<span class="output-yellow">Try: AAPL, NVDA, MSFT, TSLA, GOOGL, AMZN, META, AMD</span>`;
    }
    const dir = t.change >= 0 ? 'green' : 'red';
    const arrow = t.change >= 0 ? '▲' : '▼';
    const sign = t.change >= 0 ? '+' : '';
    return `<span class="output-cyan">── ${ticker.toUpperCase()} ─ ${t.name} ${'─'.repeat(Math.max(0, 35 - t.name.length))}</span>

  PRICE     <span class="output-${dir}">$${t.price.toFixed(2)}  ${sign}${t.change.toFixed(2)}%  ${arrow}</span>
  HIGH      $${t.high.toFixed(2)}
  LOW       $${t.low.toFixed(2)}
  VOLUME    ${t.vol}
  MKT CAP   $${t.cap}

  <span class="output-yellow">[i]</span> Demo data - not live`;
  }

  function generateChart(ticker) {
    const t = tickerData[ticker.toUpperCase()];
    if (!t) {
      return `<span class="output-red">ERROR: Ticker '${ticker.toUpperCase()}' not found.</span>`;
    }
    const base = t.price;
    return `<span class="output-cyan">── ${ticker.toUpperCase()} PRICE CHART (30D) ─────────────────</span>

  $${(base * 1.02).toFixed(0)} ┤                                    ╭──
  $${(base * 1.00).toFixed(0)} ┤                         ╭──╮   ╭──╯
  $${(base * 0.98).toFixed(0)} ┤             ╭───╮  ╭────╯  ╰───╯
  $${(base * 0.96).toFixed(0)} ┤        ╭────╯   ╰──╯
  $${(base * 0.94).toFixed(0)} ┤   ╭────╯
  $${(base * 0.92).toFixed(0)} ┤───╯
         └────────────────────────────────────
          -30d          -15d            now`;
  }

  function processCommand(input) {
    const parts = input.trim().toLowerCase().split(/\s+/);
    const cmd = parts[0];
    const arg = parts[1];

    if (demoResponses[cmd]) {
      return demoResponses[cmd];
    }

    if ((cmd === 'quote' || cmd === 'price' || cmd === 'q') && arg) {
      return generateQuote(arg);
    }

    if ((cmd === 'chart' || cmd === 'c') && arg) {
      return generateChart(arg);
    }

    if (cmd === '') return '';

    return `<span class="output-red">Unknown command: '${cmd}'</span>
Type <span class="output-green">help</span> for available commands.`;
  }

  if (demoInput) {
    demoInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = demoInput.value.trim();
        if (!val) return;

        const result = processCommand(val);

        if (result === '__CLEAR__') {
          demoOutput.innerHTML = '';
          demoInput.value = '';
          return;
        }

        const echo = document.createElement('div');
        echo.className = 'output-line cmd-echo';
        echo.textContent = `$ ${val}`;
        demoOutput.appendChild(echo);

        if (result) {
          const out = document.createElement('div');
          out.className = 'output-line';
          out.innerHTML = result;
          demoOutput.appendChild(out);

          const spacer = document.createElement('div');
          spacer.style.height = '12px';
          demoOutput.appendChild(spacer);
        }

        demoInput.value = '';
        demoOutput.scrollTop = demoOutput.scrollHeight;
      }
    });
  }

  // ─── Typing animation on first load ──────────────────
  const banner = document.getElementById('banner');
  if (banner && window.innerWidth > 600) {
    const text = banner.textContent;
    banner.textContent = '';
    banner.style.visibility = 'visible';
    let i = 0;
    const speed = 3;
    function typeBanner() {
      if (i < text.length) {
        banner.textContent += text.charAt(i);
        i++;
        setTimeout(typeBanner, speed);
      }
    }
    typeBanner();
  }

})();
