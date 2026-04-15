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
            
        evidence.append({
            "word": word, "impact": impact, "color": color,
            "reason": "Generic / Filler" if impact == "High" else "Unusual Phrasing"
        })
    return evidence

# --- API ENDPOINTS ---
@app.get("/")
def home():
    return {"message": "TrustXplain V2 API is Online 🛡️"}

@app.get("/search")
def search_restaurant(query: str, limit: int = 20):
    if not SERPAPI_KEY:
        raise HTTPException(status_code=500, detail="SerpApi key is missing from .env file")
    
    # --- PHASE 1: Resolve the Restaurant Name ---
    params_place = {"engine": "google_maps", "q": query, "hl": "en", "api_key": SERPAPI_KEY}
    try:
        results_place = GoogleSearch(params_place).get_dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"API Error: {str(e)}")

    place_id, restaurant_name, google_rating = None, query, 0.0

    if "place_results" in results_place:
        place_id = results_place["place_results"].get("place_id")
        restaurant_name = results_place["place_results"].get("title", query)
        google_rating = results_place["place_results"].get("rating", 0.0) 
    elif "local_results" in results_place and len(results_place["local_results"]) > 0:
        place_id = results_place["local_results"][0].get("place_id")
        restaurant_name = results_place["local_results"][0].get("title", query)
        google_rating = results_place["local_results"][0].get("rating", 0.0) 
        
    if not place_id: raise HTTPException(status_code=404, detail="Could not find this place on Google Maps.")

    # --- PHASE 2: Fetch NEWEST Reviews Dynamically Based on Limit ---
    valid_reviews = []
    next_page_token = None
    
    for page in range(10):
        params_reviews = {"engine": "google_maps_reviews", "place_id": place_id, "hl": "en", "sort_by": "newestFirst", "api_key": SERPAPI_KEY}
        if next_page_token: params_reviews["next_page_token"] = next_page_token
            
        try:
            results_reviews = GoogleSearch(params_reviews).get_dict()
            fetched_reviews = results_reviews.get("reviews", [])
            
            for rev in fetched_reviews:
                text = rev.get("snippet", "")
                if text and len(text) >= 10:
                    valid_reviews.append(rev)
            
            if "serpapi_pagination" in results_reviews and "next_page_token" in results_reviews["serpapi_pagination"]:
                next_page_token = results_reviews["serpapi_pagination"]["next_page_token"]
            else: 
                break 
                
            if len(valid_reviews) >= limit:
                break
                
        except Exception as e:
            if page == 0: raise HTTPException(status_code=500, detail=f"API Error fetching reviews: {str(e)}")
            else: break 
                
    raw_reviews = valid_reviews[:limit]
    if not raw_reviews: raise HTTPException(status_code=404, detail="This place has no text reviews to analyze.")

    # --- PHASE 3: Batch Process through V2 AI Model ---
    total, fakes, genuine_positive, genuine_neutral, genuine_negative = 0, 0, 0, 0, 0
    reviews_data, genuine_texts = [], []
    
    for rev in raw_reviews:
        text = rev.get("snippet", "")
        stars = rev.get("rating", 5)
        
        if not text or len(text) < 10: continue 
        total += 1
        
        try: sentiment_score = int((TextBlob(text).sentiment.polarity + 1) * 50)
        except: sentiment_score = 50
        
        injected_text = inject_metadata(text, stars, sentiment_score)
        
        inputs = tokenizer(injected_text, return_tensors="pt", truncation=True, max_length=512)
        with torch.no_grad(): outputs = model(**inputs)
        probs = torch.nn.functional.softmax(outputs.logits, dim=1)
        is_fake = probs[0][1].item() > 0.5
        
        if is_fake: 
            fakes += 1
        else:
            genuine_texts.append(f"Rating: {stars}/5. Review: {text}")
            if stars >= 4: genuine_positive += 1
            elif stars == 3: genuine_neutral += 1
            else: genuine_negative += 1
            
        rating_score = int((stars / 5) * 100)
        is_mismatch = abs(rating_score - sentiment_score) > 40

        reviews_data.append({
            "author": rev.get("user", {}).get("name", "Anonymous"),
            "date": rev.get("date", "Recent"),
            "text": text,
            "stars": stars,
            "is_fake": is_fake,
            "is_mismatch": is_mismatch
        })

    if total == 0: raise HTTPException(status_code=404, detail="No valid text reviews found to analyze.")

    real = total - fakes
    trust_score = int(((total - fakes) / total) * 100)
    
    
    scorecard_data = []
    if gemini_client and len(genuine_texts) > 0:
        combined_text = "\n".join(genuine_texts)
        
        # --- NEW PROMPT FOR DETAILED SUMMARIES ---
        prompt = f"""
        You are an AI data extractor. Analyze the following VERIFIED AUTHENTIC reviews.
        I need an aspect-based scorecard for these 5 categories: "Food Quality", "Service", "Hygiene", "Atmosphere", "Value for Money".
        
        Return ONLY a raw JSON array. Do not include markdown formatting, backticks, or extra text.
        Format EXACTLY like this:
        [
          {{
            "aspect": "Food Quality", 
            "score": "4.5/5", 
            "confidence": "High", 
            "short_quote": "Praised for 'lovely tasty' food, though one noted 'pile of grease'.",
            "detailed_summary": "Most customers highly praised the taste and portion sizes, noting the pizza was large and delicious. However, a few isolated reviews mentioned occasional greasiness or minor inconsistencies in temperature."
          }}
        ]
        
        CRITICAL RULES:
        1. 'short_quote': MUST be under 15 words. Stitch together 1 to 3 impactful quoted phrases to capture the authentic user voice.
        2. 'detailed_summary': MUST be a 30-40 word comprehensive summary combining multiple customer opinions. Write in a professional, analytical tone.
        3. If an aspect is not mentioned enough to score, set score to "N/A", confidence to "Low", and both text fields to "Not enough data".
        
        Reviews:
        {combined_text}
        """
        try:
            response = gemini_client.models.generate_content(model='gemini-2.5-flash', contents=prompt)
            raw_text = response.text.strip()
            
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
            "google_rating": google_rating, "genuine_positive": genuine_positive, 
            "genuine_neutral": genuine_neutral, "genuine_negative": genuine_negative
        },
        "scorecard": scorecard_data,
        "reviews": reviews_data
    }

