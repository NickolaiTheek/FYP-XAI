from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import torch
from transformers import DistilBertTokenizer, DistilBertForSequenceClassification
from transformers_interpret import SequenceClassificationExplainer
from fastapi.middleware.cors import CORSMiddleware
from textblob import TextBlob
import os
from dotenv import load_dotenv
from serpapi import GoogleSearch

# --- LOAD ENVIRONMENT VARIABLES ---
load_dotenv()
SERPAPI_KEY = os.getenv("SERPAPI_KEY")

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 1. LOAD AI MODEL ---
try:
    model_path = "Models" # Ensure this folder exists
    tokenizer = DistilBertTokenizer.from_pretrained(model_path)
    model = DistilBertForSequenceClassification.from_pretrained(model_path)
    explainer = SequenceClassificationExplainer(model, tokenizer)
    print("✅ AI Models loaded successfully")
except Exception as e:
    print(f"❌ Model Error: {e}")
    explainer = None

# --- HELPER FUNCTIONS ---
def clean_token(word):
    return word.replace("##", "").strip()

def analyze_risk_factors(explanation_list):
    suspicious_words = [
        (clean_token(word), score) for word, score in explanation_list 
        if score > 0.05 and len(clean_token(word)) > 2 and word not in ["[CLS]", "[SEP]"]
    ]
    suspicious_words.sort(key=lambda x: x[1], reverse=True)
    
    evidence = []
    seen = set()
    for word, score in suspicious_words:
        if word in seen: continue
        seen.add(word)
        if len(evidence) >= 3: break
        
        impact = "High" if score > 0.15 else "Medium"
        color = "red" if score > 0.15 else "orange"
            
        evidence.append({
            "word": word, "impact": impact, "color": color,
            "reason": "Generic / Filler" if impact == "High" else "Unusual Phrasing"
        })
    return evidence

# --- API ENDPOINTS ---
@app.get("/")
def home():
    return {"message": "TrustXplain API is Online 🛡️"}

# 🔥 NEW LIVE SEARCH ENDPOINT 🔥
@app.get("/search")
def search_restaurant(query: str):
    if not SERPAPI_KEY:
        raise HTTPException(status_code=500, detail="SerpApi key is missing from .env file")
    
    # 1. Fetch live data from Google Maps via SerpApi
    params = {
        "engine": "google_maps",
        "q": query,
        "hl": "en",
        "api_key": SERPAPI_KEY
    }
    
    try:
        search = GoogleSearch(params)
        results = search.get_dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"API Error: {str(e)}")

    # Extract reviews
    raw_reviews = []
    if "place_results" in results and "reviews" in results["place_results"]:
        raw_reviews = results["place_results"]["reviews"][:20] # Limit to 20 for speed
        
    if not raw_reviews:
        raise HTTPException(status_code=404, detail="No reviews found for this search.")

    # 2. Batch Process through AI Models
    total = 0
    fakes = 0
    reviews_data = []
    
    for rev in raw_reviews:
        text = rev.get("snippet", "")
        stars = rev.get("rating", 5)
        
        if not text or len(text) < 10: 
            continue # Skip empty ratings
            
        total += 1
        
        # DistilBERT Classification
        inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
        with torch.no_grad():
            outputs = model(**inputs)
        probs = torch.nn.functional.softmax(outputs.logits, dim=1)
        is_fake = probs[0][1].item() > 0.5
        
        if is_fake: fakes += 1
            
        # VADER / TextBlob Logic Check
        try:
            sentiment_score = int((TextBlob(text).sentiment.polarity + 1) * 50)
        except:
            sentiment_score = 50
            
        rating_score = int((stars / 5) * 100)
        is_mismatch = abs(rating_score - sentiment_score) > 40
        
        reviews_data.append({
            "author": rev.get("user", {}).get("name", "Anonymous"),
            "text": text,
            "stars": stars,
            "is_fake": is_fake,
            "is_mismatch": is_mismatch
        })

    if total == 0:
        raise HTTPException(status_code=404, detail="No text reviews found.")

    real = total - fakes
    trust_score = int(((total - fakes) / total) * 100)
    
    return {
        "restaurant_name": results.get("place_results", {}).get("title", query),
        "stats": {"total": total, "fakes": fakes, "real": real, "trust_score": trust_score},
        "reviews": reviews_data
    }

# --- YOUR EXISTING EXPLAIN ENDPOINT (UNTOUCHED) ---
class ExplainRequest(BaseModel):
    text: str
    stars: int 

@app.post("/explain")
def explain_review(request: ExplainRequest):
    if not explainer: raise HTTPException(status_code=500, detail="Model not active")
    
    inputs = tokenizer(request.text, return_tensors="pt", truncation=True, max_length=512)
    with torch.no_grad(): outputs = model(**inputs)
    
    probs = torch.nn.functional.softmax(outputs.logits, dim=1)
    fake_prob = probs[0][1].item()
    risk_percent = int(fake_prob * 100)

    word_attributions = explainer(request.text, class_name="LABEL_1")

    try:
        sentiment_score = int((TextBlob(request.text).sentiment.polarity + 1) * 50) 
    except:
        sentiment_score = 50 

    rating_score = int((request.stars / 5) * 100)
    consistency_gap = abs(rating_score - sentiment_score)
    is_mismatch = consistency_gap > 40 

    badges = []
    evidence = analyze_risk_factors(word_attributions)

    if risk_percent > 65:
        if len(evidence) > 0: badges.append({"label": "Generic Keywords", "type": "yellow", "icon": "⚠️"})
        if is_mismatch: badges.append({"label": "High Inconsistency", "type": "red", "icon": "⛔"})
        else: badges.append({"label": "Deceptive Patterns", "type": "red", "icon": "🚨"})
    elif risk_percent > 45:
        badges.append({"label": "Mixed Signals", "type": "yellow", "icon": "🤔"})
        if is_mismatch: badges.append({"label": "Tone Mismatch", "type": "red", "icon": "📉"})
    else:
        badges.append({"label": "Consistent Rating", "type": "green", "icon": "✅"})
        if risk_percent < 15: badges.append({"label": "Specific Details", "type": "green", "icon": "🛡️"})

    suspicious_word_list = [item['word'] for item in evidence[:3]]
    suspicious_str = ", ".join(f"'{w}'" for w in suspicious_word_list)

    if risk_percent > 65:
        verdict = "CRITICAL ISSUES FOUND"
        verdict_color = "red"
        summary = f"Flagged as High Risk ({risk_percent}%). Found over-reliance on buzzwords like {suspicious_str}." if suspicious_str else f"Flagged as High Risk ({risk_percent}%). Detected structural anomalies."
    elif risk_percent > 45:
        verdict = "INCONCLUSIVE / MIXED SIGNALS"
        verdict_color = "orange" 
        summary = f"Inconclusive ({risk_percent}%). Contains a mix of specific details and generic phrasing."
    else:
        verdict = "AUTHENTICITY VERIFIED"
        verdict_color = "green"
        summary = f"Authentic ({100 - risk_percent}% confidence). Contextual usage aligns with genuine feedback."

    clean_raw_data = [{"word": clean_token(w), "score": round(s, 3)} for w, s in word_attributions if w not in ["[CLS]", "[SEP]"]]

    return {
        "risk_score": risk_percent, "verdict": verdict, "verdict_color": verdict_color,
        "summary": summary, "trust_badges": badges, "sentiment_score": sentiment_score,
        "rating_score": rating_score, "consistency_gap": consistency_gap,
        "evidence": evidence, "raw_explanation": clean_raw_data
    }