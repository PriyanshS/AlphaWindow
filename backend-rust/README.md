Alphawindow Rust Ingest

This scaffold contains a Rust-based ingestion pipeline for market, Reddit, and X (Twitter) data.

Quick start

1. Copy `.env.example` to `.env` and fill credentials.
2. Build:

```bash
cd backend-rust
cargo build --release
```

3. Run market replay for symbols:

```bash
RUST_LOG=info cargo run --release -- --component market --tickers NVDA,TSLA --period 7d
```

4. Run Reddit poller:

```bash
RUST_LOG=info cargo run --release -- --component reddit
```

5. Run X poller (set `X_BEARER_TOKEN`):

```bash
RUST_LOG=info cargo run --release -- --component x
```

Notes
- This is a starter scaffold. For production you should run as supervised services, add batching, backpressure, and optional Kafka layer later.
- Sentiment inference uses ONNX runtime if `FINBERT_ONNX_PATH` is set; otherwise it falls back to the HTTP FinBERT service at `FINBERT_URL`.
