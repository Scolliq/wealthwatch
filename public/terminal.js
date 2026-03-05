// ═══════════════════════════════════════════════════════════
// WealthWatch Terminal — CLI with modern card rendering
// ═══════════════════════════════════════════════════════════

(function () {
  'use strict';

  const output = document.getElementById('output');
  const input = document.getElementById('cmd-input');
  const commandHistory = [];
  let historyIndex = -1;

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
  function dim(t) { return `<span class="c-dim">${t}</span>`; }

  // ─── Card builder ─────────────────────────────────────

  function card(title, content) {
    return `<div class="out-card"><div class="out-card-header">${title}</div>${content}</div>`;
  }

  function table(headers, rows, footerRow) {
    let h = '<tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr>';
    let r = rows.map(row =>
      '<tr>' + row.map(cell => `<td>${cell}</td>`).join('') + '</tr>'
    ).join('');
    let f = '';
    if (footerRow) {
      f = '<tr class="out-row-total">' + footerRow.map(cell => `<td>${cell}</td>`).join('') + '</tr>';
    }
    return `<table class="out-table"><thead>${h}</thead><tbody>${r}${f}</tbody></table>`;
  }

  function tag(type, text) { return `<span class="tag tag-${type}">${text}</span>`; }
  function pos(t) { return `<span class="positive">${t}</span>`; }
  function neg(t) { return `<span class="negative">${t}</span>`; }
  function tn(t) { return `<span class="ticker-name">${t}</span>`; }

  // ─── Boot ─────────────────────────────────────────────

  function boot() {
    print(`<span class="c-blue c-bold">Welcome to WealthWatch</span>`);
    print(`<span class="c-muted">Your terminal-powered finance dashboard. Type a command to begin.</span>`);
    printBlank();
    print(`<span class="c-muted">Commands:</span>`);
    printBlank();
    print(`  ${sc('/market')}         Market overview & indices`);
    print(`  ${sc('/portfolio')}      Portfolio positions & P/L`);
    print(`  ${sc('/quote AAPL')}     Stock / crypto quote`);
    print(`  ${sc('/chart NVDA')}     ASCII price chart`);
    print(`  ${sc('/watchlist')}      Tracked tickers`);
    print(`  ${sc('/alerts')}         Price alert status`);
    print(`  ${sc('/news')}           Financial headlines`);
    print(`  ${sc('/about')}          About WealthWatch`);
    print(`  ${sc('/stack')}          Tech stack & architecture`);
    print(`  ${sc('/help')}           All commands`);
    print(`  ${sc('/clear')}          Clear terminal`);
    printBlank();
    print(`${dim('Click any')} ${sc('/command')} ${dim('or type below. Arrow keys for history.')}`);
    printBlank();
    bindSlashCommands();
    scrollToBottom();
  }

  // ─── Ticker data ──────────────────────────────────────

  const tickerData = {
    AAPL:  { name: 'Apple Inc.',          price: 189.84, change: 1.24, high: 191.02, low: 187.33, vol: '52.3M',  cap: '2.94T' },
    NVDA:  { name: 'NVIDIA Corporation',  price: 721.33, change: 3.87, high: 728.50, low: 712.10, vol: '41.8M',  cap: '1.78T' },
    MSFT:  { name: 'Microsoft Corp.',     price: 415.20, change: 1.15, high: 418.90, low: 411.05, vol: '22.1M',  cap: '3.08T' },
    TSLA:  { name: 'Tesla Inc.',          price: 231.45, change: -2.14, high: 238.20, low: 229.80, vol: '78.4M', cap: '735B' },
    GOOGL: { name: 'Alphabet Inc.',       price: 152.87, change: 0.82, high: 154.10, low: 151.22, vol: '28.7M',  cap: '1.91T' },
    AMZN:  { name: 'Amazon.com Inc.',     price: 178.12, change: -0.31, high: 180.44, low: 176.88, vol: '34.2M', cap: '1.86T' },
    META:  { name: 'Meta Platforms',      price: 501.33, change: 2.08, high: 507.12, low: 498.60, vol: '18.5M',  cap: '1.28T' },
    AMD:   { name: 'AMD Inc.',            price: 168.90, change: -1.42, high: 172.33, low: 167.15, vol: '45.1M', cap: '273B' },
    SPY:   { name: 'SPDR S&P 500 ETF',   price: 584.23, change: 1.24, high: 586.10, low: 581.05, vol: '68.2M', cap: '538B' },
    'BTC-USD': { name: 'Bitcoin',         price: 67843,  change: 2.31, high: 68900, low: 66200, vol: '28.4B',  cap: '1.33T' },
    'ETH-USD': { name: 'Ethereum',        price: 3521,   change: 1.87, high: 3580, low: 3455, vol: '14.1B',   cap: '423B' },
  };

  function fmtPrice(p) { return p >= 1000 ? '$' + p.toLocaleString() : '$' + p.toFixed(2); }
  function fmtChange(c) {
    const s = c >= 0 ? '+' : '';
    const cls = c >= 0 ? 'positive' : 'negative';
    const arrow = c >= 0 ? '▲' : '▼';
    return `<span class="${cls}">${s}${c.toFixed(2)}% ${arrow}</span>`;
  }

  // ─── Commands ─────────────────────────────────────────

  const commands = {

    '/help': function() {
      printLines([
        `<span class="c-blue c-bold">Available Commands</span>`,
        '',
        `  ${sc('/market')}                  Live market indices & crypto`,
        `  ${sc('/portfolio')}               Portfolio positions & P/L`,
        `  ${sc('/quote')} ${dim('<ticker>')}          Real-time stock quote`,
        `  ${sc('/chart')} ${dim('<ticker>')}          ASCII price chart (30d)`,
        `  ${sc('/watchlist')}               Tracked tickers with sparklines`,
        `  ${sc('/alerts')}                  Active price alerts`,
        `  ${sc('/news')}                    Latest financial headlines`,
        '',
        `  ${sc('/about')}                   About WealthWatch`,
        `  ${sc('/stack')}                   Tech stack & architecture`,
        `  ${sc('/help')}                    This help menu`,
        `  ${sc('/clear')}                   Clear terminal`,
        '',
        `${dim('Tip: Click any /command or type it. Arrow ↑↓ for history.')}`,
      ]);
    },

    '/market': function() {
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

      printRaw(card('Market Overview', table(['Index', 'Price', 'Change'], mkRows(indices))));
      printRaw(card('Crypto', table(['Asset', 'Price', 'Change'], mkRows(crypto))));
      printBlank();
      print(dim(`Updated: just now  ·  Source: Yahoo Finance  ·  Try ${sc('/quote AAPL')}`));
      printBlank();
      bindSlashCommands();
      scrollToBottom();
    },

    '/portfolio': function() {
      const rows = [
        [tn('AAPL'),    '50',  '$171.20', '$189.84', pos('+$932.00'),    pos('+10.9%')],
        [tn('NVDA'),    '25',  '$480.50', '$721.33', pos('+$6,020.75'),  pos('+50.1%')],
        [tn('TSLA'),    '10',  '$248.90', '$231.45', neg('-$174.50'),    neg('-7.0%')],
        [tn('BTC-USD'), '0.5', '$42,100', '$67,843', pos('+$12,871.50'), pos('+30.6%')],
      ];
      const footer = ['', '', '', '<strong>Total</strong>', pos('<strong>$89,412.50</strong>'), pos('<strong>+$1,247.30</strong>')];

      printRaw(card('Portfolio', table(['Ticker', 'Qty', 'Avg Cost', 'Last', 'P/L', '%'], rows, footer)));
      printBlank();
      print(dim(`Sample data  ·  Try ${sc('/chart AAPL')} for price history`));
      printBlank();
      bindSlashCommands();
      scrollToBottom();
    },

    '/watchlist': function() {
      const rows = [
        [tn('MSFT'),  '$415.20', fmtChange(1.20),  '<span class="c-dim">▁▂▃▄▅▆▇█▇▆▅▆▇█</span>'],
        [tn('GOOGL'), '$152.87', fmtChange(0.82),   '<span class="c-dim">▃▄▅▄▃▄▅▆▇▆▅▆▇▆</span>'],
        [tn('AMZN'),  '$178.12', fmtChange(-0.31),  '<span class="c-dim">▆▇▆▅▄▃▂▃▄▅▄▃▂▃</span>'],
        [tn('META'),  '$501.33', fmtChange(2.08),   '<span class="c-dim">▂▃▄▅▆▇█▇▆▇████</span>'],
        [tn('AMD'),   '$168.90', fmtChange(-1.42),  '<span class="c-dim">█▇▆▅▄▃▂▃▄▃▂▁▂▃</span>'],
      ];

      printRaw(card('Watchlist', table(['Ticker', 'Price', 'Change', '30d'], rows)));
      printBlank();
      print(dim(`5 tickers tracked  ·  ${sc('/quote')} <ticker> for details`));
      printBlank();
      bindSlashCommands();
      scrollToBottom();
    },

    '/alerts': function() {
      const rows = [
        [tag('neutral', '!'), tn('NVDA'),    'Above $750.00',  tag('neutral', 'watching')],
        [tag('neutral', '!'), tn('BTC-USD'), 'Above $70,000',  tag('neutral', 'watching')],
        [tag('bull', '✓'),    tn('AAPL'),    'Above $185.00',  tag('bull', 'triggered')],
      ];

      printRaw(card('Price Alerts', table(['', 'Ticker', 'Condition', 'Status'], rows)));
      printBlank();
      print(dim('3 active alerts  ·  Polling every 60s'));
      printBlank();
      scrollToBottom();
    },

    '/news': function() {
      const items = [
        [tag('bull', 'bull'),    'Fed signals rate cuts ahead as inflation cools'],
        [tag('bull', 'bull'),    'NVIDIA beats earnings expectations, AI demand surges'],
        [tag('bear', 'bear'),    'Treasury yields spike on labor market data'],
        [tag('neutral', '—'),    'Apple unveils new AI features at developer event'],
        [tag('bull', 'bull'),    'S&P 500 hits new all-time high'],
        [tag('bear', 'bear'),    'Oil prices jump on Middle East tensions'],
      ];

      printRaw(card('Financial News', table(['Signal', 'Headline'], items)));
      printBlank();
      print(dim('Source: aggregated financial feeds'));
      printBlank();
      scrollToBottom();
    },

    '/about': function() {
      printLines([
        `<span class="c-blue c-bold">About WealthWatch</span>`,
        '',
        `WealthWatch is a terminal-style finance dashboard for`,
        `tracking markets, portfolios, and financial data in real time.`,
        '',
        `No bloat. No clutter. Just raw data at your fingertips —`,
        `the way Wall Street terminals were meant to feel.`,
        '',
        `  <span class="c-blue">Markets</span>      Real-time quotes for stocks, ETFs, crypto`,
        `  <span class="c-blue">Portfolio</span>    Track positions with live P/L calculations`,
        `  <span class="c-blue">Watchlist</span>    Monitor favorites with sparkline charts`,
        `  <span class="c-blue">Alerts</span>       Price triggers with 60s polling`,
        `  <span class="c-blue">News</span>         Aggregated headlines with sentiment tags`,
        `  <span class="c-blue">Charts</span>       ASCII sparklines and candlestick views`,
        '',
        `${dim('GitHub:')}   github.com/Scolliq/wealthwatch`,
        `${dim('License:')}  MIT`,
        `${dim('Status:')}   <span class="c-green">● Operational</span>`,
      ]);
    },

    '/stack': function() {
      printLines([
        `<span class="c-blue c-bold">Architecture</span>`,
        '',
        `  ┌──────────┐    ┌──────────┐    ┌──────────┐`,
        `  │ <span class="c-blue">FRONTEND</span> │───▶│ <span class="c-blue">API</span>      │───▶│ <span class="c-blue">DATA</span>     │`,
        `  │ Terminal  │    │ Server   │    │ Feeds    │`,
        `  │ UI / Web  │◀───│ WebSocket│◀───│ Yahoo    │`,
        `  └──────────┘    └──────────┘    └──────────┘`,
        '',
        `<span class="c-blue c-bold">Tech Stack</span>`,
        '',
        `  <span class="c-blue">Frontend</span>`,
        `  ├── HTML/CSS/JS       Vanilla, no framework bloat`,
        `  ├── Terminal UI        CRT aesthetic + modern cards`,
        `  ├── Responsive         Works on mobile + desktop`,
        `  └── Vercel             Zero-config static hosting`,
        '',
        `  <span class="c-blue">Backend</span>`,
        `  ├── Python 3.11+       Core runtime`,
        `  ├── yfinance           Market data feeds`,
        `  ├── APScheduler        Background alert polling`,
        `  └── JSON storage       Lightweight persistence`,
        '',
        `  <span class="c-blue">Data Sources</span>`,
        `  ├── Yahoo Finance      Stocks, ETFs, crypto, indices`,
        `  ├── NewsAPI            Financial headlines`,
        `  └── Alpha Vantage      Extended market data`,
        '',
        `<span class="c-blue c-bold">Design Philosophy</span>`,
        '',
        `  ${dim('>')} "Information density over eye candy"`,
        `  ${dim('>')} "Bloomberg terminal meets hacker aesthetic"`,
        `  ${dim('>')} "Every pixel earns its place"`,
      ]);
    },

    '/clear': function() {
      output.innerHTML = '';
    },
  };

  // ─── Dynamic commands ─────────────────────────────────

  function quoteCmd(ticker) {
    if (!ticker) {
      printLines([
        `<span class="c-red">Usage:</span> /quote &lt;ticker&gt;`,
        `${dim('Example:')} ${sc('/quote AAPL')}`,
        '',
        dim('Available: AAPL, NVDA, MSFT, TSLA, GOOGL, AMZN, META, AMD, SPY, BTC-USD, ETH-USD'),
      ]);
      return;
    }
    const t = tickerData[ticker.toUpperCase()];
    if (!t) {
      printLines([
        `<span class="c-red">Ticker not found:</span> ${ticker.toUpperCase()}`,
        dim('Available: AAPL, NVDA, MSFT, TSLA, GOOGL, AMZN, META, AMD, SPY, BTC-USD, ETH-USD'),
      ]);
      return;
    }

    const rows = [
      ['Price',      `<strong>${fmtPrice(t.price)}</strong>`, fmtChange(t.change)],
      ['Day High',   fmtPrice(t.high), ''],
      ['Day Low',    fmtPrice(t.low), ''],
      ['Volume',     t.vol, ''],
      ['Market Cap', '$' + t.cap, ''],
    ];

    printRaw(card(
      `${ticker.toUpperCase()} · ${t.name}`,
      table(['Metric', 'Value', ''], rows)
    ));
    printBlank();
    print(dim(`Demo data  ·  Try ${sc('/chart ' + ticker.toUpperCase())} for price history`));
    printBlank();
    bindSlashCommands();
    scrollToBottom();
  }

  function chartCmd(ticker) {
    if (!ticker) {
      printLines([
        `<span class="c-red">Usage:</span> /chart &lt;ticker&gt;`,
        `${dim('Example:')} ${sc('/chart NVDA')}`,
      ]);
      return;
    }
    const t = tickerData[ticker.toUpperCase()];
    if (!t) {
      printLines([`<span class="c-red">Ticker not found:</span> ${ticker.toUpperCase()}`]);
      return;
    }
    const b = t.price;
    const chartLines = [
      `  ${fmtPrice(b*1.04).padStart(8)} ┤                                      ╭──`,
      `  ${fmtPrice(b*1.02).padStart(8)} ┤                           ╭──╮   ╭──╯`,
      `  ${fmtPrice(b*1.00).padStart(8)} ┤           ╭───╮      ╭────╯  ╰───╯`,
      `  ${fmtPrice(b*0.98).padStart(8)} ┤      ╭────╯   ╰──────╯`,
      `  ${fmtPrice(b*0.96).padStart(8)} ┤ ╭────╯`,
      `  ${fmtPrice(b*0.94).padStart(8)} ┤─╯`,
      `           └──────────────────────────────────────`,
      `  ${dim('         -30d              -15d              now')}`,
    ];

    printRaw(card(
      `${ticker.toUpperCase()} · Price Chart (30D)`,
      `<div style="padding:4px 0">${chartLines.join('\n')}</div>`
    ));
    printBlank();
    bindSlashCommands();
    scrollToBottom();
  }

  // ─── Router ───────────────────────────────────────────

  function runCommand(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return;

    print(`<span class="cmd-echo">&gt; ${trimmed}</span>`);
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
        `<span class="c-red">'${trimmed}'</span> is not a recognized command.`,
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

  // Click anywhere focuses input
  document.addEventListener('click', (e) => {
    if (!window.getSelection().toString() && !e.target.closest('a')) input.focus();
  });

  // Nav slash commands
  document.querySelectorAll('.slash-nav').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const cmd = el.dataset.cmd;
      if (cmd) {
        document.getElementById('terminal-section').scrollIntoView({ behavior: 'smooth' });
        setTimeout(() => runCommand(cmd), 300);
      }
    });
  });

  // ─── Ticker bar ───────────────────────────────────────

  const tickers = [
    { sym: 'AAPL', price: 189.84, change: 1.24 },
    { sym: 'NVDA', price: 721.33, change: 3.87 },
    { sym: 'MSFT', price: 415.20, change: 1.15 },
    { sym: 'GOOGL', price: 152.87, change: 0.82 },
    { sym: 'AMZN', price: 178.12, change: -0.31 },
    { sym: 'TSLA', price: 231.45, change: -2.14 },
    { sym: 'META', price: 501.33, change: 2.08 },
    { sym: 'AMD', price: 168.90, change: -1.42 },
    { sym: 'BTC', price: 67843, change: 2.31 },
    { sym: 'ETH', price: 3521, change: 1.87 },
    { sym: 'S&P', price: 5842.31, change: 1.24 },
    { sym: 'DOW', price: 43890, change: 0.87 },
  ];

  const tc = document.createElement('div');
  tc.className = 'ticker-content';
  for (let i = 0; i < 2; i++) {
    tickers.forEach(t => {
      const item = document.createElement('span');
      item.className = 'ticker-item';
      const dir = t.change >= 0 ? 'up' : 'down';
      const arrow = t.change >= 0 ? '▲' : '▼';
      const sign = t.change >= 0 ? '+' : '';
      const p = t.price >= 1000 ? t.price.toLocaleString() : t.price.toFixed(2);
      item.innerHTML = `<span class="ticker-symbol">${t.sym}</span> $${p} <span class="ticker-${dir}">${sign}${t.change.toFixed(2)}% ${arrow}</span>`;
      tc.appendChild(item);
    });
  }
  document.getElementById('ticker-bar').appendChild(tc);

  // ─── Boot ─────────────────────────────────────────────
  boot();

})();
