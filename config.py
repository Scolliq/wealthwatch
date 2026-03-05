import os
from dotenv import load_dotenv

load_dotenv()

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
ALPHA_VANTAGE_API_KEY = os.getenv("ALPHA_VANTAGE_API_KEY", "")
NEWS_API_KEY = os.getenv("NEWS_API_KEY", "")
ALERT_CHECK_INTERVAL = int(os.getenv("ALERT_CHECK_INTERVAL", "60"))

# File paths for persistent data
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
PORTFOLIO_FILE = os.path.join(DATA_DIR, "portfolios.json")
ALERTS_FILE = os.path.join(DATA_DIR, "alerts.json")
WATCHLIST_FILE = os.path.join(DATA_DIR, "watchlists.json")

os.makedirs(DATA_DIR, exist_ok=True)
