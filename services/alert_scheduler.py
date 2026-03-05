import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from telegram.ext import Application
from services.market_data import get_quote
from services import storage
from config import ALERT_CHECK_INTERVAL

logger = logging.getLogger(__name__)


async def check_alerts(app: Application) -> None:
    """Check all active alerts and send notifications if triggered."""
    all_alerts = storage.get_all_alerts()

    for user_id_str, alerts in all_alerts.items():
        user_id = int(user_id_str)
        for alert in alerts:
            if not alert.get("active"):
                continue

            ticker = alert["ticker"]
            condition = alert["condition"]
            target = alert["target"]

            quote = get_quote(ticker)
            if not quote:
                continue

            price = quote["price"]
            triggered = (condition == "above" and price >= target) or \
                        (condition == "below" and price <= target)

            if triggered:
                try:
                    await app.bot.send_message(
                        chat_id=user_id,
                        text=(
                            f"*Price Alert Triggered!*\n\n"
                            f"*{ticker}* is now `${price:.2f}`\n"
                            f"Your alert: {condition} `${target:,.2f}`\n\n"
                            f"Alert `{alert['id']}` has been deactivated."
                        ),
                        parse_mode="Markdown",
                    )
                    storage.deactivate_alert(user_id, alert["id"])
                    logger.info(f"Alert {alert['id']} triggered for user {user_id}")
                except Exception as e:
                    logger.error(f"Failed to send alert to {user_id}: {e}")


def start_scheduler(app: Application) -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        check_alerts,
        trigger="interval",
        seconds=ALERT_CHECK_INTERVAL,
        args=[app],
        id="alert_checker",
        replace_existing=True,
    )
    scheduler.start()
    logger.info(f"Alert scheduler started (interval: {ALERT_CHECK_INTERVAL}s)")
    return scheduler
