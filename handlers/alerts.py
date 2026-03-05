from telegram import Update
from telegram.ext import ContextTypes
from telegram.constants import ParseMode
from services import storage


async def alert_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handler for /alert <ticker> <above|below> <price>"""
    if len(context.args) < 3:
        await update.message.reply_text(
            "Usage: /alert <ticker> <above|below> <price>\n"
            "Example: /alert AAPL above 200\n"
            "         /alert BTC-USD below 50000"
        )
        return

    ticker = context.args[0].upper()
    condition = context.args[1].lower()
    if condition not in ("above", "below"):
        await update.message.reply_text("Condition must be `above` or `below`.", parse_mode=ParseMode.MARKDOWN)
        return

    try:
        target = float(context.args[2])
    except ValueError:
        await update.message.reply_text("Price must be a number.")
        return

    user_id = update.effective_user.id
    alert = storage.add_alert(user_id, ticker, condition, target)

    await update.message.reply_text(
        f"Alert set! I'll notify you when *{ticker}* goes {condition} `${target:,.2f}`.\n"
        f"Alert ID: `{alert['id']}`",
        parse_mode=ParseMode.MARKDOWN,
    )


async def alerts_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handler for /alerts — list active alerts"""
    user_id = update.effective_user.id
    alerts = storage.get_alerts(user_id)
    active = [a for a in alerts if a.get("active")]

    if not active:
        await update.message.reply_text(
            "No active alerts. Use /alert <ticker> <above|below> <price> to set one."
        )
        return

    lines = ["*Your Active Alerts*\n"]
    for a in active:
        lines.append(
            f"• `[{a['id']}]` *{a['ticker']}* {a['condition']} `${a['target']:,.2f}`"
        )

    lines.append("\nUse /delalert <id> to remove an alert.")
    await update.message.reply_text("\n".join(lines), parse_mode=ParseMode.MARKDOWN)


async def delalert_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handler for /delalert <id>"""
    if not context.args:
        await update.message.reply_text("Usage: /delalert <alert_id>\nExample: /delalert 1")
        return

    try:
        alert_id = int(context.args[0])
    except ValueError:
        await update.message.reply_text("Alert ID must be a number.")
        return

    user_id = update.effective_user.id
    removed = storage.remove_alert(user_id, alert_id)

    if removed:
        await update.message.reply_text(f"Alert `{alert_id}` removed.", parse_mode=ParseMode.MARKDOWN)
    else:
        await update.message.reply_text(f"Alert `{alert_id}` not found.", parse_mode=ParseMode.MARKDOWN)
