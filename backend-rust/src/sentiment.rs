use std::env;
use reqwest::Client;

pub struct Sentiment {
    http_fallback: String,
    client: Client,
}

impl Sentiment {
    pub async fn new() -> anyhow::Result<Sentiment> {
        let http = env::var("FINBERT_URL").unwrap_or_else(|_| "http://localhost:8000".into());
        Ok(Sentiment { http_fallback: http, client: Client::new() })
    }

    pub async fn predict_text(&self, text: &str) -> Option<f64> {
        // Call HTTP FinBERT service at /predict
        let url = format!("{}/predict", self.http_fallback.trim_end_matches('/'));
        let body = serde_json::json!({"texts": [text]});
        let resp = self.client.post(&url).json(&body).send().await;
        match resp {
            Ok(r) => {
                if let Ok(j) = r.json::<serde_json::Value>().await {
                    if let Some(arr) = j.get("scores") {
                        if let Some(s) = arr.get(0) {
                            return s.as_f64();
                        }
                    }
                }
                None
            }
            Err(_) => None,
        }
    }
}
