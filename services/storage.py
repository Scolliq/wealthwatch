import json
import os
from typing import Any
from config import PORTFOLIO_FILE, ALERTS_FILE, WATCHLIST_FILE


def _load(path: str) -> dict:
    if os.path.exists(path):
        with open(path, "r") as f:
            return json.load(f)
    return {}


def _save(path: str, data: dict) -> None:
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


# --- Portfolio ---

def get_portfolio(user_id: int) -> list[dict]:
    data = _load(PORTFOLIO_FILE)
    return data.get(str(user_id), [])


def add_to_portfolio(user_id: int, ticker: str, shares: float, buy_price: float) -> None:
    data = _load(PORTFOLIO_FILE)
    uid = str(user_id)
    if uid not in data:
        data[uid] = []
    # Merge if ticker already exists
    for position in data[uid]:
        if position["ticker"] == ticker.upper():
            total_shares = position["shares"] + shares
            position["avg_price"] = (
                (position["avg_price"] * position["shares"]) + (buy_price * shares)
            ) / total_shares
            position["shares"] = total_shares
            _save(PORTFOLIO_FILE, data)
            return
    data[uid].append({
        "ticker": ticker.upper(),
        "shares": shares,
        "avg_price": buy_price,
    })
    _save(PORTFOLIO_FILE, data)


def remove_from_portfolio(user_id: int, ticker: str) -> bool:
    data = _load(PORTFOLIO_FILE)
    uid = str(user_id)
    original = data.get(uid, [])
    filtered = [p for p in original if p["ticker"] != ticker.upper()]
    if len(filtered) == len(original):
        return False
    data[uid] = filtered
    _save(PORTFOLIO_FILE, data)
    return True


# --- Watchlist ---

def get_watchlist(user_id: int) -> list[str]:
    data = _load(WATCHLIST_FILE)
    return data.get(str(user_id), [])


def add_to_watchlist(user_id: int, ticker: str) -> bool:
    data = _load(WATCHLIST_FILE)
    uid = str(user_id)
    if uid not in data:
        data[uid] = []
    ticker = ticker.upper()
    if ticker in data[uid]:
        return False
    data[uid].append(ticker)
    _save(WATCHLIST_FILE, data)
    return True


def remove_from_watchlist(user_id: int, ticker: str) -> bool:
    data = _load(WATCHLIST_FILE)
    uid = str(user_id)
    original = data.get(uid, [])
    filtered = [t for t in original if t != ticker.upper()]
    if len(filtered) == len(original):
        return False
    data[uid] = filtered
    _save(WATCHLIST_FILE, data)
    return True


# --- Alerts ---

def get_alerts(user_id: int) -> list[dict]:
    data = _load(ALERTS_FILE)
    return data.get(str(user_id), [])


def get_all_alerts() -> dict:
    return _load(ALERTS_FILE)


def add_alert(user_id: int, ticker: str, condition: str, target: float) -> dict:
    data = _load(ALERTS_FILE)
    uid = str(user_id)
    if uid not in data:
        data[uid] = []
    alert = {
        "id": len(data[uid]) + 1,
        "ticker": ticker.upper(),
        "condition": condition,  # "above" or "below"
        "target": target,
        "active": True,
    }
    data[uid].append(alert)
    _save(ALERTS_FILE, data)
    return alert


def remove_alert(user_id: int, alert_id: int) -> bool:
    data = _load(ALERTS_FILE)
    uid = str(user_id)
    original = data.get(uid, [])
    filtered = [a for a in original if a["id"] != alert_id]
    if len(filtered) == len(original):
        return False
    data[uid] = filtered
    _save(ALERTS_FILE, data)
    return True


def deactivate_alert(user_id: int, alert_id: int) -> None:
    data = _load(ALERTS_FILE)
    uid = str(user_id)
    for alert in data.get(uid, []):
        if alert["id"] == alert_id:
            alert["active"] = False
    _save(ALERTS_FILE, data)
