from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import torch
from transformers import DistilBertTokenizerFast, DistilBertForSequenceClassification
from transformers_interpret import SequenceClassificationExplainer
from fastapi.middleware.cors import CORSMiddleware
from textblob import TextBlob
import os
import json
import re
from dotenv import load_dotenv
from serpapi import GoogleSearch
from openai import OpenAI

# --- LOAD ENVIRONMENT VARIABLES ---
load_dotenv()
SERPAPI_KEY = os.getenv("SERPAPI_KEY")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

# Initialize OpenRouter Client (Using Llama 3 for reliability)
if OPENROUTER_API_KEY:
    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=OPENROUTER_API_KEY,
    )
else:
    client = None
    print("⚠️ OPENROUTER_API_KEY not found.")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 1. LOAD V2 AI MODEL ---
try:
    model_path = "Models" 
    tokenizer = DistilBertTokenizerFast.from_pretrained(model_path)
    model = DistilBertForSequenceClassification.from_pretrained(model_path)
    explainer = SequenceClassificationExplainer(model, tokenizer)
    print("✅ V2 AI Models loaded successfully")
except Exception as e:
    print(f"❌ Model Error: {e}")
    explainer = None

# --- V2 FEATURE ENGINEERING HELPERS ---
def clean_token(word):
    return word.replace("##", "").strip()

def calculate_caps_ratio(text):
    text = str(text)
    alpha_chars = re.sub(r'[^a-zA-Z]', '', text)
    if len(alpha_chars) == 0: return 0.0
    caps = sum(1 for c in alpha_chars if c.isupper())
    return caps / len(alpha_chars)

def inject_metadata(text, stars, sentiment_score):
    word_count = len(str(text).split())
    if word_count < 15: length_tag = "SHORT"
    elif word_count > 100: length_tag = "LONG"
    else: length_tag = "MEDIUM"
        
    caps_ratio = calculate_caps_ratio(text)
    caps_tag = "HIGH_CAPS" if caps_ratio > 0.15 else "NORM_CAPS"
        
    if sentiment_score > 60: sentiment_tag = "POS_SENT"
    elif sentiment_score < 40: sentiment_tag = "NEG_SENT"
    else: sentiment_tag = "NEU_SENT"

    return f"[STARS: {int(stars)}] [LEN: {length_tag}] [{caps_tag}] [{sentiment_tag}] {text}"

def analyze_risk_factors(explanation_list):
    suspicious_words = [
        (clean_token(word), score) for word, score in explanation_list 
        if score > 0.05 and len(clean_token(word)) > 2 and word not in ["[CLS]", "[SEP]", "[", "]"]
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
        evidence.append({"word": word, "impact": impact, "color": color, "reason": "Generic"})
    return evidence

# --- API ENDPOINTS ---
@app.get("/")
def home():
    return {"message": "TrustXplain V2 API is Online 🛡️"}

@app.get("/search")
def search_restaurant(query: str, limit: int = 20):
    if not SERPAPI_KEY:
        raise HTTPException(status_code=500, detail="SerpApi key missing")
    
    params_place = {"engine": "google_maps", "q": query, "hl": "en", "api_key": SERPAPI_KEY}
    results_place = GoogleSearch(params_place).get_dict()
    
    place_id = results_place.get("place_results", {}).get("place_id")
    if not place_id: raise HTTPException(status_code=404, detail="Not found")

    valid_reviews = []
    params_reviews = {"engine": "google_maps_reviews", "place_id": place_id, "api_key": SERPAPI_KEY}
    results_reviews = GoogleSearch(params_reviews).get_dict()
    fetched_reviews = results_reviews.get("reviews", [])
    
    total, fakes, genuine_positive, genuine_neutral, genuine_negative = 0, 0, 0, 0, 0
    reviews_data, genuine_texts = [], []
    
    for rev in fetched_reviews:
        text = rev.get("snippet", "")
        stars = rev.get("rating", 5)
        if not text or len(text) < 10: continue 
        total += 1
        sentiment_score = int((TextBlob(text).sentiment.polarity + 1) * 50)
        injected_text = inject_metadata(text, stars, sentiment_score)
        inputs = tokenizer(injected_text, return_tensors="pt", truncation=True, max_length=512)
        with torch.no_grad(): outputs = model(**inputs)
        is_fake = torch.nn.functional.softmax(outputs.logits, dim=1)[0][1].item() > 0.5
        
        if is_fake: fakes += 1
        else:
            genuine_texts.append(f"Rating: {stars}/5. Review: {text}")
            if stars >= 4: genuine_positive += 1
            elif stars == 3: genuine_neutral += 1
            else: genuine_negative += 1
        reviews_data.append({"author": rev.get("user", {}).get("name", "Anonymous"), "text": text, "stars": stars, "is_fake": is_fake})
        if total >= limit: break

    scorecard_data = []
    if client and len(genuine_texts) > 0:
        prompt = f"Analyze reviews: {'. '.join(genuine_texts)}. Return JSON array with fields: aspect, score, confidence, short_quote, detailed_summary. Use single quotes only."
        try:
            completion = client.chat.completions.create(
                model="meta-llama/llama-3-8b-instruct",
                messages=[{"role": "user", "content": prompt}]
            )
            scorecard_data = json.loads(re.search(r'\[.*\]', completion.choices[0].message.content, re.DOTALL).group(0))
        except Exception as e:
            print(f"OpenRouter Error: {e}", flush=True)

    return {"restaurant_name": query, "stats": {"total": total, "fakes": fakes, "genuine_positive": genuine_positive, "genuine_neutral": genuine_neutral, "genuine_negative": genuine_negative, "google_rating": 4.5}, "scorecard": scorecard_data, "reviews": reviews_data}

@app.post("/explain")
def explain_review(request: ExplainRequest):
    # (Keep your existing explain_review function here - it is already correct)
    return {"message": "Success"}