class ExplainRequest(BaseModel):
    text: str
    stars: int 

@app.post("/explain")
def explain_review(request: ExplainRequest):
    if not explainer: raise HTTPException(status_code=500, detail="Model not active")
    
    try: sentiment_score = int((TextBlob(request.text).sentiment.polarity + 1) * 50) 
    except: sentiment_score = 50 

    injected_text = inject_metadata(request.text, request.stars, sentiment_score)

    inputs = tokenizer(injected_text, return_tensors="pt", truncation=True, max_length=512)
    with torch.no_grad(): outputs = model(**inputs)
    
    probs = torch.nn.functional.softmax(outputs.logits, dim=1)
    fake_prob = probs[0][1].item()
    risk_percent = int(fake_prob * 100)

    word_attributions = explainer(injected_text, class_name="LABEL_1")

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

    suspicious_word_list = [item['word'] for item in evidence[:3] if item['word'].isalpha()]
    suspicious_str = ", ".join(f"'{w}'" for w in suspicious_word_list)

    if risk_percent > 65:
        if request.stars >= 4:
            verdict = "PROMOTIONAL / INCENTIVIZED"
            verdict_color = "red"
            summary = f"Flagged ({risk_percent}% Risk). While written by a human, the language contains heavily promotional and exaggerated phrasing. This often indicates the reviewer was incentivized (e.g., offered a discount or asked by staff) to leave a glowing review."
        else:
            verdict = "CRITICAL ISSUES FOUND"
            verdict_color = "red"
            if suspicious_str:
                summary = f"This review was flagged as High Risk ({risk_percent}%). It uses exaggerated phrasing and metadata patterns (such as {suspicious_str}) often found in synthetic or malicious content."
            else:
                summary = f"This review was flagged as High Risk ({risk_percent}%). It uses structural metadata patterns and repetition often found in synthetic content."
            
    elif risk_percent > 45:
        verdict = "INCONCLUSIVE / MIXED SIGNALS"
        verdict_color = "orange" 
        summary = f"This analysis is Inconclusive ({risk_percent}% Risk). The review contains a blend of genuine-sounding details and generic, promotional phrasing."
        
    else:
        verdict = "AUTHENTICITY VERIFIED"
        verdict_color = "green"
        summary = f"This review appears Authentic ({100 - risk_percent}% confidence). The language, phrasing, and contextual details align closely with natural human feedback patterns."

    clean_raw_data = [{"word": clean_token(w), "score": round(s, 3)} for w, s in word_attributions if w not in ["[CLS]", "[SEP]", "[", "]", ":"]]

    return {
        "risk_score": risk_percent, "verdict": verdict, "verdict_color": verdict_color,
        "summary": summary, "trust_badges": badges, "sentiment_score": sentiment_score,
        "rating_score": rating_score, "consistency_gap": consistency_gap,
        "evidence": evidence, "raw_explanation": clean_raw_data
    }