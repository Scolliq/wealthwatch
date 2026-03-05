import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
from typing import Optional


def get_quote(ticker: str) -> Optional[dict]:
    """Fetch real-time quote for a ticker symbol."""
    try:
        stock = yf.Ticker(ticker.upper())
        info = stock.info

        price = info.get("currentPrice") or info.get("regularMarketPrice")
        prev_close = info.get("previousClose") or info.get("regularMarketPreviousClose")

        if not price:
            return None

        change = price - prev_close if prev_close else 0
        change_pct = (change / prev_close * 100) if prev_close else 0

        return {
            "ticker": ticker.upper(),
            "name": info.get("longName") or info.get("shortName", ticker.upper()),
            "price": price,
            "prev_close": prev_close,
            "change": change,
            "change_pct": change_pct,
            "open": info.get("open") or info.get("regularMarketOpen"),
            "day_high": info.get("dayHigh") or info.get("regularMarketDayHigh"),
            "day_low": info.get("dayLow") or info.get("regularMarketDayLow"),
            "volume": info.get("volume") or info.get("regularMarketVolume"),
            "avg_volume": info.get("averageVolume"),
            "market_cap": info.get("marketCap"),
            "pe_ratio": info.get("trailingPE"),
            "52w_high": info.get("fiftyTwoWeekHigh"),
            "52w_low": info.get("fiftyTwoWeekLow"),
            "currency": info.get("currency", "USD"),
            "exchange": info.get("exchange", ""),
        }
    except Exception:
        return None


def get_history(ticker: str, period: str = "1mo") -> Optional[pd.DataFrame]:
    """Fetch historical price data."""
    try:
        stock = yf.Ticker(ticker.upper())
        df = stock.history(period=period)
        return df if not df.empty else None
    except Exception:
        return None


def search_ticker(query: str) -> list[dict]:
    """Search for tickers by company name or symbol."""
    try:
        results = yf.Search(query, max_results=5)
        quotes = results.quotes
        return [
            {
                "ticker": q.get("symbol", ""),
                "name": q.get("longname") or q.get("shortname", ""),
                "exchange": q.get("exchange", ""),
                "type": q.get("quoteType", ""),
            }
            for q in quotes
            if q.get("symbol")
        ]
    except Exception:
        return []


def get_market_summary() -> dict:
    """Fetch major indices summary."""
    indices = {
        "S&P 500": "^GSPC",
        "Dow Jones": "^DJI",
        "NASDAQ": "^IXIC",
        "Russell 2000": "^RUT",
        "VIX": "^VIX",
    }
    summary = {}
    for name, symbol in indices.items():
        quote = get_quote(symbol)
        if quote:
            summary[name] = quote
    return summary


def format_large_number(n: Optional[float]) -> str:
    if n is None:
        return "N/A"
    if n >= 1e12:
        return f"${n/1e12:.2f}T"
    if n >= 1e9:
        return f"${n/1e9:.2f}B"
    if n >= 1e6:
        return f"${n/1e6:.2f}M"
    return f"${n:,.2f}"


def format_quote(quote: dict) -> str:
    arrow = "▲" if quote["change"] >= 0 else "▼"
    sign = "+" if quote["change"] >= 0 else ""
    change_str = f"{sign}{quote['change']:.2f} ({sign}{quote['change_pct']:.2f}%)"

    lines = [
        f"*{quote['ticker']}* — {quote['name']}",
        f"",
        f"💵 Price: `{quote['currency']} {quote['price']:.2f}`",
        f"{arrow} Change: `{change_str}`",
        f"",
        f"Open: `{quote['open']:.2f}`  |  Prev Close: `{quote['prev_close']:.2f}`",
        f"High: `{quote['day_high']:.2f}`  |  Low: `{quote['day_low']:.2f}`",
        f"",
        f"Volume: `{quote['volume']:,}`",
        f"Avg Volume: `{quote['avg_volume']:,}`" if quote.get("avg_volume") else "",
        f"Market Cap: `{format_large_number(quote.get('market_cap'))}`",
        f"P/E Ratio: `{quote['pe_ratio']:.2f}`" if quote.get("pe_ratio") else "",
        f"52W High: `{quote['52w_high']:.2f}`  |  52W Low: `{quote['52w_low']:.2f}`"
        if quote.get("52w_high")
        else "",
    ]
    return "\n".join(line for line in lines if line is not None)
