from telegram import Update
from telegram.ext import ContextTypes
from telegram.constants import ParseMode
from services.market_data import get_quote, format_quote, get_market_summary, search_ticker


async def price_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handler for /price <ticker>"""
    if not context.args:
        await update.message.reply_text("Usage: /price <ticker>\nExample: /price AAPL")
        return

    ticker = context.args[0].upper()
    msg = await update.message.reply_text(f"Fetching quote for {ticker}...")

    quote = get_quote(ticker)
    if not quote:
        await msg.edit_text(f"Could not find data for *{ticker}*. Check the ticker symbol.", parse_mode=ParseMode.MARKDOWN)
        return

    await msg.edit_text(format_quote(quote), parse_mode=ParseMode.MARKDOWN)


async def market_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handler for /market — show major index summary"""
    msg = await update.message.reply_text("Fetching market summary...")
    summary = get_market_summary()

    if not summary:
        await msg.edit_text("Could not fetch market data. Try again later.")
        return

    lines = ["*Market Summary*\n"]
    for name, q in summary.items():
        arrow = "▲" if q["change"] >= 0 else "▼"
        sign = "+" if q["change"] >= 0 else ""
        lines.append(
            f"{arrow} *{name}*: `{q['price']:,.2f}` ({sign}{q['change_pct']:.2f}%)"
        )

    await msg.edit_text("\n".join(lines), parse_mode=ParseMode.MARKDOWN)


async def search_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handler for /search <query>"""
    if not context.args:
        await update.message.reply_text("Usage: /search <company name>\nExample: /search Apple")
        return

    query = " ".join(context.args)
    msg = await update.message.reply_text(f'Searching for "{query}"...')
    results = search_ticker(query)

    if not results:
        await msg.edit_text(f'No results found for "{query}".')
        return

    lines = [f"*Search results for \"{query}\"*\n"]
    for r in results:
        lines.append(f"• `{r['ticker']}` — {r['name']} ({r['exchange']}, {r['type']})")

    lines.append("\nUse /price <ticker> to get a quote.")
    await msg.edit_text("\n".join(lines), parse_mode=ParseMode.MARKDOWN)
