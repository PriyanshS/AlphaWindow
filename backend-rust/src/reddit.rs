use crate::db::PgPool;
use crate::sentiment::Sentiment;
use dotenvy::var;
use serde::Deserialize;
use chrono::{DateTime, Utc};
use std::time::Duration;

#[derive(Deserialize)]
struct RedditPost {
    id: String,
    title: Option<String>,
    selftext: Option<String>,
    subreddit: String,
    author: Option<String>,
    created_utc: f64,
    score: i32,
}

pub async fn run(pool: &PgPool, sent: &Sentiment) -> anyhow::Result<()> {
    let subs = var("SUBREDDITS").unwrap_or_else(|_| "wallstreetbets,stocks".into());
    let list: Vec<&str> = subs.split(',').map(|s| s.trim()).collect();
    println!("Polling subreddits: {:?}", list);
    loop {
        for s in &list {
            if let Err(e) = poll_subreddit(s, pool, sent).await {
                println!("Error polling {}: {}", s, e);
            }
            tokio::time::sleep(Duration::from_millis(500)).await;
        }
        tokio::time::sleep(Duration::from_secs(5)).await;
    }
}

async fn poll_subreddit(sub: &str, pool: &PgPool, sent: &Sentiment) -> anyhow::Result<()> {
    let url = format!("https://www.reddit.com/r/{}/new.json?limit=25", sub);
    let client = reqwest::Client::new();
    let resp = client.get(&url).header("User-Agent", var("REDDIT_USER_AGENT").unwrap_or_else(|_| "AlphaWindowRust/0.1".into())).send().await?;
    if !resp.status().is_success() {
        anyhow::bail!("reddit http {}", resp.status());
    }
    let body: serde_json::Value = resp.json().await?;
    let items = body["data"]["children"].as_array().unwrap_or(&vec![]);
    let mut conn = pool.get().await?;
    for it in items.iter() {
        let d = &it["data"];
        let id = d["id"].as_str().unwrap_or_default().to_string();
        let title = d["title"].as_str().map(|s| s.to_string());
        let selftext = d["selftext"].as_str().map(|s| s.to_string());
        let subreddit = d["subreddit"].as_str().unwrap_or(sub).to_string();
        let author = d["author"].as_str().map(|s| s.to_string());
        let created_utc = d["created_utc"].as_f64().unwrap_or_else(|| Utc::now().timestamp() as f64);
        let score = d["score"].as_i64().unwrap_or(0) as i32;
        let when = DateTime::<Utc>::from_utc(chrono::NaiveDateTime::from_timestamp(created_utc as i64, 0), Utc);

        // naive ticker extraction: look for $TICK or uppercase words
        let text = format!("{}\n{}", title.clone().unwrap_or_default(), selftext.clone().unwrap_or_default());
        let syms = extract_symbols(&text).await;
        if syms.is_empty() {
            continue;
        }

        // call sentiment
        let score_val = sent.predict_text(&text).await.unwrap_or(0.0);

        for sym in syms {
            // insert post
            let _ = conn.execute(
                "INSERT INTO REDDIT_POST (post_id, symbol, subreddit, author, title, content, signal_type, strength, timestamp, expiry, score, indexed_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (post_id) DO NOTHING",
                &[&id, &sym, &subreddit, &author, &title, &selftext, &Option::<String>::None, &Option::<f64>::None, &when, &Option::<chrono::DateTime<Utc>>::None, &score, &chrono::Utc::now()]
            ).await;

            // insert sentiment
            let _ = conn.execute(
                "INSERT INTO SENTIMENT_METRIC (time, symbol, source_id, score, confidence, model_used, tweet_id, post_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
                &[&chrono::Utc::now(), &sym, &"reddit", &score_val, &Option::<f32>::None, &"finbert", &Option::<i64>::None, &Some(id.clone())]
            ).await;
        }
    }
    Ok(())
}

async fn extract_symbols(text: &str) -> Vec<String> {
    // crude: extract $TICK or uppercase words up to 5 letters
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
