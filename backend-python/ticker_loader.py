import psycopg2
from openbb import obb

def load_trending_tickers():
    try:
        # 1. Logic: Use the 'sec' provider which is free and built-in
        print("Fetching tickers from SEC EDGAR (via OpenBB)...")
        
        # We fetch the top companies. SEC returns them sorted by market cap.
        # This gives us the 'biggest' names like AAPL, NVDA, etc.
        data = obb.equity.search("", provider="sec").to_dataframe()
        
        # We only want the top 50 to keep our database clean for now
        top_50 = data.head(50)

        # 2. Logic: Connect to your Docker DB
        conn = psycopg2.connect(
            host="localhost",
            user="postgres",
            password="alphapass",
            dbname="postgres"
        )
        cur = conn.cursor()

        # 3. Logic: Loop and Upsert
        count = 0
        for _, row in top_50.iterrows():
            symbol = row['symbol']
            name = row['name']
            # SEC doesn't always provide 'sector' in this call, 
            # so we'll use 'Unknown' as a fallback
            sector = "Unknown" 

            cur.execute("""
                INSERT INTO tickers (symbol, name, sector)
                VALUES (%s, %s, %s)
                ON CONFLICT (symbol) DO UPDATE 
                SET name = EXCLUDED.name;
            """, (symbol, name, sector))
            count += 1

        conn.commit()
        print(f"Successfully synced {count} tickers from SEC to the DB.")
        
        cur.close()
        conn.close()

    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    load_trending_tickers()