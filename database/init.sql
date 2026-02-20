-- ============================================================================
-- AlphaWindow: Comprehensive Database Schema
-- TimescaleDB (PostgreSQL) optimized for real-time market & sentiment data
-- ============================================================================

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- ============================================================================
-- 1. USER MANAGEMENT
-- ============================================================================
CREATE TABLE IF NOT EXISTS "USER" (
  user_id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  account_plan VARCHAR(50) DEFAULT 'free',
  api_usage_limit INT DEFAULT 1000,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 2. API KEYS & AUTHENTICATION
-- ============================================================================
CREATE TABLE IF NOT EXISTS "API_KEY" (
  key_id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES "USER"(user_id) ON DELETE CASCADE,
  api_key VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE
);

-- ============================================================================
-- 3. TICKERS (Reference Table)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "TICKERS" (
  symbol VARCHAR(20) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  sector VARCHAR(100),
  exchange VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 4. USER WATCHLISTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS "WATCHLIST" (
  watchlist_id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES "USER"(user_id) ON DELETE CASCADE,
  watchlist_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "WATCHLIST_CONTAINS" (
  watchlist_id INT NOT NULL REFERENCES "WATCHLIST"(watchlist_id) ON DELETE CASCADE,
  symbol VARCHAR(20) NOT NULL REFERENCES "TICKERS"(symbol) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (watchlist_id, symbol)
);

-- ============================================================================
-- 5. MARKET DATA - PRICE TICKS (Time-Series Hypertable)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "PRICE_TICK" (
  time TIMESTAMPTZ NOT NULL,
  symbol VARCHAR(20) NOT NULL REFERENCES "TICKERS"(symbol) ON DELETE CASCADE,
  open DOUBLE PRECISION,
  high DOUBLE PRECISION,
  low DOUBLE PRECISION,
  close DOUBLE PRECISION NOT NULL,
  volume BIGINT,
  vwap DOUBLE PRECISION
);

-- Convert to hypertable for optimized time-series storage
SELECT create_hypertable('PRICE_TICK', 'time', if_not_exists => TRUE);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_price_tick_symbol_time ON "PRICE_TICK" (symbol, time DESC);
CREATE INDEX IF NOT EXISTS idx_price_tick_time ON "PRICE_TICK" (time DESC);

-- ============================================================================
-- 6. SOCIAL MEDIA DATA - TWEETS/POSTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS "TRADING_TWEET" (
  tweet_id BIGINT PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL REFERENCES "TICKERS"(symbol) ON DELETE CASCADE,
  author_id BIGINT,
  tweet_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  engagement_score INT DEFAULT 0,
  indexed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tweet_symbol_created ON "TRADING_TWEET" (symbol, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tweet_time ON "TRADING_TWEET" (created_at DESC);

-- ============================================================================
-- 7. SOCIAL MEDIA DATA - REDDIT
-- ============================================================================
CREATE TABLE IF NOT EXISTS "REDDIT_POST" (
  post_id VARCHAR(255) PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL REFERENCES "TICKERS"(symbol) ON DELETE CASCADE,
  subreddit VARCHAR(100) NOT NULL,
  author VARCHAR(100),
  title TEXT NOT NULL,
  content TEXT,
  signal_type VARCHAR(50),
  strength FLOAT,
  timestamp TIMESTAMPTZ NOT NULL,
  expiry TIMESTAMPTZ,
  score INT DEFAULT 0,
  indexed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "REDDIT_COMMENT" (
  comment_id VARCHAR(255) PRIMARY KEY,
  post_id VARCHAR(255) NOT NULL REFERENCES "REDDIT_POST"(post_id) ON DELETE CASCADE,
  author VARCHAR(100),
  content TEXT NOT NULL,
  score INT DEFAULT 0,
  timestamp TIMESTAMPTZ NOT NULL,
  indexed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reddit_post_symbol ON "REDDIT_POST" (symbol, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_reddit_post_time ON "REDDIT_POST" (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_reddit_comment_post ON "REDDIT_COMMENT" (post_id);

-- ============================================================================
-- 8. INSIDER TRADING DATA
-- ============================================================================
CREATE TABLE IF NOT EXISTS "INSIDER_POST" (
  insider_id VARCHAR(255) PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL REFERENCES "TICKERS"(symbol) ON DELETE CASCADE,
  insider_name VARCHAR(255),
  transaction_type VARCHAR(50),
  shares INT,
  price DOUBLE PRECISION,
  value DOUBLE PRECISION,
  timestamp TIMESTAMPTZ NOT NULL,
  indexed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_insider_symbol ON "INSIDER_POST" (symbol, timestamp DESC);

-- ============================================================================
-- 9. SENTIMENT ANALYSIS RESULTS (Time-Series Hypertable)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "SENTIMENT_METRIC" (
  time TIMESTAMPTZ NOT NULL,
  metric_id SERIAL,
  symbol VARCHAR(20) NOT NULL REFERENCES "TICKERS"(symbol) ON DELETE CASCADE,
  source_id VARCHAR(50) NOT NULL,
  score FLOAT NOT NULL,
  confidence FLOAT,
  model_used VARCHAR(100),
  tweet_id BIGINT REFERENCES "TRADING_TWEET"(tweet_id) ON DELETE SET NULL,
  post_id VARCHAR(255) REFERENCES "REDDIT_POST"(post_id) ON DELETE SET NULL
);

-- Convert to hypertable for optimized time-series storage
SELECT create_hypertable('SENTIMENT_METRIC', 'time', if_not_exists => TRUE);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sentiment_symbol_time ON "SENTIMENT_METRIC" (symbol, time DESC);
CREATE INDEX IF NOT EXISTS idx_sentiment_time ON "SENTIMENT_METRIC" (time DESC);
CREATE INDEX IF NOT EXISTS idx_sentiment_source ON "SENTIMENT_METRIC" (source_id);

-- ============================================================================
-- 10. LAG CORRELATION ANALYSIS RESULTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS "CORRELATION_MATRIX" (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL REFERENCES "TICKERS"(symbol) ON DELETE CASCADE,
  lag_seconds INT NOT NULL,
  lag_minutes INT GENERATED ALWAYS AS (lag_seconds / 60) STORED,
  coefficient FLOAT NOT NULL,
  p_value FLOAT,
  strength FLOAT,
  correlation_type VARCHAR(50),
  calculated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  analysis_window VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_correlation_symbol ON "CORRELATION_MATRIX" (symbol);
CREATE INDEX IF NOT EXISTS idx_correlation_lag ON "CORRELATION_MATRIX" (lag_seconds);

-- ============================================================================
-- 11. LAG CONFIGURATION (For Analysis Parameters)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "LAG_CONFIG" (
  config_id SERIAL PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL REFERENCES "TICKERS"(symbol) ON DELETE CASCADE,
  min_lag_seconds INT DEFAULT 0,
  max_lag_seconds INT DEFAULT 3600,
  step_seconds INT DEFAULT 60,
  min_confidence FLOAT DEFAULT 0.7,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 12. CONTINUOUS AGGREGATES (For fast historical analysis)
-- ============================================================================
-- 1-minute aggregated sentiment
CREATE MATERIALIZED VIEW IF NOT EXISTS sentiment_1min_agg AS
SELECT
  time_bucket('1 minute', time) AS minute,
  symbol,
  AVG(score) AS avg_sentiment,
  COUNT(*) AS count,
  STDDEV(score) AS stddev_sentiment
FROM "SENTIMENT_METRIC"
GROUP BY minute, symbol;

-- 5-minute price aggregation
CREATE MATERIALIZED VIEW IF NOT EXISTS price_5min_agg AS
SELECT
  time_bucket('5 minutes', time) AS minute,
  symbol,
  FIRST(open, time) AS open,
  MAX(high) AS high,
  MIN(low) AS low,
  LAST(close, time) AS close,
  SUM(volume) AS volume
FROM "PRICE_TICK"
GROUP BY minute, symbol;

-- ============================================================================
-- 13. SAMPLE DATA INSERTION
-- ============================================================================
INSERT INTO "TICKERS" (symbol, name, sector, exchange, is_active) VALUES
  ('NVDA', 'NVIDIA Corporation', 'Technology', 'NASDAQ', TRUE),
  ('TSLA', 'Tesla Inc', 'Automotive', 'NASDAQ', TRUE),
  ('BTC', 'Bitcoin', 'Cryptocurrency', 'CRYPTO', TRUE),
  ('AAPL', 'Apple Inc', 'Technology', 'NASDAQ', TRUE),
  ('MSFT', 'Microsoft Corporation', 'Technology', 'NASDAQ', TRUE)
ON CONFLICT (symbol) DO NOTHING;
