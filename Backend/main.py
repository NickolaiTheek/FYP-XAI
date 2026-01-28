from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import pandas as pd
import torch
from transformers import DistilBertTokenizer, DistilBertForSequenceClassification
from transformers_interpret import SequenceClassificationExplainer
from fastapi.middleware.cors import CORSMiddleware
from textblob import TextBlob  # 🆕 For Sentiment/Consistency Check
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
    df['text'] = df['text'].astype(str)
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

# --- HELPER FUNCTIONS ---

def clean_token(word):
    """Removes special BERT characters like ## from words"""
    return word.replace("##", "").strip()

def analyze_risk_factors(explanation_list):
    """Extracts the top 3 'Evidence Words'."""
    suspicious_words = [
        (clean_token(word), score) for word, score in explanation_list 
        if score > 0 and len(clean_token(word)) > 2 and word not in ["[CLS]", "[SEP]"]
    ]
    suspicious_words.sort(key=lambda x: x[1], reverse=True)
    
    evidence = []
    seen = set()
    for word, score in suspicious_words:
        if word in seen: continue
        seen.add(word)
        if len(evidence) >= 3: break
        
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
    if df.empty: return []
    return df['name'].unique().tolist()

@app.get("/search")
def search_restaurant(name: str):
    if df.empty: raise HTTPException(status_code=500, detail="Database not loaded")
    
    subset = df[df['name'] == name]
    if subset.empty: raise HTTPException(status_code=404, detail="Restaurant not found")
    
    total = len(subset)
    fakes = len(subset[subset['deception_prediction'] == 'deceptive'])
    real = total - fakes
    trust_score = int(((total - fakes) / total) * 100) if total > 0 else 0
    
    reviews_data = []
    for _, row in subset.head(10).iterrows():
        reviews_data.append({
            "text": row['text'],
            "stars": int(row['stars']),
            "is_fake": True if row['deception_prediction'] == 'deceptive' else False,
            "is_mismatch": bool(row['inconsistency_flag'])
        })
        
    return {
        "stats": {"total": total, "fakes": fakes, "real": real, "trust_score": trust_score},
        "reviews": reviews_data
    }

# 🆕 Updated Request Model to include stars
class ExplainRequest(BaseModel):
    text: str
    stars: int 

@app.post("/explain")
def explain_review(request: ExplainRequest):
    """Runs XAI, Sentiment Analysis, and generates the Professional Audit Report"""
    if not explainer:
        raise HTTPException(status_code=500, detail="Model not active")
    
    # 1. Run Inference (XAI)
    word_attributions = explainer(request.text)
    
    fake_signal = sum([score for _, score in word_attributions if score > 0])
    total_signal = sum([abs(score) for _, score in word_attributions])
    
    risk_percent = 0
    if total_signal > 0:
        risk_percent = int((fake_signal / total_signal) * 100)
        
    is_high_risk = risk_percent > 50

    # 2. Sentiment & Consistency Analysis (For the Bar Chart)
    try:
        blob = TextBlob(request.text)
        sentiment_val = blob.sentiment.polarity # -1.0 to 1.0
        # Normalize to 0-100 scale (where 50 is neutral)
        sentiment_score = int((sentiment_val + 1) * 50)
    except:
        sentiment_score = 50 # Default to neutral if fails

    # Normalize Stars to 0-100 scale
    rating_score = int((request.stars / 5) * 100)
    
    # Calculate Gap
    consistency_gap = abs(rating_score - sentiment_score)
    is_mismatch = consistency_gap > 35 # Threshold for visual warning

    # 3. Generate Trust Badges (The "Chips")
    badges = []
    if is_high_risk:
        # Fake Badges
        if len(analyze_risk_factors(word_attributions)) > 0:
            badges.append({"label": "Generic Keywords", "type": "yellow", "icon": "⚠️"})
        if is_mismatch:
            badges.append({"label": "High Inconsistency", "type": "red", "icon": "⛔"})
        else:
            badges.append({"label": "Deceptive Patterns", "type": "red", "icon": "🚨"})
    else:
        # Genuine Badges
        badges.append({"label": "Consistent Rating", "type": "green", "icon": "✅"})
        if sentiment_score > 60:
            badges.append({"label": "Positive Sentiment", "type": "blue", "icon": "✅"})
        if risk_percent < 20:
             badges.append({"label": "Specific Language", "type": "green", "icon": "✅"})

    # 4. Generate Professional Summary (User Request)
    summary = ""
    if is_high_risk:
        summary = f"Potential deception indicators found ({risk_percent}% risk). The highlighted words suggest generic or exaggerated language often seen in paid or coordinated spam, rather than specific customer experiences."
    else:
        summary = f"This review appears consistent with verified authentic feedback ({100 - risk_percent}% confidence). The highlights indicate specific, detailed language often found in real customer experiences."

    # 5. Format Raw Data (For Tooltips)
    clean_raw_data = []
    for word, score in word_attributions:
        if word not in ["[CLS]", "[SEP]"]:
            # Round score for cleaner UI (e.g., 0.15)
            clean_raw_data.append({"word": clean_token(word), "score": round(score, 3)})

    return {
        "risk_score": risk_percent,
        "verdict": "CRITICAL ISSUES FOUND" if is_high_risk else "AUTHENTICITY VERIFIED",
        "verdict_color": "red" if is_high_risk else "green",
        "summary": summary,
        "trust_badges": badges,         # 🆕 Badges
        "sentiment_score": sentiment_score, # 🆕 For Bar Chart
        "rating_score": rating_score,       # 🆕 For Bar Chart
        "consistency_gap": consistency_gap,
        "evidence": analyze_risk_factors(word_attributions),
        "raw_explanation": clean_raw_data
    }