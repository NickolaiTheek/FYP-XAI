from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import pandas as pd
import torch
from transformers import DistilBertTokenizer, DistilBertForSequenceClassification
from transformers_interpret import SequenceClassificationExplainer
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 1. LOAD DATA ---
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

# --- HELPER FUNCTIONS (NEW) ---

def clean_token(word):
    """Removes special BERT characters like ## from words"""
    return word.replace("##", "").strip()

def analyze_risk_factors(explanation_list):
    """
    Extracts the top 3 'Evidence Words' and assigns them an impact level.
    """
    # 1. Filter for words that look "Fake" (Positive Score)
    # We also ignore tiny words (len < 3) and special tokens
    suspicious_words = [
        (clean_token(word), score) for word, score in explanation_list 
        if score > 0 and len(clean_token(word)) > 2 and word not in ["[CLS]", "[SEP]"]
    ]
    
    # 2. Sort by highest score first (Biggest Red Flags)
    suspicious_words.sort(key=lambda x: x[1], reverse=True)
    
    evidence = []
    # Take top 3 unique words
    seen = set()
    for word, score in suspicious_words:
        if word in seen: continue
        seen.add(word)
        if len(evidence) >= 3: break
        
        # Determine Impact Level
        impact = "Medium"
        color = "orange"
        if score > 0.05:
            impact = "High"
            color = "red"
            
        evidence.append({
            "word": word,
            "impact": impact,
            "color": color,
            "reason": "Generic / Filler" if impact == "High" else "Unusual Phrasing"
        })
        
    return evidence

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
    
    # Avoid division by zero
    trust_score = 0
    if total > 0:
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
    """Runs XAI and generates the Professional Audit Report"""
    if not explainer:
        raise HTTPException(status_code=500, detail="Model not active")
    
    # 1. Run Inference
    word_attributions = explainer(request.text)
    
    # 2. Calculate Overall Risk Score (0-100)
    # Sum of positive (fake) scores vs total absolute signal
    fake_signal = sum([score for _, score in word_attributions if score > 0])
    total_signal = sum([abs(score) for _, score in word_attributions])
    
    risk_percent = 0
    if total_signal > 0:
        risk_percent = int((fake_signal / total_signal) * 100)
        
    # 3. Generate Audit Data
    is_high_risk = risk_percent > 50
    evidence = analyze_risk_factors(word_attributions)
    
    # 4. Generate the "Executive Summary" sentence
    summary = ""
    if is_high_risk:
        summary = f"This review is flagged as **High Risk** ({risk_percent}% probability). The AI detected patterns common in paid spam, specifically relying on generic keywords rather than specific details."
    else:
        summary = f"This review is verified as **Authentic** ({100 - risk_percent}% confidence). The language contains specific, personal details that align with genuine customer feedback."

    # 5. Format the Clean Raw Data (for the text underlining in Frontend)
    clean_raw_data = []
    for word, score in word_attributions:
        if word not in ["[CLS]", "[SEP]"]:
            clean_raw_data.append({"word": clean_token(word), "score": score})

    # 6. Return the Full Report
    return {
        "risk_score": risk_percent,
        "verdict": "CRITICAL ISSUES FOUND" if is_high_risk else "AUTHENTICITY VERIFIED",
        "verdict_color": "red" if is_high_risk else "green",
        "summary": summary,
        "evidence": evidence,       # For the "Cards"
        "raw_explanation": clean_raw_data # For the "Text Annotations"
    }