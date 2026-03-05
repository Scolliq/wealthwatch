from telegram import Update
from telegram.ext import ContextTypes
from telegram.constants import ParseMode
from services.market_data import get_quote
from services import storage


async def watchlist_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handler for /watchlist — view all watched tickers"""
    user_id = update.effective_user.id
    tickers = storage.get_watchlist(user_id)

    if not tickers:
        await update.message.reply_text(
            "Your watchlist is empty.\nUse /watch <ticker> to add stocks."
        )
        return

    msg = await update.message.reply_text("Loading watchlist...")
    lines = ["*Your Watchlist*\n"]

    for ticker in tickers:
        quote = get_quote(ticker)
        if quote:
            arrow = "▲" if quote["change"] >= 0 else "▼"
            sign = "+" if quote["change"] >= 0 else ""
            lines.append(
                f"{arrow} *{ticker}*: `${quote['price']:.2f}` "
                f"({sign}{quote['change_pct']:.2f}%)"
            )
        else:
            lines.append(f"• *{ticker}*: price unavailable")

    await msg.edit_text("\n".join(lines), parse_mode=ParseMode.MARKDOWN)


async def watch_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handler for /watch <ticker>"""
    if not context.args:
        await update.message.reply_text("Usage: /watch <ticker>\nExample: /watch TSLA")
        return

    ticker = context.args[0].upper()
    user_id = update.effective_user.id

    # Validate ticker exists
    quote = get_quote(ticker)
    if not quote:
        await update.message.reply_text(f"Could not find *{ticker}*. Check the symbol.", parse_mode=ParseMode.MARKDOWN)
        return

    added = storage.add_to_watchlist(user_id, ticker)
    if added:
        await update.message.reply_text(f"Added *{ticker}* to your watchlist.", parse_mode=ParseMode.MARKDOWN)
    else:
        await update.message.reply_text(f"*{ticker}* is already in your watchlist.", parse_mode=ParseMode.MARKDOWN)


async def unwatch_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handler for /unwatch <ticker>"""
    if not context.args:
        await update.message.reply_text("Usage: /unwatch <ticker>\nExample: /unwatch TSLA")
        return

    ticker = context.args[0].upper()
    user_id = update.effective_user.id
    removed = storage.remove_from_watchlist(user_id, ticker)

    if removed:
        await update.message.reply_text(f"Removed *{ticker}* from your watchlist.", parse_mode=ParseMode.MARKDOWN)
    else:
        await update.message.reply_text(f"*{ticker}* is not in your watchlist.", parse_mode=ParseMode.MARKDOWN)
