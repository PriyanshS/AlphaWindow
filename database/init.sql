create table if not exists ticker(
  symbol text primary key,
  name text,
  sector text,
  created_at timestamp default current_timestamp
);
create table if not exists market_ticks(
  time timestamptz not null,
  symbol text not null,
  price double precision not null,
  volume int 
);
create table if not exists sentiment_metrics(
  time timestamptz not null,
  symbol text not null,
  sentiment_score float,
  source text 
);
insert into ticker(symbol,name,sector) values(
  'NVDA','Nvidia Corp','Technology'),
('TSLA','Tesla inc','Automotive'),
('BTC','Bitcoin','Crypto')
on conflict (symbol) do nothing;


