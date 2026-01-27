from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import pandas as pd
import torch
from transformers import DistilBertTokenizer, DistilBertForSequenceClassification
from transformers_interpret import SequenceClassificationExplainer
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI()

# Enable CORS (Allows Next.js to talk to this Python script)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, replace with specific domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 1. LOAD DATA ---
# We load this once when the server starts
try:
    df = pd.read_csv("final_app_database.csv")
    df['text'] = df['text'].astype(str) # Ensure text is string
    print("✅ Database loaded successfully")
except Exception as e:
    print(f"❌ Database Error: {e}")
    df = pd.DataFrame()

# --- 2. LOAD AI MODEL ---
try:
    model_path = "Models"
    tokenizer = DistilBertTokenizer.from_pretrained(model_path)
    model = DistilBertForSequenceClassification.from_pretrained(model_path)
    explainer = SequenceClassificationExplainer(model, tokenizer)
    print("✅ AI Models loaded successfully")
except Exception as e:
    print(f"❌ Model Error: {e}")
    explainer = None

# --- API ENDPOINTS ---

@app.get("/")
def home():
    return {"message": "TrustXplain API is Online 🛡️"}

@app.get("/restaurants")
def get_restaurants():
    """Returns list of all unique restaurant names for the dropdown"""
    if df.empty:
        return []
    return df['name'].unique().tolist()

@app.get("/search")
def search_restaurant(name: str):
    """Returns trust metrics and top reviews for a specific restaurant"""
    if df.empty:
        raise HTTPException(status_code=500, detail="Database not loaded")
    
    subset = df[df['name'] == name]
    if subset.empty:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    # Calculate Stats
    total = len(subset)
    fakes = len(subset[subset['deception_prediction'] == 'deceptive'])
    real = total - fakes
    trust_score = int(((total - fakes) / total) * 100)
    
    # Get top 10 reviews
    reviews_data = []
    for _, row in subset.head(10).iterrows():
        reviews_data.append({
            "text": row['text'],
            "stars": int(row['stars']),
            "is_fake": True if row['deception_prediction'] == 'deceptive' else False,
            "is_mismatch": bool(row['inconsistency_flag'])
        })
        
    return {
        "stats": {
            "total": total,
            "fakes": fakes,
            "real": real,
            "trust_score": trust_score
        },
        "reviews": reviews_data
    }

class ExplainRequest(BaseModel):
    text: str

@app.post("/explain")
def explain_review(request: ExplainRequest):
    """Runs XAI on demand for a single text"""
    if not explainer:
        raise HTTPException(status_code=500, detail="Model not active")
    
    # Run Inference
    word_attributions = explainer(request.text)
    
    # Format for frontend (Word, Score)
    # We filter out special tokens like [CLS], [SEP]
    clean_data = []
    for word, score in word_attributions:
        if word not in ["[CLS]", "[SEP]"]:
            clean_word = word.replace("##", "") # Fix subwords
            clean_data.append({"word": clean_word, "score": score})
            
    return {"explanation": clean_data}