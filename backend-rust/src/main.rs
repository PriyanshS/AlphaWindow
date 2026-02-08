use clap::Parser;
use dotenvy::dotenv;
use std::time::Duration;

mod db;
mod market;
mod reddit;
mod x_api;
mod sentiment;

#[derive(Parser, Debug)]
#[command(author, version, about)]
struct Args {
    /// Component to run: market | reddit | x
    #[arg(long)]
    component: String,

    /// comma separated tickers
    #[arg(long)]
    tickers: Option<String>,

    /// period for market replay (e.g. 1d,7d)
    #[arg(long, default_value = "1d")]
    period: String,
}

#[tokio::main(flavor = "multi_thread")]
async fn main() -> anyhow::Result<()> {
    dotenv().ok();
    let args = Args::parse();

    // init DB pool
    let pool = db::init_pool()?;

    // init sentiment engine (loads ONNX if configured)
    let sent = sentiment::Sentiment::new().await?;

    match args.component.as_str() {
        "market" => {
            let list = args.tickers.unwrap_or_default();
            let tickers: Vec<String> = list.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
            market::replay(tickers, &pool, &sent, &args.period).await?;
        }
        "reddit" => {
            reddit::run(&pool, &sent).await?;
        }
        "x" => {
            x_api::run(&pool, &sent).await?;
        }
        _ => {
            println!("Unknown component: {}", args.component);
        }
    }

    // keep alive briefly
    tokio::time::sleep(Duration::from_secs(1)).await;
    Ok(())
}
