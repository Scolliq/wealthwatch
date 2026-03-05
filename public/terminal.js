// ═══════════════════════════════════════════════════════════
// WealthWatch Terminal - CLI-driven interface
// ═══════════════════════════════════════════════════════════

(function () {
  'use strict';

  const output = document.getElementById('output');
  const input = document.getElementById('cmd-input');
  const commandHistory = [];
  let historyIndex = -1;

  // ─── Rendering helpers ────────────────────────────────

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

  function scrollToBottom() {
    window.scrollTo(0, document.body.scrollHeight);
    input.focus();
  }

  function printBlock(lines) {
    lines.forEach(l => print(l));
    printBlank();
    scrollToBottom();
  }

  // Make slash commands clickable
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

  // ─── Boot sequence ────────────────────────────────────

  function boot() {
    const banner = [
      '<span class="c-green c-bold"> __        __         _ _   _  __        __    _       _    </span>',
      '<span class="c-green c-bold"> \\ \\      / /__  __ _| | |_| |_\\ \\      / /_ _| |_ ___| |__ </span>',
      '<span class="c-green c-bold">  \\ \\ /\\ / / _ \\/ _` | | __| \'_ \\ \\ /\\ / / _` | __/ __| \'_ \\</span>',
      '<span class="c-green c-bold">   \\ V  V /  __/ (_| | | |_| | | \\ V  V / (_| | || (__| | | |</span>',
      '<span class="c-green c-bold">    \\_/\\_/ \\___|\\__,_|_|\\__|_| |_|\\_/\\_/ \\__,_|\\__\\___|_| |_|</span>',
    ];
    banner.forEach(l => print(l));
    printBlank();
    print('<span class="c-cyan">  Real-Time Finance Terminal for the Modern Investor</span>');
    print('<span class="c-dim">  ────────────────────────────────────────────────────</span>');
    printBlank();
    print('  Welcome to <span class="c-green c-bold">WealthWatch</span>. Type a command to get started.');
    printBlank();
    print('  <span class="c-yellow c-bold">Available commands:</span>');
    printBlank();
    print('    <span class="slash-cmd">/market</span>         Live market overview');
    print('    <span class="slash-cmd">/portfolio</span>      View portfolio & P/L');
    print('    <span class="slash-cmd">/quote AAPL</span>     Get a stock quote');
    print('    <span class="slash-cmd">/chart NVDA</span>     ASCII price chart');
    print('    <span class="slash-cmd">/watchlist</span>      Your tracked tickers');
    print('    <span class="slash-cmd">/alerts</span>         Price alert status');
    print('    <span class="slash-cmd">/news</span>           Financial headlines');
    print('    <span class="slash-cmd">/about</span>          About WealthWatch');
    print('    <span class="slash-cmd">/stack</span>          Tech stack & architecture');
    print('    <span class="slash-cmd">/help</span>           Show all commands');
    print('    <span class="slash-cmd">/clear</span>          Clear terminal');
    printBlank();
    print('  <span class="c-dim">Tip: Click any</span> <span class="c-cyan">/command</span> <span class="c-dim">or type it below.</span>');
    print('<span class="c-dim">  ────────────────────────────────────────────────────</span>');
    printBlank();
    bindSlashCommands();
    scrollToBottom();
  }

  // ─── Command definitions ──────────────────────────────

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

  function cc(cls, text) { return `<span class="${cls}">${text}</span>`; }
  function green(t) { return cc('c-green', t); }
  function red(t) { return cc('c-red', t); }
  function cyan(t) { return cc('c-cyan', t); }
  function yellow(t) { return cc('c-yellow', t); }
  function dim(t) { return cc('c-dim', t); }
  function bold(t) { return cc('c-bold', t); }
  function gb(t) { return cc('c-green c-bold', t); }
  function sc(cmd) { return `<span class="slash-cmd">${cmd}</span>`; }

  const commands = {

    '/help': function() {
      printBlock([
        cyan('━━━ COMMANDS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'),
        '',
        `  ${sc('/market')}                Live market indices & crypto`,
        `  ${sc('/portfolio')}             View portfolio positions & P/L`,
        `  ${sc('/quote')} ${dim('<ticker>')}        Get real-time stock quote`,
        `  ${sc('/chart')} ${dim('<ticker>')}        ASCII price chart (30 day)`,
        `  ${sc('/watchlist')}             View tracked tickers with sparklines`,
        `  ${sc('/alerts')}                Active price alerts`,
        `  ${sc('/news')}                  Latest financial headlines`,
        '',
        cyan('━━━ INFO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'),
        '',
        `  ${sc('/about')}                 About WealthWatch`,
        `  ${sc('/stack')}                 Tech stack & architecture`,
        `  ${sc('/help')}                  This help menu`,
        `  ${sc('/clear')}                 Clear the terminal`,
        '',
        dim('  Tip: Click any /command or type it and press Enter'),
        '',
      ]);
      bindSlashCommands();
    },

    '/market': function() {
      printBlock([
        cyan('━━━ MARKET OVERVIEW ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'),
        '',
        `  S&P 500     $5,842.31    ${green('+1.24%  ▲')}   ████████████████░░`,
        `  DOW 30      $43,890.12   ${green('+0.87%  ▲')}   ███████████████░░░`,
        `  NASDAQ      $18,563.77   ${green('+1.67%  ▲')}   █████████████████░`,
        `  RUSSELL 2K  $2,198.45    ${red('-0.32%  ▼')}   ██████████░░░░░░░░`,
        `  VIX         $14.82       ${yellow('-2.10%  ─')}   █████░░░░░░░░░░░░░`,
        '',
        cyan('━━━ CRYPTO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'),
        '',
        `  BTC/USD     $67,843.00   ${green('+2.31%  ▲')}`,
        `  ETH/USD     $3,521.00    ${green('+1.87%  ▲')}`,
        `  SOL/USD     $142.55      ${green('+4.12%  ▲')}`,
        '',
        dim('  Updated: just now  |  Source: Yahoo Finance'),
        '',
        dim(`  Try ${sc('/quote AAPL')} for individual stocks`),
        '',
      ]);
      bindSlashCommands();
    },

    '/portfolio': function() {
      printBlock([
        cyan('━━━ PORTFOLIO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'),
        '',
        dim('  TICKER    QTY    AVG COST    LAST        P/L           %'),
        dim('  ─────────────────────────────────────────────────────────'),
        `  AAPL      50     $171.20     $189.84     ${green('+$932.00')}     ${green('+10.9%')}`,
        `  NVDA      25     $480.50     $721.33     ${green('+$6,020.75')}   ${green('+50.1%')}`,
        `  TSLA      10     $248.90     $231.45     ${red('-$174.50')}      ${red('-7.0%')}`,
        `  BTC-USD   0.5    $42,100     $67,843     ${green('+$12,871.50')}  ${green('+30.6%')}`,
        dim('  ─────────────────────────────────────────────────────────'),
        `  TOTAL VALUE: $89,412.50      DAY P/L: ${green('+$1,247.30 (+1.4%)')}`,
        '',
        dim('  Sample data for demo  |  ') + dim(`Try ${sc('/chart AAPL')} for price history`),
        '',
      ]);
      bindSlashCommands();
    },

    '/watchlist': function() {
      printBlock([
        cyan('━━━ WATCHLIST ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'),
        '',
        `  MSFT     $415.20    ${green('+1.2%  ▲')}    ▁▂▃▄▅▆▇█▇▆▅▆▇█`,
        `  GOOGL    $152.87    ${green('+0.8%  ▲')}    ▃▄▅▄▃▄▅▆▇▆▅▆▇▆`,
        `  AMZN     $178.12    ${red('-0.3%  ▼')}    ▆▇▆▅▄▃▂▃▄▅▄▃▂▃`,
        `  META     $501.33    ${green('+2.1%  ▲')}    ▂▃▄▅▆▇█▇▆▇████`,
        `  AMD      $168.90    ${red('-1.4%  ▼')}    █▇▆▅▄▃▂▃▄▃▂▁▂▃`,
        '',
        dim('  5 tickers tracked  |  ') + dim(`${sc('/quote')} <ticker> for details`),
        '',
      ]);
      bindSlashCommands();
    },

    '/alerts': function() {
      printBlock([
        cyan('━━━ PRICE ALERTS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'),
        '',
        `  ${yellow('[!]')}  NVDA     above $750.00      Status: ${yellow('WATCHING')}`,
        `  ${yellow('[!]')}  BTC-USD  above $70,000      Status: ${yellow('WATCHING')}`,
        `  ${green('[*]')}  AAPL     above $185.00      Status: ${green('TRIGGERED')}`,
        '',
        dim('  3 active alerts  |  Polling every 60s'),
        '',
      ]);
    },

    '/news': function() {
      printBlock([
        cyan('━━━ FINANCIAL NEWS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'),
        '',
        `  ${green('[BULL]')}  Fed signals rate cuts ahead as inflation cools`,
        `  ${green('[BULL]')}  NVIDIA beats earnings expectations, AI demand surges`,
        `  ${red('[BEAR]')}  Treasury yields spike on labor market data`,
        `  ${dim('[    ]')}  Apple unveils new AI features at developer event`,
        `  ${green('[BULL]')}  S&P 500 hits new all-time high`,
        `  ${red('[BEAR]')}  Oil prices jump on Middle East tensions`,
        '',
        dim('  Source: aggregated financial feeds'),
        '',
      ]);
    },

    '/about': function() {
      printBlock([
        cyan('━━━ ABOUT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'),
        '',
        '  WealthWatch is a terminal-style finance dashboard',
        '  for tracking markets, portfolios, and financial data',
        '  in real time.',
        '',
        '  No bloat. No clutter. Just raw data at your',
        '  fingertips -- the way Wall Street terminals were',
        '  meant to feel.',
        '',
        `  ┌────────────┐  ┌────────────┐  ┌────────────┐`,
        `  │ ${cyan('MARKETS')}    │  │ ${cyan('PORTFOLIO')} │  │ ${cyan('ALERTS')}     │`,
        `  │  Real-time │  │  Track P/L │  │  Price     │`,
        `  │  quotes    │  │  positions │  │  triggers  │`,
        `  └────────────┘  └────────────┘  └────────────┘`,
        '',
        `  ┌────────────┐  ┌────────────┐  ┌────────────┐`,
        `  │ ${cyan('WATCHLIST')} │  │ ${cyan('NEWS')}       │  │ ${cyan('CHARTS')}     │`,
        `  │  Track     │  │  Headlines │  │  ASCII     │`,
        `  │  favorites │  │  & feeds   │  │  sparklines│`,
        `  └────────────┘  └────────────┘  └────────────┘`,
        '',
        `  ${green('GitHub:')}   github.com/Scolliq/wealthwatch`,
        `  ${green('License:')}  MIT`,
        `  ${green('Status:')}   ${green('● Operational')}`,
        '',
      ]);
    },

    '/stack': function() {
      printBlock([
        cyan('━━━ ARCHITECTURE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'),
        '',
        `     ┌──────────┐    ┌──────────┐    ┌──────────┐`,
        `     │ ${cyan('FRONTEND')} │───▶│ ${cyan('API')}      │───▶│ ${cyan('DATA')}     │`,
        `     │ Terminal  │    │ Server   │    │ Feeds    │`,
        `     │ UI / Web  │◀───│ WebSocket│◀───│ Yahoo    │`,
        `     └──────────┘    └──────────┘    └──────────┘`,
        '',
        cyan('━━━ TECH STACK ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'),
        '',
        `  ${cyan('FRONTEND')}`,
        `  ├── HTML/CSS/JS       Vanilla, no framework bloat`,
        `  ├── Terminal UI        CRT aesthetic + ASCII art`,
        `  ├── Responsive         Works on mobile + desktop`,
        `  └── Vercel             Zero-config static hosting`,
        '',
        `  ${cyan('BACKEND')}`,
        `  ├── Python 3.11+       Core runtime`,
        `  ├── yfinance           Market data feeds`,
        `  ├── APScheduler        Background alert polling`,
        `  └── JSON storage       Lightweight persistence`,
        '',
        `  ${cyan('DATA SOURCES')}`,
        `  ├── Yahoo Finance      Stocks, ETFs, crypto, indices`,
        `  ├── NewsAPI            Financial headlines`,
        `  └── Alpha Vantage      Extended market data`,
        '',
        cyan('━━━ DESIGN PHILOSOPHY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━'),
        '',
        `  ${dim('>')} "Information density over eye candy"`,
        `  ${dim('>')} "Bloomberg terminal meets hacker aesthetic"`,
        `  ${dim('>')} "Every pixel earns its place"`,
        '',
        `  Inspired by: Bloomberg Terminal, htop, lazygit, k9s`,
        '',
      ]);
    },

    '/clear': function() {
      output.innerHTML = '';
    },
  };

  // ─── Dynamic commands ─────────────────────────────────

  function quoteCmd(ticker) {
    if (!ticker) {
      printBlock([
        `  ${red('Usage:')} /quote <ticker>`,
        `  ${dim('Example:')} ${sc('/quote AAPL')}`,
        '',
        dim('  Available: AAPL, NVDA, MSFT, TSLA, GOOGL, AMZN, META, AMD, SPY, BTC-USD, ETH-USD'),
        '',
      ]);
      bindSlashCommands();
      return;
    }
    const t = tickerData[ticker.toUpperCase()];
    if (!t) {
      printBlock([
        `  ${red('Ticker not found:')} ${ticker.toUpperCase()}`,
        dim('  Available: AAPL, NVDA, MSFT, TSLA, GOOGL, AMZN, META, AMD, SPY, BTC-USD, ETH-USD'),
        '',
      ]);
      return;
    }
    const dir = t.change >= 0;
    const color = dir ? green : red;
    const arrow = dir ? '▲' : '▼';
    const sign = dir ? '+' : '';
    const priceStr = t.price >= 1000 ? t.price.toLocaleString() : t.price.toFixed(2);

    printBlock([
      cyan(`━━━ ${ticker.toUpperCase()} ━ ${t.name} ${'━'.repeat(Math.max(0, 38 - t.name.length))}`),
      '',
      `  PRICE      ${color('$' + priceStr + '  ' + sign + t.change.toFixed(2) + '%  ' + arrow)}`,
      `  HIGH       $${t.high >= 1000 ? t.high.toLocaleString() : t.high.toFixed(2)}`,
      `  LOW        $${t.low >= 1000 ? t.low.toLocaleString() : t.low.toFixed(2)}`,
      `  VOLUME     ${t.vol}`,
      `  MKT CAP    $${t.cap}`,
      '',
      dim(`  Demo data  |  Try ${sc('/chart ' + ticker.toUpperCase())} for price history`),
      '',
    ]);
    bindSlashCommands();
  }

  function chartCmd(ticker) {
    if (!ticker) {
      printBlock([
        `  ${red('Usage:')} /chart <ticker>`,
        `  ${dim('Example:')} ${sc('/chart NVDA')}`,
        '',
      ]);
      bindSlashCommands();
      return;
    }
    const t = tickerData[ticker.toUpperCase()];
    if (!t) {
      printBlock([
        `  ${red('Ticker not found:')} ${ticker.toUpperCase()}`,
        '',
      ]);
      return;
    }
    const b = t.price;
    printBlock([
      cyan(`━━━ ${ticker.toUpperCase()} PRICE (30D) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`),
      '',
      `  $${(b*1.04).toFixed(0).padStart(6)} ┤                                          ╭──`,
      `  $${(b*1.02).toFixed(0).padStart(6)} ┤                               ╭──╮   ╭──╯`,
      `  $${(b*1.00).toFixed(0).padStart(6)} ┤               ╭───╮      ╭────╯  ╰───╯`,
      `  $${(b*0.98).toFixed(0).padStart(6)} ┤          ╭────╯   ╰──────╯`,
      `  $${(b*0.96).toFixed(0).padStart(6)} ┤     ╭────╯`,
      `  $${(b*0.94).toFixed(0).padStart(6)} ┤─────╯`,
      `         └──────────────────────────────────────────`,
      dim('          -30d              -15d              now'),
      '',
    ]);
  }

  // ─── Command router ───────────────────────────────────

  function runCommand(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return;

    // Echo the command
    print(`<span class="cmd-echo">> ${trimmed}</span>`);
    printBlank();

    // Add to history
    commandHistory.push(trimmed);
    historyIndex = commandHistory.length;

    const parts = trimmed.split(/\s+/);
    let cmd = parts[0].toLowerCase();

    // Auto-add / if missing
    if (!cmd.startsWith('/') && commands['/' + cmd]) {
      cmd = '/' + cmd;
    }

    if (cmd === '/quote' || cmd === '/q' || cmd === '/price') {
      quoteCmd(parts[1]);
    } else if (cmd === '/chart' || cmd === '/c') {
      chartCmd(parts[1]);
    } else if (commands[cmd]) {
      commands[cmd]();
    } else {
      printBlock([
        `  ${red("'" + trimmed + "'")} is not a recognized command.`,
        `  Type ${sc('/help')} to see available commands.`,
        '',
      ]);
      bindSlashCommands();
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
      if (historyIndex > 0) {
        historyIndex--;
        input.value = commandHistory[historyIndex];
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        historyIndex++;
        input.value = commandHistory[historyIndex];
      } else {
        historyIndex = commandHistory.length;
        input.value = '';
      }
    }
  });

  // Click anywhere to focus input
  document.addEventListener('click', (e) => {
    if (!window.getSelection().toString()) {
      input.focus();
    }
  });

  // ─── Ticker bar ───────────────────────────────────────

  const tickers = [
    { sym: 'AAPL', price: 189.84, change: +1.24 },
    { sym: 'NVDA', price: 721.33, change: +3.87 },
    { sym: 'MSFT', price: 415.20, change: +1.15 },
    { sym: 'GOOGL', price: 152.87, change: +0.82 },
    { sym: 'AMZN', price: 178.12, change: -0.31 },
    { sym: 'TSLA', price: 231.45, change: -2.14 },
    { sym: 'META', price: 501.33, change: +2.08 },
    { sym: 'AMD', price: 168.90, change: -1.42 },
    { sym: 'BTC', price: 67843, change: +2.31 },
    { sym: 'ETH', price: 3521, change: +1.87 },
    { sym: 'S&P', price: 5842.31, change: +1.24 },
    { sym: 'DOW', price: 43890, change: +0.87 },
    { sym: 'VIX', price: 14.82, change: -2.10 },
  ];

  const tickerContent = document.createElement('div');
  tickerContent.className = 'ticker-content';
  for (let i = 0; i < 2; i++) {
    tickers.forEach(t => {
      const item = document.createElement('span');
      item.className = 'ticker-item';
      const dir = t.change >= 0 ? 'up' : 'down';
      const arrow = t.change >= 0 ? '▲' : '▼';
      const sign = t.change >= 0 ? '+' : '';
      const p = t.price >= 1000 ? t.price.toLocaleString() : t.price.toFixed(2);
      item.innerHTML = `<span class="ticker-symbol">${t.sym}</span> $${p} <span class="ticker-${dir}">${sign}${t.change.toFixed(2)}% ${arrow}</span>`;
      tickerContent.appendChild(item);
    });
  }
  document.getElementById('ticker-bar').appendChild(tickerContent);

  // ─── Boot ─────────────────────────────────────────────
  boot();

})();
