import logging
from telegram import Update, BotCommand
from telegram.ext import Application, CommandHandler, ContextTypes
from telegram.constants import ParseMode

from config import TELEGRAM_BOT_TOKEN
from handlers.stock import price_command, market_command, search_command
from handlers.portfolio import portfolio_command, buy_command, sell_command
from handlers.watchlist import watchlist_command, watch_command, unwatch_command
from handlers.alerts import alert_command, alerts_command, delalert_command
from handlers.news import news_command
from services.alert_scheduler import start_scheduler

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

HELP_TEXT = """
*WealthWatch Bot* — Your personal finance assistant

*Market Data*
/price <ticker> — Get real-time stock/crypto quote
/market — Major indices overview
/search <query> — Search for ticker symbols

*Portfolio*
/portfolio — View your portfolio with P&L
/buy <ticker> <shares> <price> — Add a position
/sell <ticker> — Remove a position

*Watchlist*
/watchlist — View your watchlist
/watch <ticker> — Add a ticker to watchlist
/unwatch <ticker> — Remove from watchlist

*Price Alerts*
/alert <ticker> <above|below> <price> — Set a price alert
/alerts — List your active alerts
/delalert <id> — Delete an alert

*News*
/news [query] — Get latest financial news

Examples:
`/price AAPL`
`/buy TSLA 5 250.00`
`/alert BTC-USD above 100000`
`/news nvidia earnings`
"""


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    name = update.effective_user.first_name
    await update.message.reply_text(
        f"Welcome to *WealthWatch*, {name}!\n\n"
        "Track stocks, manage your portfolio, set price alerts, and stay on top of market news.\n\n"
        + HELP_TEXT,
        parse_mode=ParseMode.MARKDOWN,
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(HELP_TEXT, parse_mode=ParseMode.MARKDOWN)


async def set_bot_commands(app: Application) -> None:
    commands = [
        BotCommand("price", "Get real-time stock/crypto quote"),
        BotCommand("market", "Major indices overview"),
        BotCommand("search", "Search for ticker symbols"),
        BotCommand("portfolio", "View portfolio with P&L"),
        BotCommand("buy", "Add a position to portfolio"),
        BotCommand("sell", "Remove a position from portfolio"),
        BotCommand("watchlist", "View your watchlist"),
        BotCommand("watch", "Add ticker to watchlist"),
        BotCommand("unwatch", "Remove ticker from watchlist"),
        BotCommand("alert", "Set a price alert"),
        BotCommand("alerts", "List your active alerts"),
        BotCommand("delalert", "Delete an alert"),
        BotCommand("news", "Get latest financial news"),
        BotCommand("help", "Show help message"),
    ]
    await app.bot.set_my_commands(commands)


def main() -> None:
    if not TELEGRAM_BOT_TOKEN:
        raise ValueError("TELEGRAM_BOT_TOKEN is not set. Copy .env.example to .env and fill it in.")

    app = Application.builder().token(TELEGRAM_BOT_TOKEN).post_init(set_bot_commands).build()

    # Register handlers
    app.add_handler(CommandHandler("start", start_command))
    app.add_handler(CommandHandler("help", help_command))

    app.add_handler(CommandHandler("price", price_command))
    app.add_handler(CommandHandler("market", market_command))
    app.add_handler(CommandHandler("search", search_command))

    app.add_handler(CommandHandler("portfolio", portfolio_command))
    app.add_handler(CommandHandler("buy", buy_command))
    app.add_handler(CommandHandler("sell", sell_command))

    app.add_handler(CommandHandler("watchlist", watchlist_command))
    app.add_handler(CommandHandler("watch", watch_command))
    app.add_handler(CommandHandler("unwatch", unwatch_command))

    app.add_handler(CommandHandler("alert", alert_command))
    app.add_handler(CommandHandler("alerts", alerts_command))
    app.add_handler(CommandHandler("delalert", delalert_command))

    app.add_handler(CommandHandler("news", news_command))

    # Start alert scheduler
    start_scheduler(app)

    logger.info("WealthWatch bot starting...")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
