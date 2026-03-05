# WealthWatch

A Telegram bot for personal finance and stock market tracking. Monitor stocks, manage a portfolio, set price alerts, and get financial news — all from Telegram.

## Features

- **Real-time quotes** — Stocks, ETFs, crypto, and indices via `yfinance`
- **Market overview** — S&P 500, Dow Jones, NASDAQ, Russell 2000, VIX at a glance
- **Portfolio tracking** — Track positions with live P&L calculations
- **Watchlist** — Monitor a list of tickers with price changes
- **Price alerts** — Get notified when a ticker crosses a target price
- **Financial news** — Latest headlines (requires NewsAPI key)

## Commands

| Command | Description |
|---|---|
| `/price <ticker>` | Real-time quote (e.g. `/price AAPL`) |
| `/market` | Major indices summary |
| `/search <query>` | Find ticker symbols |
| `/portfolio` | View portfolio with P&L |
| `/buy <ticker> <shares> <price>` | Add a position |
| `/sell <ticker>` | Remove a position |
| `/watchlist` | View your watchlist |
| `/watch <ticker>` | Add ticker to watchlist |
| `/unwatch <ticker>` | Remove from watchlist |
| `/alert <ticker> <above\|below> <price>` | Set a price alert |
| `/alerts` | List active alerts |
| `/delalert <id>` | Delete an alert |
| `/news [query]` | Latest financial news |

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/wealthwatch.git
cd wealthwatch
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your values:

- **`TELEGRAM_BOT_TOKEN`** — Get from [@BotFather](https://t.me/BotFather) on Telegram
- **`NEWS_API_KEY`** *(optional)* — Free key from [newsapi.org](https://newsapi.org)
- **`ALPHA_VANTAGE_API_KEY`** *(optional)* — Free key from [alphavantage.co](https://www.alphavantage.co)

### 4. Run the bot

```bash
python bot.py
```

## Project Structure

```
wealthwatch/
├── bot.py                    # Entry point, registers all handlers
├── config.py                 # Env var loading and paths
├── requirements.txt
├── .env.example
├── handlers/
│   ├── stock.py              # /price, /market, /search
│   ├── portfolio.py          # /portfolio, /buy, /sell
│   ├── watchlist.py          # /watchlist, /watch, /unwatch
│   ├── alerts.py             # /alert, /alerts, /delalert
│   └── news.py               # /news
├── services/
│   ├── market_data.py        # yfinance wrapper + formatters
│   ├── storage.py            # JSON-based persistence
│   ├── news.py               # NewsAPI integration
│   └── alert_scheduler.py    # APScheduler price alert checker
└── data/                     # Auto-created; stores user data
    ├── portfolios.json
    ├── watchlists.json
    └── alerts.json
```

## Notes

- Data is stored locally as JSON files in the `data/` directory. For a production deployment, consider migrating to a database (SQLite, PostgreSQL, etc.)
- Market data is sourced from Yahoo Finance via `yfinance`. Data may be delayed by 15–20 minutes for some exchanges.
- The alert checker runs every 60 seconds by default (configurable via `ALERT_CHECK_INTERVAL` in `.env`).
