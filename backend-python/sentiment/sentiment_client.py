import os
import httpx

FINBERT_URL = os.getenv('FINBERT_URL', 'http://localhost:8000')

async def predict_batch(texts):
    url = FINBERT_URL.rstrip('/') + '/predict'
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, json={"texts": texts})
        resp.raise_for_status()
        return resp.json().get('scores', [])

# sync wrapper for convenience
def predict_batch_sync(texts):
    import requests
    url = FINBERT_URL.rstrip('/') + '/predict'
    r = requests.post(url, json={"texts": texts}, timeout=30)
    r.raise_for_status()
    return r.json().get('scores', [])
