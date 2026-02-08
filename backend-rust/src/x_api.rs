use crate::db::PgPool;
use crate::sentiment::Sentiment;
use dotenvy::var;
use chrono::Utc;
use std::time::Duration;

pub async fn run(pool: &PgPool, sent: &Sentiment) -> anyhow::Result<()> {
    let bearer = var("X_BEARER_TOKEN").unwrap_or_default();
    if bearer.is_empty() {
        println!("X_BEARER_TOKEN not set; exiting");
        return Ok(());
    }
    println!("Starting X poller (simple recent search)");
    loop {
        if let Err(e) = poll_recent(&bearer, pool, sent).await {
            println!("X poll error: {}", e);
        }
        tokio::time::sleep(Duration::from_secs(5)).await;
    }
}

async fn poll_recent(bearer: &str, pool: &PgPool, sent: &Sentiment) -> anyhow::Result<()> {
    // simple search for $TICKER like tokens in recent tweets - placeholder
    let url = "https://api.twitter.com/2/tweets/search/recent?query=$AAPL OR $TSLA -is:retweet&tweet.fields=author_id,created_at,text&max_results=10";
    let client = reqwest::Client::new();
    let resp = client.get(url).bearer_auth(bearer).send().await?;
    if !resp.status().is_success() {
        anyhow::bail!("Twitter API returned {}", resp.status());
    }
    let body: serde_json::Value = resp.json().await?;
    if let Some(data) = body.get("data") {
        let mut conn = pool.get().await?;
        for t in data.as_array().unwrap_or(&vec![]) {
            let id = t.get("id").and_then(|v| v.as_str()).unwrap_or_default();
            let text = t.get("text").and_then(|v| v.as_str()).unwrap_or_default();
            let author = t.get("author_id").and_then(|v| v.as_str()).unwrap_or_default();
            let created = t.get("created_at").and_then(|v| v.as_str()).unwrap_or_else(|| Utc::now().to_rfc3339().as_str());
            let created_dt = created.parse::<chrono::DateTime<Utc>>().unwrap_or_else(|_| Utc::now());

            // crude extract
            let syms = extract_symbols(text).await;
            if syms.is_empty() { continue; }
            let score = sent.predict_text(text).await.unwrap_or(0.0);
            for s in syms {
                let _ = conn.execute(
                    "INSERT INTO TRADING_TWEET (tweet_id, symbol, author_id, tweet_text, created_at, engagement_score, indexed_at) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (tweet_id) DO NOTHING",
                    &[&id.parse::<i64>().ok(), &s, &author.parse::<i64>().ok(), &text, &created_dt, &0_i32, &Utc::now()]
                ).await;
                let _ = conn.execute(
                    "INSERT INTO SENTIMENT_METRIC (time, symbol, source_id, score, confidence, model_used, tweet_id, post_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
                    &[&Utc::now(), &s, &"x", &score, &Option::<f32>::None, &"finbert", &id.parse::<i64>().ok(), &Option::<String>::None]
                ).await;
            }
        }
    }
    Ok(())
}

async fn extract_symbols(text: &str) -> Vec<String> {
    let mut out = vec![];
    for token in text.split(|c: char| !c.is_alphanumeric() && c != '$') {
        if token.is_empty() { continue; }
        let t = token.trim_start_matches('$').to_uppercase();
        if t.len() >= 1 && t.len() <= 5 && t.chars().all(|c| c.is_ascii_uppercase()) {
            out.push(t);
        }
    }
    out
}
