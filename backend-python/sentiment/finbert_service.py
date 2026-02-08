from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
import os
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import numpy as np

app = FastAPI()

MODEL_NAME = os.getenv('FINBERT_MODEL', 'yiyanghkust/finbert-tone')
DEVICE = 0 if torch.cuda.is_available() else -1

class Texts(BaseModel):
    texts: List[str]

# Load model/tokenizer on startup
@app.on_event("startup")
def load_model():
    global tokenizer, model, labels
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    model = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME)
    if torch.cuda.is_available():
        model.to('cuda')

@app.post('/predict')
async def predict(body: Texts):
    # returns list of scores in range [-1,1]
    texts = body.texts
    if not texts:
        return {"scores": []}
    inputs = tokenizer(texts, truncation=True, padding=True, return_tensors='pt')
    if torch.cuda.is_available():
        inputs = {k: v.to('cuda') for k, v in inputs.items()}
    with torch.no_grad():
        out = model(**inputs)
        probs = torch.softmax(out.logits, dim=-1).cpu().numpy()
    # Many FinBERT variants use label order [negative, neutral, positive]
    # We'll compute score = P(pos) - P(neg) -> in [-1,1]
    scores = []
    for p in probs:
        # ensure length 3
        if p.shape[0] >= 3:
            neg = p[0]
            pos = p[2]
            score = float(pos - neg)
        else:
            # fallback: map single-label to -1..1
            score = float(p[0])
        scores.append(score)
    return {"scores": scores}
