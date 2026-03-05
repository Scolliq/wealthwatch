import requests
from config import NEWS_API_KEY
from datetime import datetime, timedelta


def get_market_news(query: str = "stock market", page_size: int = 5) -> list[dict]:
    """Fetch financial news via NewsAPI (requires API key) or fallback."""
    if NEWS_API_KEY:
        return _newsapi_fetch(query, page_size)
    return []


def _newsapi_fetch(query: str, page_size: int) -> list[dict]:
    url = "https://newsapi.org/v2/everything"
    from_date = (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d")
    params = {
        "q": query,
        "sortBy": "publishedAt",
        "language": "en",
        "pageSize": page_size,
        "from": from_date,
        "apiKey": NEWS_API_KEY,
    }
    try:
        resp = requests.get(url, params=params, timeout=10)
        resp.raise_for_status()
        articles = resp.json().get("articles", [])
        return [
            {
                "title": a["title"],
                "source": a["source"]["name"],
                "url": a["url"],
                "published": a["publishedAt"][:10],
            }
            for a in articles
            if a.get("title") and "[Removed]" not in a["title"]
        ]
    except Exception:
        return []


def format_news(articles: list[dict], header: str = "Latest News") -> str:
    if not articles:
        return "No news available. Set NEWS\\_API\\_KEY in your .env to enable news."
    lines = [f"*{header}*\n"]
    for i, a in enumerate(articles, 1):
        lines.append(f"{i}. [{a['title']}]({a['url']})")
        lines.append(f"   _{a['source']} · {a['published']}_\n")
    return "\n".join(lines)
