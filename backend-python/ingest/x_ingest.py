#!/usr/bin/env python3
"""X (Twitter) ingestion starter using Tweepy v2 streaming.
Requires environment variables for the bearer token:
- X_BEARER_TOKEN

This script provides a template for connecting to the filtered stream and inserting
matching tweets to DB. For quick testing the script also supports polling via the REST API.
"""
import os
import time
import re
from datetime import datetime
import tweepy
from ingest import db
from ..sentiment import sentiment_client

TICKER_REGEX = re.compile(r"\$?\b[A-Z]{1,5}\b")


def extract_symbols(text, known_tickers):
    found = set(m.group(0).lstrip('$') for m in TICKER_REGEX.finditer(text))
    return [s for s in found if s in known_tickers]


class TweetStream(tweepy.StreamingClient):
    def __init__(self, bearer_token, known_tickers):
        super().__init__(bearer_token)
        """
        DEPRECATED: Python x_ingest

        This file is kept for reference only. The production ingestion now uses the Rust
        scaffold at `backend-rust/`. Do not run this script.
        """
        print("x_ingest.py deprecated. Use backend-rust instead.")
                return
