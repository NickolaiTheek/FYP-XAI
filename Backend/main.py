from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import torch
from transformers import DistilBertTokenizer, DistilBertForSequenceClassification
from transformers_interpret import SequenceClassificationExplainer
from fastapi.middleware.cors import CORSMiddleware
from textblob import TextBlob
import os
import json
from dotenv import load_dotenv
from serpapi import GoogleSearch
from google import genai

# --- LOAD ENVIRONMENT VARIABLES ---
load_dotenv()
SERPAPI_KEY = os.getenv("SERPAPI_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Initialize Gemini Client
if GEMINI_API_KEY:
    gemini_client = genai.Client(api_key=GEMINI_API_KEY)
else:
    gemini_client = None
    print("⚠️ GEMINI_API_KEY not found. Summarization will be disabled.")

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

# 🔥 UPGRADED TWO-STEP LIVE SEARCH WITH JSON SCORECARD 🔥
@app.get("/search")
def search_restaurant(query: str):
    if not SERPAPI_KEY:
        raise HTTPException(status_code=500, detail="SerpApi key is missing from .env file")
    
    # --- PHASE 1: Resolve the Restaurant Name to a Google Place ID ---
    params_place = {
        "engine": "google_maps",
        "q": query,
        "hl": "en",
        "api_key": SERPAPI_KEY
    }
    
    try:
        search_place = GoogleSearch(params_place)
        results_place = search_place.get_dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"API Error: {str(e)}")

    place_id = None
    restaurant_name = query

    if "place_results" in results_place:
        place_id = results_place["place_results"].get("place_id")
        restaurant_name = results_place["place_results"].get("title", query)
    elif "local_results" in results_place and len(results_place["local_results"]) > 0:
        place_id = results_place["local_results"][0].get("place_id")
        restaurant_name = results_place["local_results"][0].get("title", query)
        
    if not place_id:
        raise HTTPException(status_code=404, detail="Could not find this restaurant on Google Maps.")

    # --- PHASE 2: Fetch 20 NEWEST Reviews using Pagination ---
    raw_reviews = []
    next_page_token = None
    
    for page in range(2):
        params_reviews = {
            "engine": "google_maps_reviews",
            "place_id": place_id,
            "hl": "en",
            "sort_by": "newestFirst", 
            "api_key": SERPAPI_KEY
        }
        if next_page_token:
            params_reviews["next_page_token"] = next_page_token
            
        try:
            search_reviews = GoogleSearch(params_reviews)
            results_reviews = search_reviews.get_dict()
            fetched_reviews = results_reviews.get("reviews", [])
            raw_reviews.extend(fetched_reviews)
            
            if "serpapi_pagination" in results_reviews and "next_page_token" in results_reviews["serpapi_pagination"]:
                next_page_token = results_reviews["serpapi_pagination"]["next_page_token"]
            else:
                break 
        except Exception as e:
            if page == 0: raise HTTPException(status_code=500, detail=f"API Error fetching reviews: {str(e)}")
            else: break 
                
    raw_reviews = raw_reviews[:20]
    if not raw_reviews: raise HTTPException(status_code=404, detail="This place has no text reviews to analyze.")

    # --- PHASE 3: Batch Process through AI Models ---
    total = 0
    fakes = 0
    reviews_data = []
    genuine_texts = [] 
    
    total_genuine_stars = 0
    genuine_positive = 0
    genuine_negative = 0
    
    for rev in raw_reviews:
        text = rev.get("snippet", "")
        stars = rev.get("rating", 5)
        
        if not text or len(text) < 10: continue 
        total += 1
        
        inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
        with torch.no_grad(): outputs = model(**inputs)
        probs = torch.nn.functional.softmax(outputs.logits, dim=1)
        is_fake = probs[0][1].item() > 0.5
        
        try: sentiment_score = int((TextBlob(text).sentiment.polarity + 1) * 50)
        except: sentiment_score = 50
        
        if is_fake: 
            fakes += 1
        else:
            genuine_texts.append(f"Rating: {stars}/5. Review: {text}")
            total_genuine_stars += stars
            if sentiment_score > 55: genuine_positive += 1
            elif sentiment_score < 45: genuine_negative += 1
            
        rating_score = int((stars / 5) * 100)
        is_mismatch = abs(rating_score - sentiment_score) > 40
        review_date = rev.get("date", "Recent")

        reviews_data.append({
            "author": rev.get("user", {}).get("name", "Anonymous"),
            "date": review_date,
            "text": text,
            "stars": stars,
            "is_fake": is_fake,
            "is_mismatch": is_mismatch
        })

    if total == 0: raise HTTPException(status_code=404, detail="No valid text reviews found to analyze.")

    real = total - fakes
    trust_score = int(((total - fakes) / total) * 100)
    verified_rating = round(total_genuine_stars / real, 1) if real > 0 else 0.0 
    
    # --- PHASE 4: Generate Structured Aspect Scorecard via LLM ---
    scorecard_data = []
    if gemini_client and len(genuine_texts) > 0:
        combined_text = "\n".join(genuine_texts)
        prompt = f"""
        You are an AI data extractor. Analyze the following VERIFIED AUTHENTIC reviews.
        I need an aspect-based scorecard for these 5 categories: "Food Quality", "Service", "Hygiene", "Atmosphere", "Value for Money".
        
        Return ONLY a raw JSON array. Do not include markdown formatting, backticks, or extra text.
        Format EXACTLY like this:
        [
          {{"aspect": "Food Quality", "score": "4.5/5", "confidence": "High", "evidence": "delicious, fresh seafood"}},
          {{"aspect": "Service", "score": "3.0/5", "confidence": "Medium", "evidence": "polite but slow delivery"}}
        ]
        
        If an aspect is not mentioned enough to score, set the score to "N/A", confidence to "Low", and evidence to "Not enough data".
        
        Reviews:
        {combined_text}
        """
        try:
            response = gemini_client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
            )
            raw_text = response.text.strip()
            # Clean up potential markdown blocks from Gemini
            if raw_text.startswith("```json"):
                raw_text = raw_text[7:-3].strip()
            elif raw_text.startswith("```"):
                raw_text = raw_text[3:-3].strip()
                
            scorecard_data = json.loads(raw_text)
        except Exception as e:
            print("Gemini API/JSON Parse Error:", e)
            scorecard_data = []

    return {
        "restaurant_name": restaurant_name,
        "stats": {
            "total": total, "fakes": fakes, "real": real, "trust_score": trust_score,
            "verified_rating": verified_rating, "genuine_positive": genuine_positive, "genuine_negative": genuine_negative
        },
        "scorecard": scorecard_data, # 🔥 PASSING JSON ARRAY TO FRONTEND
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
        if suspicious_str:
            summary = f"This review was flagged as High Risk ({risk_percent}%). It uses exaggerated emotional phrasing, unusual repetition, and platform-related wording patterns (such as {suspicious_str}) often found in synthetic or promotional content."
        else:
            summary = f"This review was flagged as High Risk ({risk_percent}%). It uses exaggerated emotional phrasing, unusual structural patterns, and repetition often found in synthetic or promotional content."
            
    elif risk_percent > 45:
        verdict = "INCONCLUSIVE / MIXED SIGNALS"
        verdict_color = "orange" 
        summary = f"This analysis is Inconclusive ({risk_percent}% Risk). The review contains a blend of genuine-sounding details and generic phrasing, making it difficult to fully verify its authenticity."
        
    else:
        verdict = "AUTHENTICITY VERIFIED"
        verdict_color = "green"
        summary = f"This review appears Authentic ({100 - risk_percent}% confidence). The language, phrasing, and contextual details align closely with natural human feedback patterns."

    clean_raw_data = [{"word": clean_token(w), "score": round(s, 3)} for w, s in word_attributions if w not in ["[CLS]", "[SEP]"]]

    return {
        "risk_score": risk_percent, "verdict": verdict, "verdict_color": verdict_color,
        "summary": summary, "trust_badges": badges, "sentiment_score": sentiment_score,
        "rating_score": rating_score, "consistency_gap": consistency_gap,
        "evidence": evidence, "raw_explanation": clean_raw_data
    }