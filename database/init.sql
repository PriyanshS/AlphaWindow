-- 1. Ticker Master Table
CREATE TABLE IF NOT EXISTS tickers (
    symbol VARCHAR(10) PRIMARY KEY,
    name TEXT,
    sector TEXT
);

-- 2. Market Data Table (Time-Series)
CREATE TABLE IF NOT EXISTS market_ticks (
    time TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(10) REFERENCES tickers(symbol),
    price DOUBLE PRECISION NOT NULL,
    volume INTEGER
);

-- 3. Sentiment Data Table (Time-Series)
CREATE TABLE IF NOT EXISTS sentiment_metrics (
    time TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(10) REFERENCES tickers(symbol),
    hype_score DOUBLE PRECISION,
    mention_count INTEGER
);

-- 4. Convert to TimescaleDB Hypertables
-- This partitions data by time automatically!
SELECT create_hypertable('market_ticks', 'time', if_not_exists => TRUE);
SELECT create_hypertable('sentiment_metrics', 'time', if_not_exists => TRUE);

-- 5. Seed some initial data
INSERT INTO tickers (symbol, name, sector) VALUES 
('NVDA', 'Nvidia Corp', 'Technology'),
('TSLA', 'Tesla Inc', 'Automotive'),
('BTC', 'Bitcoin', 'Crypto');