from telegram import Update
from telegram.ext import ContextTypes
from telegram.constants import ParseMode
from services.market_data import get_quote, format_large_number
from services import storage


async def portfolio_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handler for /portfolio — view portfolio with P&L"""
    user_id = update.effective_user.id
    positions = storage.get_portfolio(user_id)

    if not positions:
        await update.message.reply_text(
            "Your portfolio is empty.\nUse /buy <ticker> <shares> <price> to add a position."
        )
        return

    msg = await update.message.reply_text("Calculating portfolio...")

    total_value = 0.0
    total_cost = 0.0
    lines = ["*Your Portfolio*\n"]

    for pos in positions:
        ticker = pos["ticker"]
        shares = pos["shares"]
        avg_price = pos["avg_price"]
        cost_basis = shares * avg_price

        quote = get_quote(ticker)
        if quote:
            current_price = quote["price"]
            current_value = shares * current_price
            gain = current_value - cost_basis
            gain_pct = (gain / cost_basis * 100) if cost_basis else 0
            arrow = "▲" if gain >= 0 else "▼"
            sign = "+" if gain >= 0 else ""
            total_value += current_value
            total_cost += cost_basis
            lines.append(
                f"{arrow} *{ticker}*: {shares} shares @ ${current_price:.2f}\n"
                f"   Value: `${current_value:,.2f}` | P&L: `{sign}${gain:,.2f} ({sign}{gain_pct:.1f}%)`"
            )
        else:
            total_cost += cost_basis
            lines.append(f"• *{ticker}*: {shares} shares (price unavailable)")

    lines.append("")
    total_gain = total_value - total_cost
    total_gain_pct = (total_gain / total_cost * 100) if total_cost else 0
    sign = "+" if total_gain >= 0 else ""
    lines.append(f"*Total Value:* `${total_value:,.2f}`")
    lines.append(f"*Total P&L:* `{sign}${total_gain:,.2f} ({sign}{total_gain_pct:.1f}%)`")

    await msg.edit_text("\n".join(lines), parse_mode=ParseMode.MARKDOWN)


async def buy_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handler for /buy <ticker> <shares> <price>"""
    if len(context.args) < 3:
        await update.message.reply_text(
            "Usage: /buy <ticker> <shares> <price>\nExample: /buy AAPL 10 175.50"
        )
        return

    try:
        ticker = context.args[0].upper()
        shares = float(context.args[1])
        price = float(context.args[2])
    except ValueError:
        await update.message.reply_text("Shares and price must be numbers.")
        return

    if shares <= 0 or price <= 0:
        await update.message.reply_text("Shares and price must be positive.")
        return

    user_id = update.effective_user.id
    storage.add_to_portfolio(user_id, ticker, shares, price)

    await update.message.reply_text(
        f"Added to portfolio: *{ticker}* — {shares} shares @ ${price:.2f}",
        parse_mode=ParseMode.MARKDOWN,
    )


async def sell_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handler for /sell <ticker> — removes position"""
    if not context.args:
        await update.message.reply_text("Usage: /sell <ticker>\nExample: /sell AAPL")
        return

    ticker = context.args[0].upper()
    user_id = update.effective_user.id
    removed = storage.remove_from_portfolio(user_id, ticker)

    if removed:
        await update.message.reply_text(f"Removed *{ticker}* from your portfolio.", parse_mode=ParseMode.MARKDOWN)
    else:
        await update.message.reply_text(f"*{ticker}* not found in your portfolio.", parse_mode=ParseMode.MARKDOWN)
