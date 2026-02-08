#!/usr/bin/env python3
"""Reddit ingestion starter using PRAW. Streams new posts in configured subreddits,
attempts to match tickers and writes posts + basic sentiment to DB.

Requires PRAW credentials in environment or .env:
- REDDIT_CLIENT_ID
- REDDIT_CLIENT_SECRET
- REDDIT_USER_AGENT

"""
import os
import re
import time
from datetime import datetime
import praw
from ingest import db
from ..sentiment import sentiment_client
import asyncio

SUBREDDITS = os.getenv('SUBREDDITS', 'wallstreetbets,stocks').split(',')
TICKER_REGEX = re.compile(r"\b[A-Z]{1,5}\b")

# Very small lexicon-based sentiment
POSITIVE = {'good', 'great', 'buy', 'bull', 'moon', 'gain', 'long', 'win'}
NEGATIVE = {'sell', 'bad', 'down', 'dump', 'loss', 'short'}


def extract_symbols(text, known_tickers):
    found = set(m.group(0) for m in TICKER_REGEX.finditer(text))
    return [s for s in found if s in known_tickers]


def simple_sentiment(text):
    t = text.lower()
    p = sum(t.count(w) for w in POSITIVE)
    n = sum(t.count(w) for w in NEGATIVE)
    score = 0.0
    if p + n > 0:
        score = (p - n) / (p + n)
    return score


def main():
    reddit_client_id = os.getenv('REDDIT_CLIENT_ID')
    reddit_client_secret = os.getenv('REDDIT_CLIENT_SECRET')
    reddit_user_agent = os.getenv('REDDIT_USER_AGENT', 'AlphaWindow/0.1')

    r = praw.Reddit(client_id=reddit_client_id, client_secret=reddit_client_secret, user_agent=reddit_user_agent)
    known = set(db.get_tracked_tickers(limit=5000))
    print(f"Monitoring subreddits: {SUBREDDITS}")

    async def process_post(post):
        text = (post.title or '') + '\n' + (post.selftext or '')
        syms = extract_symbols(text, known)
        if not syms:
            return
        now = datetime.utcfromtimestamp(post.created_utc)
        rows = []
        sentiment_rows = []
        # call finbert for full text once per post
        try:
            scores = sentiment_client.predict_batch_sync([text])
            score = scores[0] if scores else 0.0
        except Exception as e:
            print('FinBERT error, falling back to lexicon:', e)
            score = simple_sentiment(text)

        for s in syms:
            rows.append((post.id, s, post.subreddit.display_name, getattr(post, 'author', None).name if getattr(post, 'author', None) else None, post.title, post.selftext, None, None, now, None, post.score, datetime.utcnow()))
            sentiment_rows.append((now, s, 'reddit', float(score), None, 'finbert', None, post.id))
        db.insert_reddit_posts(rows)
        db.insert_sentiment_metrics(sentiment_rows)

    while True:
        try:
            for sub in SUBREDDITS:
                subreddit = r.subreddit(sub)
                for post in subreddit.stream.submissions(skip_existing=True):
                    try:
                        process_post(post)
                    except Exception as e:
                        print('process_post error', e)
        except Exception as e:
            """
            DEPRECATED: Python reddit_ingest

            This file is kept for reference only. The production ingestion now uses the Rust
            scaffold at `backend-rust/`. Do not run this script.
            """
            print("reddit_ingest.py deprecated. Use backend-rust instead.")
