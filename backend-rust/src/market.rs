use crate::db::PgPool;
use crate::sentiment::Sentiment;
use chrono::{DateTime, Utc};
use csv::ReaderBuilder;
use futures::StreamExt;
use std::time::Duration;
use anyhow::Context;

pub async fn replay(tickers: Vec<String>, pool: &PgPool, sent: &Sentiment, period: &str) -> anyhow::Result<()> {
    if tickers.is_empty() {
        println!("No tickers provided");
        return Ok(());
    }

    for sym in tickers {
        println!("Fetching {} for period {}", sym, period);
        // Use Yahoo finance CSV download as a simple source
        let url = format!("https://query1.finance.yahoo.com/v7/finance/download/{}?period1=0&period2=9999999999&interval=1m&events=history&includeAdjustedClose=true", sym);
        let resp = reqwest::get(&url).await.context("failed http")?;
        if !resp.status().is_success() {
            println!("Yahoo returned {} for {}", resp.status(), sym);
            continue;
        }
        let body = resp.text().await?;
        let mut rdr = ReaderBuilder::new().from_reader(body.as_bytes());
        let mut rows = vec![];
        for result in rdr.records() {
            let record = result?;
            // CSV: Date,Open,High,Low,Close,Adj Close,Volume
            let dt = DateTime::parse_from_rfc3339(&format!("{}T00:00:00Z", &record[0])).or_else(|_| DateTime::parse_from_str(&record[0], "%Y-%m-%d %H:%M:%S"))
                .unwrap_or_else(|_| Utc::now().into());
            let close: f64 = record.get(4).unwrap_or("0").parse().unwrap_or(0.0);
            let open = record.get(1).and_then(|v| v.parse().ok()).unwrap_or(close);
            let high = record.get(2).and_then(|v| v.parse().ok()).unwrap_or(close);
            let low = record.get(3).and_then(|v| v.parse().ok()).unwrap_or(close);
            let volume = record.get(6).and_then(|v| v.parse::<i64>().ok()).unwrap_or(0);
            rows.push((dt.with_timezone(&Utc), sym.clone(), open, high, low, close, volume, Option::<f64>::None));
            if rows.len() >= 500 {
                insert_chunk(&rows, pool).await?;
                rows.clear();
            }
        }
        if !rows.is_empty() {
            insert_chunk(&rows, pool).await?;
        }
        // be courteous
        tokio::time::sleep(Duration::from_secs(1)).await;
    }
    Ok(())
}

async fn insert_chunk(rows: &Vec<(DateTime<Utc>, String, f64, f64, f64, f64, i64, Option<f64>)>, pool: &PgPool) -> anyhow::Result<()> {
    let client = pool.get().await?;
    let tx = client.transaction().await?;
    for r in rows.iter() {
        tx.execute(
            "INSERT INTO PRICE_TICK (time, symbol, open, high, low, close, volume, vwap) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING",
            &[&r.0, &r.1, &r.2, &r.3, &r.4, &r.5, &r.6, &r.7],
        ).await?;
    }
    tx.commit().await?;
    Ok(())
}
