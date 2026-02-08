use deadpool_postgres::{Manager, ManagerConfig, Pool, RecyclingMethod};
use tokio_postgres::{NoTls};
use std::env;

pub type PgPool = Pool;

pub fn init_pool() -> anyhow::Result<PgPool> {
    let host = env::var("DB_HOST").unwrap_or_else(|_| "localhost".into());
    let port = env::var("DB_PORT").unwrap_or_else(|_| "5432".into());
    let user = env::var("DB_USER").unwrap_or_else(|_| "postgres".into());
    let pass = env::var("DB_PASS").unwrap_or_else(|_| "alphapass".into());
    let db = env::var("DB_NAME").unwrap_or_else(|_| "postgres".into());

    let connstr = format!("host={} port={} user={} password={} dbname={}", host, port, user, pass, db);

    let cfg: tokio_postgres::Config = connstr.parse()?;
    let mgr = Manager::from_config(cfg, NoTls, ManagerConfig { recycling_method: RecyclingMethod::Fast });
    let pool = Pool::builder(mgr).max_size(16).build()?;
    Ok(pool)
}
