from telegram import Update
from telegram.ext import ContextTypes
from telegram.constants import ParseMode
from services.news import get_market_news, format_news


async def news_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handler for /news [query]"""
    query = " ".join(context.args) if context.args else "stock market finance"
    header = f'News: "{" ".join(context.args)}"' if context.args else "Market News"

    msg = await update.message.reply_text("Fetching latest news...")
    articles = get_market_news(query)
    text = format_news(articles, header)
    await msg.edit_text(text, parse_mode=ParseMode.MARKDOWN, disable_web_page_preview=True)
